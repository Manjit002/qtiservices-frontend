/**
 * Admin chat sidebar — built from ONE bulk summary, not ~120 per-order calls.
 *
 * Loads /admin/chat in headless Chrome and counts every request the page makes.
 * The sidebar must cost exactly two requests — the order list and
 * GET /api/order-chat/conversations?role=ADMIN — with no per-order
 * /api/order-chat/history?size=1 or /api/order-chat/unread-count calls, and
 * still show everything it showed before: student, last message, time, unread
 * badge, "no messages yet" rows, unread-first sorting, the Unread filter,
 * search, opening a thread (one history/all + markSeen), and live socket
 * updates to previews and unread counts.
 *
 * It also checks the endpoint being missing or broken (404, 403, an HTML page):
 * orders still list, the sidebar says previews are unavailable, the admin is
 * not signed out, and nothing falls back to per-order requests.
 *
 * TEST SCAFFOLDING ONLY — REST calls are answered by request interception and
 * the SockJS socket is a small in-page STOMP peer, as in chat-multiline.test.mjs.
 *
 *   BASE=http://localhost:7600 [OUT=/tmp/sidebar-shots] node chat-sidebar.test.mjs
 */
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = process.env.BASE;
const OUT = process.env.OUT ?? '';
if (!BASE) { console.error('Set BASE, e.g. BASE=http://localhost:7600'); process.exit(2); }
if (OUT) fs.mkdirSync(OUT, { recursive: true });
const shot = (page, name) => (OUT ? page.screenshot({ path: `${OUT}/${name}.png` }).catch(() => {}) : null);

let passed = 0, failed = 0;
const check = (name, ok, detail) => {
  if (ok) passed += 1; else failed += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail !== undefined ? `  → ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Fixtures ────────────────────────────────────────────────────────────────
const NOW = Date.now();
const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR;
const ldt = (ms) => new Date(ms).toISOString().slice(0, 19);
const SUBJECTS = ['Calculus II Problem Set', 'Nursing Care Plan', 'Real Estate Principles', 'Statistics Project', 'Business Ethics Essay'];
// 60 most recent orders: 2060 newest … 2001 oldest, one hour apart, all ≥ 1 day old.
const ORDERS = Array.from({ length: 60 }, (_, i) => {
  const id = 2060 - i;
  return { id, subject: `${SUBJECTS[i % SUBJECTS.length]} #${id}`, status: i % 7 === 0 ? 'COMPLETED' : 'IN_PROGRESS', studentId: 500 + i, createdAt: ldt(NOW - DAY - i * HOUR) };
});
// One order that carries the student's name itself and has no chat yet.
ORDERS.find((o) => o.id === 2055).studentName = 'Dana Lee';
const SUMMARIES = [
  { orderId: 2003, studentId: 557, studentName: 'Chyna Brooks', lastMessage: 'Can you confirm the price?', lastMessageTime: NOW - 5 * MIN, unreadCount: 2, hasConversation: true },
  { orderId: 2020, studentId: 540, studentName: 'Hana Suzuki', lastMessage: null, lastMessageTime: NOW - HOUR, unreadCount: 1, hasConversation: true },
  { orderId: 2010, studentId: 550, studentName: 'Wade Morgan', lastMessage: 'Thanks, that works.', lastMessageTime: NOW - 2 * HOUR, unreadCount: 0, hasConversation: true },
  { orderId: 2030, studentId: 530, studentName: null, lastMessage: null, lastMessageTime: null, unreadCount: 0, hasConversation: false },
  // Outside the 60-order window: the sidebar keeps its existing window.
  { orderId: 1500, studentId: 900, studentName: 'Outside Window', lastMessage: 'Old thread', lastMessageTime: NOW - MIN, unreadCount: 4, hasConversation: true },
];
const HISTORY_2003 = [
  { messageId: 7001, orderId: 2003, senderId: 557, senderRole: 'STUDENT', senderName: 'Chyna Brooks', message: 'Hi, I sent the syllabus.', messageType: 'TEXT', createdAt: NOW - 20 * MIN, seen: false },
  { messageId: 7002, orderId: 2003, senderId: 3, senderRole: 'ADMIN', senderName: 'Support Team', message: 'Got it, reviewing now.', messageType: 'TEXT', createdAt: NOW - 15 * MIN, seen: true },
  { messageId: 7003, orderId: 2003, senderId: 557, senderRole: 'STUDENT', senderName: 'Chyna Brooks', message: 'Can you confirm the price?', messageType: 'TEXT', createdAt: NOW - 5 * MIN, seen: false },
];

