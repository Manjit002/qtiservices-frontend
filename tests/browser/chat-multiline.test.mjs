/**
 * Admin / Super Admin chat — multiline messages keep their line breaks.
 *
 * Drives the real chat page (/admin/chat) in headless Chrome, signed in as
 * ADMIN and then as SUPER_ADMIN, on a desktop and a phone viewport. Messages
 * are typed into the composer with real keystrokes (Shift+Enter for a new
 * line) and sent with the real Send button, so every stage of the app's own
 * code runs:
 *
 *   textarea → send() → useChatSocket.sendMessage → STOMP SEND frame
 *            → broadcast back on /topic/chat/{orderId} → message state
 *            → MessageBubble → what the browser actually renders
 *
 * TEST SCAFFOLDING ONLY — nothing here ships. The backend is not reachable
 * from the test machine, so the network edge is scripted: REST calls are
 * answered by request interception, and the SockJS socket is replaced by a
 * tiny in-page STOMP peer. That peer records every frame the app sends and
 * broadcasts each chat message back unchanged, as the Spring backend does.
 * The app's code is not modified or mocked.
 *
 * For each message it checks three stages separately, so a failure says
 * WHERE the line breaks were lost:
 *   payload   — the JSON body of the STOMP SEND frame, compared exactly
 *   state     — the DOM text node (textContent), i.e. the stored string
 *   rendered  — innerText, which reflects CSS: collapsed whitespace shows up
 *               here as spaces even when the string itself is intact
 *
 *   BASE=http://localhost:7600 [OUT=/tmp/chat-shots] node chat-multiline.test.mjs
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

let passed = 0, failed = 0;
const check = (name, ok, detail) => {
  if (ok) passed += 1; else failed += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail !== undefined ? `  → ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`);
};
const show = (s) => JSON.stringify(s);

// ── The brief's test messages ───────────────────────────────────────────────
const BUSINESS = [
  'Hi Chyna,',
  '',
  'Thank you for submitting your',
  'Texas Real Estate Courses full',
  'online class request.',
  '',
  'To review your class and provide',
  'an accurate quote, please share',
  'the following:',
  '',
  '* University/College name',
  '* Course name and course code',
  '* Course duration (number of weeks)',
  '* Syllabus or course link (if available)',
  '* Student portal login details',
  '',
  'Once we receive the above information, our academic team',
  'will review the class and send you the pricing along with',
  'the next steps.',
  '',
  'Looking forward to your response.',
  '',
  'Best regards,',
  'David Thomas',
  'Sales Supervisor',
  'QTI Services',
].join('\n');

const LONG = [
  BUSINESS,
  '',
  'A note on timing: once the syllabus is in, the review usually takes one business day, and we will confirm every deadline in this chat before any work starts so nothing is assumed on either side.',
  '',
  '',
  'Reference link (paste it into your browser if it does not open):',
  'https://www.example.edu/courses/real-estate/principles-of-real-estate-i/syllabus-and-weekly-schedule-fall-term-2026-section-004.pdf',
  '',
  // One long token with no break opportunity at all, to prove it wraps inside the bubble.
  'Ref:QTI2026RELE1300PrinciplesOfRealEstateOneLoneStarCollegeFallTermSection004StudentPortalAccessRequest',
].join('\n');

const CASES = [
  ['TC1 simple newlines', 'Hello\nWorld'],
  ['TC2 blank line', 'Hello\n\nWorld'],
  ['TC3 multiple paragraphs', 'Hello,\n\nThis is paragraph one.\n\nThis is paragraph two.\n\nBest regards,\nQTI Services'],
  ['TC4 bullet list', '* University/College name\n* Course name\n* Course duration\n* Course link'],
  ['TC5 business message', BUSINESS],
  ['TC9 long message', LONG],
];

// Messages the student side sends, as the backend returns them.
const STUDENT_HISTORY = 'Hello,\n\nI need help with my Texas Real Estate course.\n\n* 8 weeks\n* Starts Monday\n\nThanks,\nChyna';
const STUDENT_LIVE = 'Here are the details:\n\n* Lone Star College\n* RELE 1300 — Principles of Real Estate I\n\n\nPortal login to follow.';

// ── Fixtures for the REST calls the chat page makes ─────────────────────────
const ORDER = 1041;
const NOW = Date.now();
const ldt = (off) => new Date(NOW + off).toISOString().slice(0, 19);
const history = [
  { messageId: 901, orderId: ORDER, senderId: 501, senderRole: 'STUDENT', senderName: 'Chyna Brooks', message: STUDENT_HISTORY, messageType: 'TEXT', createdAt: NOW - 3_600_000, seen: true, delivered: true },
];
const orderRow = { id: ORDER, subject: 'Texas Real Estate Courses — full class', status: 'PRICE_PENDING', studentId: 501, createdAt: ldt(-86_400_000) };

function respond(r, origin) {
  const u = new URL(r.url());
  const h = r.headers();
  const isRsc = h.rsc || h['next-router-prefetch'] || h['next-router-state-tree'] || u.searchParams.has('_rsc');
  if (u.hostname.endsWith('googleapis.com') || u.hostname.endsWith('gstatic.com')) return r.respond({ status: 200, contentType: 'text/css', body: '' });
  const json = (status, body, extra = {}) => r.respond({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true', ...extra }, body: JSON.stringify(body) });
  if (u.pathname.endsWith('/ws/chat/info')) return json(200, { websocket: true, origins: ['*:*'], cookie_needed: false, entropy: 42 });
  if (isRsc || !['fetch', 'xhr', 'eventsource'].includes(r.resourceType())) return r.continue();
  const p = u.pathname;
  if (r.method() === 'POST' && p === '/api/order-chat/upload') return json(200, { fileKey: 'chat/test/syllabus.pdf', fileName: 'syllabus.pdf', contentType: 'application/pdf', fileSize: 1024 });
  if (r.method() === 'POST' && p.startsWith('/api/order-chat/seen/')) return json(200, {});
  if (p === '/orders/all') return json(200, { content: [orderRow], totalElements: 1, totalPages: 1, number: 0, size: 20, last: true, first: true, empty: false });
  if (p === '/api/order-chat/conversations') return json(200, [{ orderId: ORDER, studentId: 501, studentName: 'Chyna Brooks', lastMessage: STUDENT_HISTORY, lastMessageTime: NOW - 3_600_000, unreadCount: 0, hasConversation: true }]);
  if (p === '/api/order-chat/history/all') return json(200, history);
  if (p === '/api/order-chat/history') return json(200, { content: history.slice(-1), totalElements: history.length, totalPages: 1, number: 0, size: 1, last: true });
  if (p === '/api/order-chat/unread-count') return json(200, 0);
  // Anything else: 503, never 401/403 — those would trigger the client's logout path.
  return json(503, { message: 'test stub' });
}

/**
 * In-page stand-in for the SockJS endpoint: a minimal STOMP 1.2 peer. Installed
 * before any app script runs, so sockjs-client picks it up as `WebSocket`.
 */