const HISTORY_2004 = Array.from({ length: 22 }, (_, i) => ({ messageId: 6100 + i, orderId: 2004, senderId: 556, senderRole: i % 2 ? 'ADMIN' : 'STUDENT', senderName: 'Lena Ortiz', message: `Recent 2004 message ${i}`, messageType: 'TEXT', createdAt: NOW - (30 - i) * MIN, seen: true }));
const OLDER_2004 = [{ messageId: 6001, orderId: 2004, senderId: 556, senderRole: 'STUDENT', senderName: 'Lena Ortiz', message: 'Older 2004 message', messageType: 'TEXT', createdAt: NOW - 3 * DAY, seen: true }];
const HISTORY_2010 = [{ messageId: 7201, orderId: 2010, senderId: 550, senderRole: 'STUDENT', senderName: 'Wade Morgan', message: 'Earlier question', messageType: 'TEXT', createdAt: NOW - 3 * HOUR, seen: true }];
const delay = (ms, fn) => void setTimeout(fn, ms);

/** What the conversations endpoint does in this run. */
let mode = 'ok';
const log = [];

function respond(r, origin) {
  const u = new URL(r.url());
  const h = r.headers();
  const isRsc = h.rsc || h['next-router-prefetch'] || h['next-router-state-tree'] || u.searchParams.has('_rsc');
  if (u.hostname.endsWith('googleapis.com') || u.hostname.endsWith('gstatic.com')) return r.respond({ status: 200, contentType: 'text/css', body: '' });
  const cors = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true' };
  const json = (status, body) => r.respond({ status, contentType: 'application/json', headers: cors, body: JSON.stringify(body) });
  if (u.pathname.endsWith('/ws/chat/info')) return json(200, { websocket: true, origins: ['*:*'], cookie_needed: false, entropy: 42 });
  if (isRsc || !['fetch', 'xhr', 'eventsource'].includes(r.resourceType())) return r.continue();
  const p = u.pathname;
  log.push({ method: r.method(), path: p, query: Object.fromEntries(u.searchParams), t: Date.now() });
  if (p === '/orders/all') {
    if (mode === 'orders-fail') return json(500, { message: 'Orders service unavailable' });
    return json(200, { content: ORDERS, totalElements: 240, totalPages: 4, number: 0, size: 60, last: false, first: true, empty: false });
  }
  if (p === '/api/order-chat/conversations') {
    if (mode === '404') return json(404, { timestamp: 'x', status: 404, error: 'Not Found', path: p });
    if (mode === '403') return json(403, { message: 'Forbidden' });
    if (mode === 'html') return r.respond({ status: 200, contentType: 'text/html', headers: cors, body: '<!doctype html><html><body>app</body></html>' });
    // Slow summary: arrives well after the deep-linked thread's history.
    if (mode === 'slow') return void setTimeout(() => json(200, SUMMARIES), 1500);
    return json(200, SUMMARIES);
  }
  if (p === '/api/order-chat/history/all') {
    const id = u.searchParams.get('orderId');
    if (id === '2010') return delay(900, () => json(200, HISTORY_2010)); // slow on purpose
    return json(200, id === '2003' ? HISTORY_2003 : id === '2004' ? HISTORY_2004 : []);
  }
  if (p === '/api/order-chat/history') {
    if (u.searchParams.get('orderId') === '2004' && u.searchParams.get('page') === '1') {
      return delay(900, () => json(200, { content: OLDER_2004, totalElements: 23, totalPages: 2, number: 1, size: 20, last: true }));
    }
    return json(200, { content: [], totalElements: 0, totalPages: 0, number: 0, size: 20, last: true });
  }
  if (r.method() === 'POST' && p === '/api/order-chat/upload') return json(200, { fileKey: 'k', fileName: 'brief.pdf', contentType: 'application/pdf', fileSize: 10 });
  if (p === '/api/order-chat/unread-count') return json(200, 0);
  if (r.method() === 'POST' && p.startsWith('/api/order-chat/seen/')) return json(200, {});
  return json(503, { message: 'test stub' });
}

/** In-page STOMP peer standing in for the SockJS endpoint (see chat-multiline.test.mjs). */
function installSocketPeer() {
  const subs = new Map(); let sock = null; let seq = 0;
  const frame = (cmd, headers, body = '') => `${cmd}\n${Object.entries(headers).map(([k, v]) => `${k}:${v}`).join('\n')}\n\n${body}\0`;
  const toClient = (f) => sock?.onmessage?.({ data: `a${JSON.stringify([f])}` });
  window.__deliver = (destination, obj) => {
    const id = subs.get(destination); if (id == null) return false;
    toClient(frame('MESSAGE', { destination, subscription: id, 'message-id': `m${++seq}`, 'content-type': 'application/json' }, JSON.stringify(obj)));
    return true;
  };
  window.__subscribed = (d) => subs.has(d);
  window.__sockets = 0;
  window.__stompError = () => toClient(frame('ERROR', { message: 'test failure' }));
  window.__wsSends = 0;
  class PeerSocket {
    constructor(url) { this.url = url; this.readyState = 0; this.protocol = ''; this.extensions = ''; this.bufferedAmount = 0; sock = this;
      subs.clear(); window.__sockets += 1;
      setTimeout(() => { this.readyState = 1; this.onopen?.({ type: 'open' }); this.onmessage?.({ data: 'o' }); }, 20); }
    send(data) {
      for (const raw of JSON.parse(data)) for (const chunk of String(raw).split('\0')) {
        const f = chunk.replace(/^[\r\n]+/, ''); if (!f) continue;
        window.__wsSends += 1;
        const i = f.indexOf('\n\n'); const head = (i < 0 ? f : f.slice(0, i)).split('\n'); const cmd = head.shift();
        const h = {}; for (const l of head) { const k = l.indexOf(':'); if (k > 0) h[l.slice(0, k)] = l.slice(k + 1); }
        if (cmd === 'CONNECT' || cmd === 'STOMP') toClient(frame('CONNECTED', { version: '1.2', 'heart-beat': '0,0' }));
        else if (cmd === 'SUBSCRIBE') subs.set(h.destination, h.id);
        else if (cmd === 'UNSUBSCRIBE') { for (const [d, id] of subs) if (id === h.id) subs.delete(d); }
      }
    }
    close() { this.readyState = 3; this.onclose?.({ code: 1000, reason: '', wasClean: true }); }
  }
  PeerSocket.CONNECTING = 0; PeerSocket.OPEN = 1; PeerSocket.CLOSING = 2; PeerSocket.CLOSED = 3;
  window.WebSocket = PeerSocket;
}

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (sub, role) => `${b64({ alg: 'HS256' })}.${b64({ sub: String(sub), role, exp: Math.floor(NOW / 1000) + 3600 })}.sig`;
const browser = await puppeteer.launch({ args: chromium.args.filter((a) => a !== '--single-process'), executablePath: await chromium.executablePath(), headless: true });

async function openChat(path, role = 'SUPER_ADMIN') {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.evaluateOnNewDocument(installSocketPeer);
  await page.evaluateOnNewDocument((t, r) => {
    localStorage.setItem('token', t); localStorage.setItem('refreshToken', 'r'); localStorage.setItem('userId', '3');
    localStorage.setItem('userRole', r); localStorage.setItem('userEmail', 'ravi.sharma@qtiservices.com'); localStorage.setItem('qti_theme', 'dark');
  }, jwt(3, role), role);
  await page.setRequestInterception(true);
  page.on('request', (r) => respond(r, new URL(BASE).origin));
  log.length = 0;
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});
  await page.waitForFunction(() => document.querySelectorAll('.ch-item').length > 0 || document.querySelector('.ch-list .error, .ch-list [role="alert"]'), { timeout: 10000 }).catch(() => {});
  await sleep(400);
  return { ctx, page, errors };
}
const count = (path, filter = () => true) => log.filter((x) => x.path === path && filter(x)).length;
const perOrder = () => count('/api/order-chat/unread-count') + count('/api/order-chat/history', (x) => x.query.size === '1');
const items = (page) => page.$$eval('.ch-item', (els) => els.map((el) => ({
  name: el.querySelector('.ch-item-name')?.textContent ?? '',
  prev: el.querySelector('.ch-item-prev')?.textContent ?? '',
  ord: el.querySelector('.ch-item-ord')?.textContent ?? '',
  unread: el.querySelector('.ch-unread')?.textContent ?? '',
  time: el.querySelector('.ch-item-time')?.textContent ?? '',
})));
const navBadge = (page) => page.evaluate(() => {
  const a = [...document.querySelectorAll('a[href="/admin/chat"], a[href^="/admin/chat?"]')].find((x) => x.closest('nav, aside, .sidebar'));
  return a?.querySelector('.nav-count')?.textContent ?? '';
});