function installSocketPeer() {
  const subs = new Map();
  let sock = null; let seq = 0;
  window.__frames = []; window.__sent = [];
  const frame = (cmd, headers, body = '') =>
    `${cmd}\n${Object.entries(headers).map(([k, v]) => `${k}:${v}`).join('\n')}\n\n${body}\0`;
  const toClient = (f) => sock?.onmessage?.({ data: `a${JSON.stringify([f])}` });
  window.__deliver = (destination, obj) => {
    const id = subs.get(destination);
    if (id == null) return false;
    toClient(frame('MESSAGE', { destination, subscription: id, 'message-id': `m${++seq}`, 'content-type': 'application/json' }, JSON.stringify(obj)));
    return true;
  };
  window.__subscribed = (d) => subs.has(d);
  class PeerSocket {
    constructor(url) {
      this.url = url; this.readyState = 0; this.protocol = ''; this.extensions = ''; this.bufferedAmount = 0;
      sock = this;
      setTimeout(() => { this.readyState = 1; this.onopen?.({ type: 'open' }); this.onmessage?.({ data: 'o' }); }, 20);
    }
    send(data) {
      for (const raw of JSON.parse(data)) {
        for (const chunk of String(raw).split('\0')) {
          const f = chunk.replace(/^[\r\n]+/, '');
          if (!f) continue;
          const i = f.indexOf('\n\n');
          const head = (i < 0 ? f : f.slice(0, i)).split('\n');
          const cmd = head.shift();
          const h = {};
          for (const l of head) { const k = l.indexOf(':'); if (k > 0) h[l.slice(0, k)] = l.slice(k + 1); }
          const body = i < 0 ? '' : f.slice(i + 2);
          window.__frames.push({ cmd, h, body });
          if (cmd === 'CONNECT' || cmd === 'STOMP') toClient(frame('CONNECTED', { version: '1.2', 'heart-beat': '0,0' }));
          else if (cmd === 'SUBSCRIBE') subs.set(h.destination, h.id);
          else if (cmd === 'UNSUBSCRIBE') { for (const [d, id] of subs) if (id === h.id) subs.delete(d); }
          else if (cmd === 'SEND') window.__sent.push({ destination: h.destination, body });
          else if (cmd === 'DISCONNECT' && h.receipt) toClient(frame('RECEIPT', { 'receipt-id': h.receipt }));
        }
      }
    }
    close() { this.readyState = 3; this.onclose?.({ code: 1000, reason: '', wasClean: true }); }
  }
  PeerSocket.CONNECTING = 0; PeerSocket.OPEN = 1; PeerSocket.CLOSING = 2; PeerSocket.CLOSED = 3;
  window.WebSocket = PeerSocket;
}

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (sub, role) => `${b64({ alg: 'HS256' })}.${b64({ sub: String(sub), role, exp: Math.floor(NOW / 1000) + 3600 })}.sig`;