// ── 1. Initial load: two requests, everything rendered ──────────────────────
console.log('\nSidebar from the bulk summary');
mode = 'ok';
{
  const { ctx, page, errors } = await openChat('/admin/chat');
  const conv = log.filter((x) => x.path === '/api/order-chat/conversations');
  // The portal shell loads its own order list (size=200, for search) on every
  // admin page; only the sidebar's size=60 request belongs to the chat.
  const orders = log.filter((x) => x.path === '/orders/all' && x.query.size === '60');
  check('exactly one order-list request for the sidebar', orders.length === 1, orders.length);
  check('order list keeps its window: size=60, newest first', orders[0]?.query.size === '60' && orders[0]?.query.sort === 'createdAt,desc', orders[0]?.query);
  check('exactly one GET /api/order-chat/conversations', conv.length === 1, conv.length);
  check('summary requested for role=ADMIN', conv[0]?.query.role === 'ADMIN', conv[0]?.query);
  check('summary and orders requested in parallel (not one after the other)', conv[0] && orders[0] && Math.abs(conv[0].t - orders[0].t) < 250, { conv: conv[0]?.t, orders: orders[0]?.t });
  check('NO per-order history?size=1 or unread-count requests', perOrder() === 0, perOrder());
  check('no history/all until a conversation is opened', count('/api/order-chat/history/all') === 0);
  const chatCalls = log.filter((x) => x.path.startsWith('/api/order-chat/') || (x.path === '/orders/all' && x.query.size === '60')).length;
  check('sidebar cost: 2 requests in total (was ~121)', chatCalls === 2, log.map((x) => x.path));

  await shot(page, 'sidebar-from-summary');
  const list = await items(page);
  check('all 60 orders listed, including ones with no messages', list.length === 60, list.length);
  check('orders outside the window are not added (existing behaviour)', !list.some((i) => i.ord.includes('1500')));
  check('unread first, newest activity first: OD-2003, OD-2020, then OD-2010', list[0]?.ord.includes('2003') && list[1]?.ord.includes('2020') && list[2]?.ord.includes('2010'), list.slice(0, 3).map((i) => i.ord));
  const c2003 = list.find((i) => i.ord.includes('2003'));
  check('student name from the summary', c2003?.name === 'Chyna Brooks', c2003);
  check('last message preview', c2003?.prev === 'Can you confirm the price?', c2003?.prev);
  check('last message time', c2003?.time === '5m', c2003?.time);
  check('unread count badge', c2003?.unread === '2', c2003?.unread);
  const c2020 = list.find((i) => i.ord.includes('2020'));
  check('attachment-only last message shows a label, not a blank line', c2020?.prev === '📎 Attachment' && c2020?.unread === '1', c2020);
  const c2030 = list.find((i) => i.ord.includes('2030'));
  check('hasConversation=false → "No messages yet", named by subject', c2030?.prev.startsWith('No messages yet') && c2030?.name === ORDERS.find((o) => o.id === 2030).subject, c2030);
  const c2055 = list.find((i) => i.ord.includes('2055'));
  check('no chat yet but the order names its student → row shows the student', c2055?.name === 'Dana Lee' && c2055?.prev.startsWith('No messages yet'), c2055);
  const c2059 = list.find((i) => i.ord.includes('2059'));
  check('order with no summary row still listed as "No messages yet"', c2059?.prev.startsWith('No messages yet') && c2059?.unread === '', c2059);
  check('no "previews unavailable" notice when the summary loaded', !(await page.$('.ch-list .note')));
  check('nav unread total = sum of summary unread counts in the list (3)', (await navBadge(page)) === '3', await navBadge(page));

  // Filters and search work on the merged rows.
  await page.click('.ch-list .seg button:nth-child(2)'); // Unread
  await sleep(150);
  let f = await items(page);
  check('Unread filter → only the two unread conversations', f.length === 2 && f.every((i) => i.unread), f.map((i) => i.ord));
  await page.click('.ch-list .seg button:nth-child(1)'); // All
  await page.type('.ch-list input', 'wade');
  await sleep(200);
  f = await items(page);
  check('search by student name (from the summary)', f.length === 1 && f[0].ord.includes('2010'), f.map((i) => i.ord));
  await page.$eval('.ch-list input', (el) => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(el, ''); el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.type('.ch-list input', 'od-2030');
  await sleep(200);
  f = await items(page);
  check('search by order ID', f.length === 1 && f[0].ord.includes('2030'), f.map((i) => i.ord));
  await page.$eval('.ch-list input', (el) => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(el, ''); el.dispatchEvent(new Event('input', { bubbles: true })); });
  await sleep(200);

  // Opening a conversation: unchanged path — one history/all, markSeen per unseen.
  const before = log.length;
  const els = await page.$$('.ch-item');
  for (const el of els) { if ((await el.$eval('.ch-item-ord', (n) => n.textContent)).includes('2003')) { await el.click(); break; } }
  await page.waitForFunction(() => [...document.querySelectorAll('.ch-bubble')].some((b) => b.textContent.includes('Hi, I sent the syllabus.')), { timeout: 8000 }).catch(() => {});
  await sleep(500);
  const after = log.slice(before);
  const hist = after.filter((x) => x.path === '/api/order-chat/history/all');
  check('opening OD-2003 → one GET history/all?orderId=2003&role=ADMIN', hist.length === 1 && hist[0].query.orderId === '2003' && hist[0].query.role === 'ADMIN', hist.map((x) => x.query));
  const seen = after.filter((x) => x.method === 'POST' && x.path.startsWith('/api/order-chat/seen/')).map((x) => x.path.split('/').pop()).sort();
  check('markSeen for each unseen student message (7001, 7003)', JSON.stringify(seen) === JSON.stringify(['7001', '7003']), seen);
  check('opening a thread makes no sidebar requests', !after.some((x) => x.path === '/orders/all' || x.path === '/api/order-chat/conversations' || x.path === '/api/order-chat/unread-count' || (x.path === '/api/order-chat/history' && x.query.size === '1')), after.map((x) => x.path));
  let l2 = await items(page);
  check('opened conversation\'s unread badge clears', l2.find((i) => i.ord.includes('2003'))?.unread === '', l2.find((i) => i.ord.includes('2003')));
  check('nav unread total drops to 1', (await navBadge(page)) === '1', await navBadge(page));

  // Live updates over the socket, against the merged data.
  await page.waitForFunction(() => window.__subscribed('/topic/chat/2003'), { timeout: 8000 }).catch(() => {});
  const wsBefore = await page.evaluate(() => window.__wsSends);
  await page.evaluate((now) => window.__deliver('/user/queue/messages', { messageId: 7101, orderId: 2010, senderId: 550, senderRole: 'STUDENT', senderName: 'Wade Morgan', message: 'One more question about week 3', messageType: 'TEXT', createdAt: now, seen: false }), Date.now());
  await sleep(400);
  l2 = await items(page);
  const w = l2.find((i) => i.ord.includes('2010'));
  check('live message on another order: preview updates', w?.prev === 'One more question about week 3', w);
  check('live message on another order: unread count goes up', w?.unread === '1', w);
  check('live message on another order: moves up with the unread threads', l2.slice(0, 2).some((i) => i.ord.includes('2010')), l2.slice(0, 3).map((i) => i.ord));
  check('nav unread total follows (2)', (await navBadge(page)) === '2', await navBadge(page));
  // An admin's message on another order (e.g. from another tab): preview and
  // time update, unread does not, and it never invents a row for an unknown order.
  await page.evaluate((now) => {
    window.__deliver('/user/queue/messages', { messageId: 7150, orderId: 2010, senderId: 3, senderRole: 'ADMIN', senderName: 'Support Team', message: 'Sure — week 3 is covered.', messageType: 'TEXT', createdAt: now, seen: false });
    window.__deliver('/user/queue/messages', { messageId: 7151, orderId: 3333, senderId: 3, senderRole: 'ADMIN', senderName: 'Support Team', message: 'stray', messageType: 'TEXT', createdAt: now, seen: false });
  }, Date.now());
  await sleep(400);
  l2 = await items(page);
  const w2 = l2.find((i) => i.ord.includes('2010'));
  check('admin message on another order: preview and time update', w2?.prev === 'Sure — week 3 is covered.' && w2?.time === 'now', w2);
  check('admin message on another order: unread count unchanged', w2?.unread === '1' && (await navBadge(page)) === '2', { w2, nav: await navBadge(page) });
  check('admin message for an order not in the list adds no row', !l2.some((i) => i.ord.includes('3333')) && l2.length === 60, l2.length);
  const seenBefore = log.filter((x) => x.path.startsWith('/api/order-chat/seen/')).length;
  await page.evaluate((now) => window.__deliver('/topic/chat/2003', { messageId: 7102, orderId: 2003, senderId: 557, senderRole: 'STUDENT', senderName: 'Chyna Brooks', message: 'Thank you!', messageType: 'TEXT', createdAt: now, seen: false }), Date.now());
  await sleep(500);
  const inThread = await page.evaluate(() => [...document.querySelectorAll('.ch-bubble')].some((b) => b.textContent.includes('Thank you!')));
  check('live message in the open thread is shown', inThread);
  check('…and marked seen (one more markSeen)', log.filter((x) => x.path.startsWith('/api/order-chat/seen/')).length === seenBefore + 1);
  l2 = await items(page);
  check('…and does not raise its unread badge', l2.find((i) => i.ord.includes('2003'))?.unread === '', l2.find((i) => i.ord.includes('2003')));
  check('no extra socket traffic from receiving (no frames sent)', (await page.evaluate(() => window.__wsSends)) === wsBefore);

  // No polling, no request loop.
  const quietFrom = log.length;
  await sleep(3500);
  const later = log.slice(quietFrom).map((x) => x.path);
  check('no polling or request loop while idle (3.5s)', later.length === 0, later);
  check('no page errors', errors.length === 0, errors.slice(0, 2));
  await ctx.close();
}

// ── 2. Deep link straight into a conversation ───────────────────────────────
console.log('\nDeep link /admin/chat?order=2003');
{
  const { ctx, page } = await openChat('/admin/chat?order=2003');
  await page.waitForFunction(() => [...document.querySelectorAll('.ch-bubble')].length > 0, { timeout: 8000 }).catch(() => {});
  await sleep(300);
  check('still one orders + one summary request', count('/orders/all', (x) => x.query.size === '60') === 1 && count('/api/order-chat/conversations') === 1, log.map((x) => x.path));
  check('the opened thread loads with one history/all', count('/api/order-chat/history/all') === 1);
  check('no per-order requests', perOrder() === 0, perOrder());
  const l = await items(page);
  check('deep-linked conversation shows as read in the sidebar', l.find((i) => i.ord.includes('2003'))?.unread === '', l.find((i) => i.ord.includes('2003')));
  await ctx.close();
}
console.log('\nDeep link, summary arriving after the thread (race)');
mode = 'slow';
{
  const { ctx, page } = await openChat('/admin/chat?order=2003');
  await page.waitForFunction(() => [...document.querySelectorAll('.ch-item-prev')].some((n) => n.textContent === 'Can you confirm the price?'), { timeout: 8000 }).catch(() => {});
  await sleep(300);
  const hist = log.find((x) => x.path === '/api/order-chat/history/all');
  const conv = log.find((x) => x.path === '/api/order-chat/conversations');
  check('history/all was answered before the summary arrived', !!hist && !!conv);
  const l = await items(page);
  check('the open conversation gets no badge back from the late summary (it says 2 unread)', l.find((i) => i.ord.includes('2003'))?.unread === '', l.find((i) => i.ord.includes('2003')));
  check('other rows still take their unread count from it (OD-2020: 1)', l.find((i) => i.ord.includes('2020'))?.unread === '1');
  check('nav unread total excludes the open conversation (1)', (await navBadge(page)) === '1', await navBadge(page));
  await ctx.close();
}
mode = 'ok';