const pdf = path.join(os.tmpdir(), 'syllabus.pdf');
fs.writeFileSync(pdf, '%PDF-1.4\n% chat attachment test\n');

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  phone: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
};
const ROLES = [['ADMIN', 7, 'nina.patel@qtiservices.com'], ['SUPER_ADMIN', 3, 'ravi.sharma@qtiservices.com']];

const browser = await puppeteer.launch({ args: chromium.args.filter((a) => a !== '--single-process'), executablePath: await chromium.executablePath(), headless: true });

// ── Helpers that act on the real UI ─────────────────────────────────────────
async function typeMultiline(page, text) {
  await page.focus('.ch-input');
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i]) await page.keyboard.type(lines[i]);
    if (i < lines.length - 1) {
      await page.keyboard.down('Shift'); await page.keyboard.press('Enter'); await page.keyboard.up('Shift');
    }
  }
}
const chatSends = (page) => page.evaluate(() => window.__sent.filter((s) => s.destination === '/app/chat.send').map((s) => s.body));
async function waitForSend(page, before) {
  await page.waitForFunction((n) => window.__sent.filter((s) => s.destination === '/app/chat.send').length > n, { timeout: 8000 }, before);
  const all = await chatSends(page);
  return JSON.parse(all[all.length - 1]);
}
let nextId = 2000;
/** Broadcast back exactly what was sent, as the backend does on /topic/chat/{id}. */
async function echo(page, payload, adminId) {
  const msg = {
    messageId: nextId += 1, orderId: payload.orderId, senderId: adminId, senderRole: payload.senderRole, senderName: 'Support Team',
    message: payload.message, messageType: payload.messageType, replyToMessageId: payload.replyToMessageId,
    fileKey: payload.fileKey, fileName: payload.fileName, contentType: payload.contentType, fileSize: payload.fileSize,
    fileUrl: payload.fileKey ? 'https://files.example.invalid/syllabus.pdf' : null,
    createdAt: Date.now(), seen: false, delivered: true,
  };
  await page.evaluate((m) => window.__deliver(`/topic/chat/${m.orderId}`, m), msg);
  return msg.messageId;
}
/** Find the element in a bubble whose text is exactly `text`, and report how it renders. */
async function rendered(page, text, { mine }) {
  await page.waitForFunction((t, mine) => [...document.querySelectorAll(`.ch-row${mine ? '.mine' : ':not(.mine)'} .ch-bubble *`)]
    .some((el) => el.children.length === 0 && el.textContent === t), { timeout: 8000 }, text, mine).catch(() => {});
  return page.evaluate((t, mine) => {
    const el = [...document.querySelectorAll(`.ch-row${mine ? '.mine' : ':not(.mine)'} .ch-bubble *`)]
      .reverse().find((e) => e.children.length === 0 && e.textContent === t);
    if (!el) {
      const bubbles = [...document.querySelectorAll('.ch-bubble')].map((b) => b.textContent.slice(0, 60));
      return { found: false, bubbles };
    }
    const bubble = el.closest('.ch-bubble');
    const cs = getComputedStyle(el);
    const lh = parseFloat(cs.lineHeight);
    const r = el.getBoundingClientRect();
    const br = bubble.getBoundingClientRect();
    const thread = bubble.closest('.ch-msgs, .ch-thread-inner, .ch-thread') ?? document.body;
    const tr = thread.getBoundingClientRect();
    return {
      found: true,
      innerText: el.innerText,
      whiteSpace: cs.whiteSpace,
      lines: Math.round(r.height / lh),
      textOverflows: el.scrollWidth > el.clientWidth + 1,
      bubbleOutside: br.right > tr.right + 1 || br.left < tr.left - 1,
      pageOverflows: document.documentElement.scrollWidth > window.innerWidth + 1,
    };
  }, text, mine);
}
function checkRendered(label, text, r, vw) {
  if (!r.found) { check(`${label}: bubble rendered`, false, r.bubbles); return; }
  check(`${label}: state keeps the exact string (textContent)`, true);
  check(`${label}: renders line for line (innerText)`, r.innerText === text, `white-space:${r.whiteSpace} → ${show(r.innerText.slice(0, 90))}`);
  const minLines = text.split('\n').length;
  check(`${label}: occupies ≥ ${minLines} lines`, r.lines >= minLines, `${r.lines} lines`);
  check(`${label}: wraps inside its bubble, no sideways overflow (${vw})`, !r.textOverflows && !r.bubbleOutside && !r.pageOverflows,
    { textOverflows: r.textOverflows, bubbleOutside: r.bubbleOutside, pageOverflows: r.pageOverflows });
}