// ── 3. Bulk endpoint missing or broken: degrade visibly, never fan out ──────
for (const m of ['404', '403', 'html']) {
  console.log(`\nSummary endpoint → ${m === 'html' ? 'HTML page (200)' : m}`);
  mode = m;
  const { ctx, page, errors } = await openChat('/admin/chat');
  if (m === '404') await shot(page, 'sidebar-summary-unavailable');
  const list = await items(page);
  check('orders are still listed', list.length === 60, list.length);
  check('NO fallback to per-order requests', perOrder() === 0, perOrder());
  check('the summary was tried once, not retried in a loop', count('/api/order-chat/conversations') === 1, count('/api/order-chat/conversations'));
  const note = await page.$eval('.ch-list .note', (n) => n.textContent).catch(() => '');
  check('sidebar says previews and unread counts are unavailable', /previews and unread counts could not be loaded/i.test(note), note);
  check('rows say "Preview unavailable", not "No messages yet"', list.every((i) => i.prev === 'Preview unavailable'), list.slice(0, 2));
  check('still on the chat page — not signed out', new URL(page.url()).pathname === '/admin/chat' && !!(await page.evaluate(() => localStorage.getItem('token'))), page.url());
  if (m === '404') {
    // A conversation still opens normally.
    await (await page.$('.ch-item')).click();
    await page.waitForFunction(() => document.querySelector('.ch-input'), { timeout: 8000 }).catch(() => {});
    check('a conversation still opens (history/all)', count('/api/order-chat/history/all') === 1);
    // Retry once the endpoint works (slowly): the bulk endpoint only.
    mode = 'slow';
    const before = log.length;
    await page.click('.ch-list .note .act');
    await sleep(300);
    const during = { rows: (await items(page)).length, label: await page.$eval('.ch-list .note .act', (b) => b.textContent.trim()).catch(() => '') };
    check('while retrying, the orders stay on screen (no sidebar skeleton)', during.rows === 60, during);
    check('while retrying, the button says so and is disabled', /Retrying/.test(during.label) && await page.$eval('.ch-list .note .act', (b) => b.disabled).catch(() => false), during.label);
    await page.waitForFunction(() => !document.querySelector('.ch-list .note'), { timeout: 8000 }).catch(() => {});
    await sleep(300);
    const retry = log.slice(before).map((x) => x.path);
    check('Retry → exactly ONE summary request and NO order-list request', retry.filter((p) => p === '/api/order-chat/conversations').length === 1 && !retry.includes('/orders/all') && perOrder() === 0, retry);
    check('Retry makes no history/all or markSeen calls', !retry.some((p) => p === '/api/order-chat/history/all' || p.startsWith('/api/order-chat/seen/')), retry);
    const l = await items(page);
    check('after Retry the previews and unread counts appear', l.some((i) => i.prev === 'Can you confirm the price?') && l.find((i) => i.ord.includes('2003'))?.unread === '2' && !(await page.$('.ch-list .note')), l.slice(0, 2));
    check('after Retry the rows are still the same 60 orders', l.length === 60, l.length);
    mode = '404';
  }
  check('no page errors', errors.length === 0, errors.slice(0, 2));
  await ctx.close();
}


// ── 5. Thread fixes from the code recheck ───────────────────────────────────
console.log('\nThread behaviour');
mode = 'ok';
{
  const { ctx, page, errors } = await openChat('/admin/chat');
  const clickRow = async (id) => {
    for (const el of await page.$$('.ch-item')) {
      if ((await el.$eval('.ch-item-ord', (n) => n.textContent)).includes(String(id))) { await el.click(); return true; }
    }
    return false;
  };
  const bubbles = () => page.$$eval('.ch-bubble .ch-text', (els) => els.map((e) => e.textContent));
  const headerSub = () => page.$eval('.ch-head-sub', (n) => n.textContent.trim()).catch(() => '');

  // Pin from the keyboard pins; it does not open the conversation.
  const firstOrd = await page.$eval('.ch-item .ch-item-ord', (n) => n.textContent);
  const histBefore = count('/api/order-chat/history/all');
  await page.focus('.ch-item .ch-pin');
  await page.keyboard.press('Enter');
  await sleep(300);
  const pinned = await page.$$eval('.ch-item', (els, ord) => {
    const row = els.find((el) => el.querySelector('.ch-item-ord')?.textContent === ord);
    return row?.querySelector('.ch-pin')?.getAttribute('aria-pressed');
  }, firstOrd);
  check('Enter on a row\'s pin button pins it', pinned === 'true', pinned);
  check('…and does not open the conversation', count('/api/order-chat/history/all') === histBefore);

  // Open 2003, see presence, type a draft.
  await clickRow(2003);
  await page.waitForFunction(() => document.querySelectorAll('.ch-bubble').length >= 3, { timeout: 8000 }).catch(() => {});
  await page.waitForFunction(() => window.__subscribed('/topic/chat/2003'), { timeout: 8000 }).catch(() => {});
  await page.evaluate(() => window.__deliver('/topic/presence', { userId: 557, online: true }));
  await sleep(200);
  check('presence shows for the open student', /Online/.test(await headerSub()), await headerSub());

  // Typing: our own echo is ignored, the student's shows.
  await page.evaluate(() => window.__deliver('/topic/chat/2003/typing', { orderId: 2003, senderId: 3, senderName: 'Support Team', typing: true }));
  await sleep(200);
  check('own typing echo is not shown', !(await page.$('.ch-typing')));
  await page.evaluate(() => window.__deliver('/topic/chat/2003/typing', { orderId: 2003, senderId: 557, senderName: 'Chyna Brooks', typing: true }));
  await sleep(200);
  check('the student\'s typing is shown', /Chyna Brooks is typing/.test(await page.$eval('.ch-typing', (n) => n.textContent).catch(() => '')));

  // Escape outside the composer leaves queued files alone; inside it clears them.
  const pdf = path.join(os.tmpdir(), 'brief.pdf');
  fs.writeFileSync(pdf, '%PDF-1.4\n');
  await (await page.$('input[type="file"]')).uploadFile(pdf);
  await page.waitForSelector('.ch-queue', { timeout: 4000 }).catch(() => {});
  await page.focus('.ch-list input');
  await page.keyboard.press('Escape');
  await sleep(150);
  check('Escape outside the composer keeps the queued file', !!(await page.$('.ch-queue')));
  await page.focus('.ch-input');
  await page.keyboard.press('Escape');
  await sleep(150);
  check('Escape in the composer clears the queued file', !(await page.$('.ch-queue')));

  await page.type('.ch-input', 'Draft for Chyna');

  // Switch to 2010: slow history, a live message arrives meanwhile.
  await clickRow(2010);
  await sleep(100);
  check('switching threads does not carry the draft over', (await page.$eval('.ch-input', (el) => el.value)) === '');
  check('presence resets for the next student', !/Online/.test(await headerSub()), await headerSub());
  await page.waitForFunction(() => window.__subscribed('/topic/chat/2010'), { timeout: 8000 }).catch(() => {});
  await page.evaluate((now) => window.__deliver('/topic/chat/2010', { messageId: 7299, orderId: 2010, senderId: 550, senderRole: 'STUDENT', senderName: 'Wade Morgan', message: 'Live while loading', messageType: 'TEXT', createdAt: now, seen: false }), Date.now());
  await sleep(1300);
  const b2010 = await bubbles();
  check('history that lands after a live message keeps both', b2010.includes('Earlier question') && b2010.includes('Live while loading'), b2010);
  check('the thread is not left showing the loading skeleton', !(await page.$('.ch-body .skel, .ch-body [class*="skeleton"]')));

  // Back to 2003: the draft comes back.
  await clickRow(2003);
  await sleep(300);
  check('returning to a thread restores its draft', (await page.$eval('.ch-input', (el) => el.value)) === 'Draft for Chyna', await page.$eval('.ch-input', (el) => el.value));

  // Load earlier on 2004, then switch before the page arrives.
  await clickRow(2004);
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => /Load earlier/.test(b.textContent)), { timeout: 8000 }).catch(() => {});
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /Load earlier/.test(b.textContent))?.click());
  await sleep(100);
  await clickRow(2003);
  await sleep(1300);
  const b2003 = await bubbles();
  check('"Load earlier" for one order never lands in another order\'s thread', !b2003.includes('Older 2004 message') && b2003.includes('Hi, I sent the syllabus.'), b2003);

  // Manual Retry after a STOMP failure re-subscribes the open thread.
  const socketsBefore = await page.evaluate(() => window.__sockets);
  await page.evaluate(() => window.__stompError());
  await page.waitForSelector('.ch-conn-retry', { timeout: 5000 }).catch(() => {});
  await page.click('.ch-conn-retry').catch(() => {});
  await page.waitForFunction((n) => window.__sockets > n, { timeout: 8000 }, socketsBefore).catch(() => {});
  await sleep(600);
  check('after Retry the open thread is subscribed again', await page.evaluate(() => window.__subscribed('/topic/chat/2003')),
    await page.evaluate(() => window.__sockets));
  check('no page errors', errors.length === 0, errors.slice(0, 2));
  await ctx.close();
}