// ── Run ─────────────────────────────────────────────────────────────────────
for (const [role, adminId, email] of ROLES) {
  for (const [vw, viewport] of Object.entries(VIEWPORTS)) {
    console.log(`\n${role} — ${vw}`);
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport(viewport);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.evaluateOnNewDocument(installSocketPeer);
    await page.evaluateOnNewDocument((t, r, u, e) => {
      localStorage.setItem('token', t); localStorage.setItem('refreshToken', 'r'); localStorage.setItem('userId', String(u));
      localStorage.setItem('userRole', r); localStorage.setItem('userEmail', e); localStorage.setItem('qti_theme', 'dark');
    }, jwt(adminId, role), role, adminId, email);
    await page.setRequestInterception(true);
    page.on('request', (r) => respond(r, new URL(BASE).origin));

    await page.goto(`${BASE}/admin/chat?order=${ORDER}`, { waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});
    const connected = await page.waitForFunction(
      (o) => document.querySelector('.ch-input')?.placeholder === 'Type a message…' && window.__subscribed(`/topic/chat/${o}`),
      { timeout: 15000 }, ORDER).then(() => true, () => false);
    check('chat page opens, socket connects and subscribes to the order', connected, page.url());
    if (!connected) { await ctx.close(); continue; }

    // TC8 — received: the student's multiline message from history.
    checkRendered('TC8 received (history)', STUDENT_HISTORY, await rendered(page, STUDENT_HISTORY, { mine: false }), vw);

    // TC1–5, TC9 — typed with Shift+Enter, sent with the Send button.
    for (const [label, text] of CASES) {
      const before = (await chatSends(page)).length;
      await typeMultiline(page, text);
      const draft = await page.$eval('.ch-input', (el) => el.value);
      check(`${label}: composer holds the newlines before send`, draft === text, show(draft.slice(0, 80)));
      await page.click('.ch-send');
      const payload = await waitForSend(page, before).catch(() => null);
      check(`${label}: STOMP payload carries the exact text`, payload?.message === text, show(payload?.message?.slice(0, 80)));
      check(`${label}: payload shape unchanged (TEXT, ${role} sends as ADMIN)`, payload?.messageType === 'TEXT' && payload?.senderRole === 'ADMIN' && payload?.orderId === ORDER, payload);
      check(`${label}: composer cleared after send`, (await page.$eval('.ch-input', (el) => el.value)) === '');
      if (!payload) continue;
      await echo(page, payload, adminId);
      const r = await rendered(page, text, { mine: true });
      checkRendered(`${label} as shown after send`, text, r, vw);
      if (OUT && label.startsWith('TC5') && r.found) {
        const handle = await page.evaluateHandle((t) => [...document.querySelectorAll('.ch-row.mine .ch-bubble')].reverse()
          .find((b) => [...b.querySelectorAll('*')].some((e) => e.children.length === 0 && e.textContent === t)), text);
        await handle.asElement()?.screenshot({ path: `${OUT}/${role.toLowerCase()}-${vw}-business-bubble.png` }).catch(() => {});
      }
    }

    // TC8 — received live over the socket while the thread is open.
    await page.evaluate((o, m) => window.__deliver(`/topic/chat/${o}`, { messageId: 3000 + Math.floor(Math.random() * 1000), orderId: o, senderId: 501, senderRole: 'STUDENT', senderName: 'Chyna Brooks', message: m, messageType: 'TEXT', createdAt: Date.now(), seen: false, delivered: true }), ORDER, STUDENT_LIVE);
    checkRendered('TC8 received (live)', STUDENT_LIVE, await rendered(page, STUDENT_LIVE, { mine: false }), vw);

    // Existing composer convention is unchanged: Shift+Enter = new line, Enter = send.
    {
      const before = (await chatSends(page)).length;
      await page.focus('.ch-input');
      await page.keyboard.type('line a');
      await page.keyboard.down('Shift'); await page.keyboard.press('Enter'); await page.keyboard.up('Shift');
      await page.keyboard.type('line b');
      await new Promise((r) => setTimeout(r, 300));
      const stillDraft = await page.$eval('.ch-input', (el) => el.value);
      check('Shift+Enter adds a new line and does not send', stillDraft === 'line a\nline b' && (await chatSends(page)).length === before, show(stillDraft));
      await page.keyboard.press('Enter');
      const payload = await waitForSend(page, before).catch(() => null);
      check('Enter sends, as before (existing convention kept)', payload?.message === 'line a\nline b', show(payload?.message));
      if (payload) { await echo(page, payload, adminId); await rendered(page, payload.message, { mine: true }); }
    }

    // Only accidental outer whitespace is trimmed; inner blank lines and indentation stay.
    {
      const before = (await chatSends(page)).length;
      await typeMultiline(page, '   \nHello\n\n    indented line\n  ');
      await page.click('.ch-send');
      const payload = await waitForSend(page, before).catch(() => null);
      check('outer whitespace trimmed, inner blank line and indentation kept', payload?.message === 'Hello\n\n    indented line', show(payload?.message));
      if (payload) {
        await echo(page, payload, adminId);
        checkRendered('indentation', payload.message, await rendered(page, payload.message, { mine: true }), vw);
      }
    }

    // Attachment with a multiline caption: upload, then publish with the caption.
    {
      const before = (await chatSends(page)).length;
      const caption = 'Syllabus attached.\n\n* Week 1–4: principles\n* Week 5–8: practice';
      const input = await page.$('input[type="file"]');
      await input.uploadFile(pdf);
      await page.waitForSelector('.ch-queue', { timeout: 5000 }).catch(() => {});
      await typeMultiline(page, caption);
      await page.click('.ch-send');
      const payload = await waitForSend(page, before).catch(() => null);
      check('attachment: uploaded file is published with its key', payload?.fileKey === 'chat/test/syllabus.pdf' && payload?.messageType === 'DOCUMENT', payload);
      check('attachment: caption keeps its line breaks in the payload', payload?.message === caption, show(payload?.message));
      if (payload) {
        await echo(page, payload, adminId);
        const r = await rendered(page, caption, { mine: true });
        checkRendered('attachment caption', caption, r, vw);
        const fileShown = await page.evaluate(() => [...document.querySelectorAll('.ch-row.mine .ch-file')].some((a) => a.textContent.includes('syllabus.pdf')));
        check('attachment: file card still rendered above the caption', fileShown);
      }
    }

    // One-line surfaces stay one line by design: the conversation preview.
    const prev = await page.evaluate(() => { const el = document.querySelector('.ch-item-prev'); return el ? getComputedStyle(el).whiteSpace : 'absent'; });
    if (prev !== 'absent') check('conversation preview stays a single line', prev === 'nowrap', prev);

    check('no page errors', errors.length === 0, errors.slice(0, 2));
    await ctx.close();
  }
}

await browser.close();
console.log(`\n  ${passed}/${passed + failed} passed`);
process.exit(failed ? 1 : 0);