console.log('\nLive message while the sidebar is loading');
mode = 'slow';
{
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.evaluateOnNewDocument(installSocketPeer);
  await page.evaluateOnNewDocument((t) => {
    localStorage.setItem('token', t); localStorage.setItem('refreshToken', 'r'); localStorage.setItem('userId', '3');
    localStorage.setItem('userRole', 'SUPER_ADMIN'); localStorage.setItem('userEmail', 'ravi.sharma@qtiservices.com');
  }, jwt(3, 'SUPER_ADMIN'));
  await page.setRequestInterception(true);
  page.on('request', (r) => respond(r, new URL(BASE).origin));
  log.length = 0;
  await page.goto(`${BASE}/admin/chat`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__subscribed?.('/user/queue/messages'), { timeout: 10000 }).catch(() => {});
  const listedEarly = await page.$$eval('.ch-item', (els) => els.length);
  await page.evaluate((now) => window.__deliver('/user/queue/messages', { messageId: 7401, orderId: 2010, senderId: 550, senderRole: 'STUDENT', senderName: 'Wade Morgan', message: 'Arrived during load', messageType: 'TEXT', createdAt: now, seen: false }), Date.now());
  await page.waitForFunction(() => document.querySelectorAll('.ch-item').length >= 60, { timeout: 10000 }).catch(() => {});
  await sleep(300);
  const l = await items(page);
  const w = l.find((i) => i.ord.includes('2010'));
  check('the message arrived before the list had loaded', listedEarly < 60, listedEarly);
  check('it is not lost when the (older) summary lands: preview kept', w?.prev === 'Arrived during load', w);
  check('…and its unread count is kept (summary said 0)', w?.unread === '1', w);
  check('nav total includes it (2 + 1 + 1 = 4)', (await navBadge(page)) === '4', await navBadge(page));
  await ctx.close();
}
mode = 'ok';

// ── 4. Orders failing is still a list error, with Retry ─────────────────────
console.log('\nOrder list fails');
mode = 'orders-fail';
{
  const { ctx, page } = await openChat('/admin/chat');
  const txt = await page.$eval('.ch-list-body', (n) => n.textContent).catch(() => '');
  check('the existing error state is shown', /Orders service unavailable/.test(txt), txt.slice(0, 120));
  check('no per-order requests', perOrder() === 0, perOrder());
  await ctx.close();
}

await browser.close();
console.log(`\n  ${passed}/${passed + failed} passed`);
process.exit(failed ? 1 : 0);
