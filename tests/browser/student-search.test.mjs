/**
 * Admin Students page → GET /admin/students/search?keyword=&searchType=id|email
 *
 * Drives the real page (/admin/students) as ADMIN and SUPER_ADMIN, desktop and
 * phone, and checks the exact requests made and what is shown for: student ID,
 * "ID-" prefixed ID, email (mixed case, "+" needing encoding, padded with
 * spaces), empty and non-ID/non-email input, a second search, not found (message
 * and bare 404), backend validation, server error, slow response (loading and
 * duplicate prevention), 403, 401, and orders failing after the profile loads.
 *
 * TEST SCAFFOLDING ONLY — the backend is not reachable from the test machine,
 * so its responses are answered by request interception. Nothing here ships.
 *
 *   BASE=http://localhost:7600 node student-search.test.mjs
 */
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const BASE = process.env.BASE;
if (!BASE) { console.error('Set BASE, e.g. BASE=http://localhost:7600'); process.exit(2); }
const OUT = process.env.OUT ?? '';
if (OUT) fs.mkdirSync(OUT, { recursive: true });
const shot = (page, name) => (OUT ? page.screenshot({ path: `${OUT}/${name}.png` }).catch(() => {}) : null);

let passed = 0, failed = 0;
const check = (name, ok, detail) => {
  if (ok) passed += 1; else failed += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail !== undefined ? `  → ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Fixtures (backend stand-ins) ────────────────────────────────────────────
const CHYNA = { id: 263050, name: 'Chyna Brooks', email: 'chyna.brooks@gmail.com', phone: '+1 555 0100', country: 'United States', active: true, createdAt: '2026-03-01T10:00:00', walletBalance: 25.5 };
const WADE = { id: 263051, name: 'Wade Morgan', email: 'wade@example.com', phone: null, active: true };
const LENA = { id: 263052, name: 'Lena Ortiz', email: 'lena@example.com', phone: '+1 555 0102', active: false, walletBalance: 0 };
const SLOW = { id: 263053, name: 'Slow Student', email: 'slow@example.com', walletBalance: 1 };
const PLUS = { id: 263057, name: 'Plus Address', email: 'chyna+test@gmail.com', walletBalance: 2 };
const order = (id, studentId, studentEmail, subject) => ({ id, studentId, studentEmail, subject, assignmentType: 'Essay', status: 'IN_PROGRESS', price: 120, paymentStatus: 'PENDING', createdAt: '2026-04-01T09:00:00', deadline: '2026-11-01T09:00:00' });
// Full records, as GET /admin/orders/{id} returns them.
const ORD = {
  1101: order(1101, 263050, 'chyna.brooks@gmail.com', 'Real Estate Principles'),
  1102: order(1102, 263050, 'chyna.brooks@gmail.com', 'Real Estate Law'),
  1199: order(1199, 2630501, 'xchyna.brooks@gmail.com', 'Someone else entirely'),
  1201: order(1201, 263052, 'lena@example.com', 'Statistics Project'),
};
const slim = ({ id, subject, assignmentType, price, status, paymentStatus, deadline, createdAt }) => ({ id, subject, assignmentType, price, status, paymentStatus, deadline, createdAt });
let lenaOrdersFail = true;

function profileFor(keyword, type) {
  if (type === 'id') return { 263050: CHYNA, 263051: WADE, 263052: LENA, 263053: SLOW, 263057: PLUS }[keyword];
  const k = keyword.toLowerCase(); // the service lowercases before findByEmail
  return [CHYNA, WADE, LENA, SLOW, PLUS].find((s) => s.email === k);
}

function respond(r, log) {
  const u = new URL(r.url());
  const h = r.headers();
  const isRsc = h.rsc || h['next-router-prefetch'] || h['next-router-state-tree'] || u.searchParams.has('_rsc');
  if (u.hostname.endsWith('googleapis.com') || u.hostname.endsWith('gstatic.com')) return r.respond({ status: 200, contentType: 'text/css', body: '' });
  if (isRsc || !['fetch', 'xhr'].includes(r.resourceType())) return r.continue();
  const json = (status, body) => r.respond({ status, contentType: 'application/json', body: JSON.stringify(body) });
  const p = u.pathname;
  log.push({ path: p, query: Object.fromEntries(u.searchParams), auth: h.authorization ?? null, t: Date.now() });
  if (p === '/admin/students/search') {
    const keyword = u.searchParams.get('keyword');
    const type = u.searchParams.get('searchType');
    if (keyword === '999999') return json(500, { message: 'Student not found' });
    if (keyword === 'nobody@example.com') return json(404, {});
    if (keyword === '123456789012345678') return json(400, { message: 'Student ID must be numeric' });
    if (keyword === '263054') return json(500, {});
    if (keyword === '263055') return json(403, { message: 'Forbidden' });
    if (keyword === '263056') return json(401, { message: 'Unauthorized' });
    const s = profileFor(keyword, type);
    if (!s) return json(500, { message: 'Student not found' });
    if (s === SLOW) return void setTimeout(() => json(200, s), 1200);
    return json(200, s);
  }
  // Production no longer serves /orders/all; this is its real answer now.
  if (p === '/orders/all') return json(400, { status: 400, error: 'Bad Request', message: "Method parameter 'orderId': Failed to convert value of type 'java.lang.String' to required type 'java.lang.Long'; For input string: \"all\"", path: p });
  // GET /admin/all: rows carry only the eight mapToOrderDTO fields — no student.
  if (p === '/admin/all') {
    const k = u.searchParams.get('keyword');
    const page = (rows) => json(200, { content: rows.map(slim), totalElements: rows.length, totalPages: rows.length ? 1 : 0, number: 0, size: Number(u.searchParams.get('size')) });
    // "chyna.brooks@gmail.com" also matches "xchyna.brooks@gmail.com" (a LIKE search).
    if (k === 'chyna.brooks@gmail.com') return page([ORD[1101], ORD[1102], ORD[1199]]);
    if (k === 'lena@example.com') return lenaOrdersFail ? json(500, { message: 'Orders service unavailable' }) : page([ORD[1201]]);
    return page([]);
  }
  const det = /^\/admin\/orders\/(\d+)$/.exec(p);
  if (det) {
    const o = ORD[det[1]];
    return o ? json(200, { ...o, payments: [], installments: [] }) : json(500, { message: 'Order not found' });
  }
  if (p.startsWith('/payments/order/')) return json(200, []);
  return json(404, { message: 'Not found' }); // wallet probes and anything else
}

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (role) => `${b64({ alg: 'HS256' })}.${b64({ sub: '3', role, exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
const browser = await puppeteer.launch({ args: chromium.args.filter((a) => a !== '--single-process'), executablePath: await chromium.executablePath(), headless: true });

async function open(role, viewport) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport(viewport);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const token = jwt(role);
  await page.evaluateOnNewDocument((t, r) => {
    if (sessionStorage.getItem('seeded')) return; // seed once, so a sign-out sticks
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('token', t); localStorage.setItem('refreshToken', 'r'); localStorage.setItem('userId', '3');
    localStorage.setItem('userRole', r); localStorage.setItem('userEmail', 'ravi.sharma@qtiservices.com');
  }, token, role);
  const log = [];
  await page.setRequestInterception(true);
  page.on('request', (r) => respond(r, log));
  await page.goto(`${BASE}/admin/students`, { waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});
  await page.waitForSelector('.stu-search input', { timeout: 10000 });
  return { ctx, page, log, errors, token };
}
const searches = (log) => log.filter((x) => x.path === '/admin/students/search');
async function submit(page, text) {
  await page.$eval('.stu-search input', (el) => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(el, ''); el.dispatchEvent(new Event('input', { bubbles: true })); });
  if (text) await page.type('.stu-search input', text);
  await page.focus('.stu-search input');
  await page.keyboard.press('Enter');
}
const settle = (page) => page.waitForFunction(() => !document.querySelector('.stu-search input')?.disabled, { timeout: 8000 }).then(() => sleep(250)).catch(() => {});
const shown = (page) => page.evaluate(() => ({
  name: document.querySelector('.stu-ident h2')?.textContent ?? null,
  email: document.querySelector('.stu-ident .t-sm')?.textContent ?? null,
  wallet: document.querySelector('.stu-wallet-val')?.textContent ?? null,
  msg: document.querySelector('#stu-search-msg')?.textContent ?? null,
  body: document.querySelector('main')?.innerText ?? document.body.innerText,
  orderRows: [...document.querySelectorAll('[role="tabpanel"] table.data tbody tr')].map((tr) => tr.innerText.split('\n')[0]),
  editBtn: [...document.querySelectorAll('button')].some((b) => /Edit Profile/.test(b.textContent)),
}));

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };

for (const role of ['ADMIN', 'SUPER_ADMIN']) {
  console.log(`\n${role}`);
  const { ctx, page, log, errors, token } = await open(role, DESKTOP);

  // 5. Empty input: no request, clear message.
  await submit(page, '');
  await sleep(200);
  let s = await shown(page);
  check('empty input → validation message, no request', /Enter a student ID or email/.test(s.msg ?? '') && searches(log).length === 0, s.msg);

  // Neither an ID nor an email: refused before any request.
  await submit(page, 'john smith');
  await sleep(200);
  s = await shown(page);
  check('"john smith" → asks for a numeric ID or email, no request', /numeric student ID/.test(s.msg ?? '') && searches(log).length === 0, s.msg);
  if (role === 'ADMIN') await shot(page, 'students-invalid-input');

  // 1 + 4. Student ID with surrounding spaces.
  await submit(page, '   263050   ');
  await settle(page);
  let req = searches(log).at(-1);
  check('ID with spaces → ONE request, keyword=263050 & searchType=id', searches(log).length === 1 && req?.query.keyword === '263050' && req?.query.searchType === 'id', req?.query);
  check('request goes to /admin/students/search (no doubled /admin)', req?.path === '/admin/students/search', req?.path);
  check('request carries the signed-in bearer token', req?.auth === `Bearer ${token}`, req?.auth);
  s = await shown(page);
  check('profile from the DTO: name and email', s.name === 'Chyna Brooks' && s.email === 'chyna.brooks@gmail.com', s);
  check('phone and country from the DTO', /\+1 555 0100/.test(s.body) && /United States/.test(s.body));
  check('wallet balance from the DTO ($25.50)', s.wallet === '$25.50', s.wallet);
  check('only this student\'s orders are shown (the partial-match order is dropped)', s.orderRows.length === 2 && !s.orderRows.some((r) => /1199/.test(r)), s.orderRows);
  check('orders searched by the student\'s email on GET /admin/all', log.some((x) => x.path === '/admin/all' && x.query.keyword === 'chyna.brooks@gmail.com'));
  check('each hit confirmed from its details (1101, 1102, 1199)', ['1101', '1102', '1199'].every((id) => log.some((x) => x.path === `/admin/orders/${id}`)));
  check('no request to the removed /orders/all', !log.some((x) => x.path === '/orders/all'));
  check('payments come from the confirmed details, no /payments/order calls', !log.some((x) => x.path.startsWith('/payments/order/')));
  check('no wallet guessing when the DTO has a balance', !log.some((x) => x.path.startsWith('/wallet') || x.path.startsWith('/admin/wallet')));
  check('Edit Profile still offered', s.editBtn);

  // "ID-" prefixed.
  const n1 = searches(log).length;
  await submit(page, 'ID-263050');
  await settle(page);
  req = searches(log).at(-1);
  check('"ID-263050" → keyword=263050 & searchType=id', searches(log).length === n1 + 1 && req?.query.keyword === '263050' && req?.query.searchType === 'id', req?.query);

  // 2 + 3. Email in mixed case.
  await submit(page, 'Chyna.Brooks@Gmail.com');
  await settle(page);
  req = searches(log).at(-1);
  s = await shown(page);
  check('mixed-case email → searchType=email, sent as typed (the service lowercases)', req?.query.searchType === 'email' && req?.query.keyword === 'Chyna.Brooks@Gmail.com', req?.query);
  check('…and the student is found', s.name === 'Chyna Brooks', s.name);

  // Email needing URL encoding.
  await submit(page, 'chyna+test@gmail.com');
  await settle(page);
  req = searches(log).at(-1);
  s = await shown(page);
  check('"+" in an email is encoded, arriving intact', req?.query.keyword === 'chyna+test@gmail.com' && s.name === 'Plus Address', { q: req?.query, name: s.name });

  // 8. Second student after the first: nothing of the first remains.
  await submit(page, '263050');
  await settle(page);
  await submit(page, '263051');
  await settle(page);
  s = await shown(page);
  check('second search shows only the second student', s.name === 'Wade Morgan' && !/Chyna/.test(s.body), s.name);
  check('a student with no orders is still found ("No orders")', /No orders/.test(s.body) && s.orderRows.length === 0);
  check('no balance in the DTO → legacy wallet lookups tried, $0.00 shown', s.wallet === '$0.00' && log.some((x) => x.path === '/wallet/admin/student/263051'), s.wallet);

  // 6. Not found — message from the service, and a bare 404.
  await submit(page, '999999');
  await settle(page);
  s = await shown(page);
  check('not found (service message) → "Student not found…check the ID or email"', /Student not found/.test(s.body) && /check the Student ID or email/i.test(s.body) && s.name === null);
  await submit(page, 'nobody@example.com');
  await settle(page);
  s = await shown(page);
  check('not found (bare 404) → same message', /Student not found/.test(s.body));
  if (role === 'ADMIN') await shot(page, 'students-not-found');

  // 7. Backend validation.
  await submit(page, '123456789012345678');
  await settle(page);
  s = await shown(page);
  check('backend "Student ID must be numeric" → shown under the field', /must be numeric/.test(s.msg ?? ''), s.msg);

  // 9. Server error without a message.
  await submit(page, '263054');
  await settle(page);
  s = await shown(page);
  check('server error → error state with Retry, page intact', /Request failed \(500\)/.test(s.body) && /Retry|Try again/.test(s.body), s.body.slice(0, 200));

  // 10. Loading + duplicate prevention.
  const before = searches(log).length;
  await submit(page, '263053');
  await sleep(150);
  const during = await page.evaluate(() => ({
    inputDisabled: document.querySelector('.stu-search input')?.disabled,
    skeleton: !!document.querySelector('.skel, [class*="skeleton"], .stu-stat .skel'),
    stale: !!document.querySelector('.stu-ident'),
  }));
  await page.keyboard.press('Enter');
  await page.click('.stu-search button[type="submit"]').catch(() => {});
  await settle(page);
  check('while loading: input disabled, previous student hidden', during.inputDisabled === true && during.stale === false, during);
  check('repeated Enter/click while loading → still ONE request', searches(log).length === before + 1, searches(log).length - before);
  s = await shown(page);
  check('…and the slow result then shows', s.name === 'Slow Student', s.name);

  // 14. Orders fail after the profile loads; retry fetches orders only.
  lenaOrdersFail = true;
  await submit(page, '263052');
  await settle(page);
  s = await shown(page);
  check('profile still shown when orders fail', s.name === 'Lena Ortiz', s.name);
  check('orders tab says they could not be loaded (not "No orders")', /orders could not be loaded/i.test(s.body) && !/No orders/.test(s.body));
  const tiles = await page.$$eval('.stu-stat-val', (els) => els.map((e) => e.textContent));
  check('summary tiles show "—", not zero orders', tiles.length === 4 && tiles.every((t) => t === '—'), tiles);
  if (role === 'ADMIN') await shot(page, 'students-orders-failed');
  lenaOrdersFail = false;
  const sBefore = searches(log).length;
  await page.evaluate(() => [...document.querySelectorAll('[role="tabpanel"] button')].find((b) => /Retry|Try again/.test(b.textContent))?.click());
  await sleep(600);
  s = await shown(page);
  check('Retry loads the orders without searching again', s.orderRows.length === 1 && searches(log).length === sBefore, { rows: s.orderRows, extra: searches(log).length - sBefore });
  const tiles2 = await page.$$eval('.stu-stat-val', (els) => els.map((e) => e.textContent));
  check('…and the tiles then count them', tiles2[0] === '1', tiles2);

  // 11. 403: explained, not signed out.
  await submit(page, '263055');
  await settle(page);
  s = await shown(page);
  check('403 → "not permitted" message, still signed in', /not permitted to search students/.test(s.body) && new URL(page.url()).pathname === '/admin/students' && !!(await page.evaluate(() => localStorage.getItem('token'))));

  check('no page errors', errors.length === 0, errors.slice(0, 2));
  await ctx.close();
}

// 11. 401 → the app's normal sign-out.
console.log('\nExpired session');
{
  const { ctx, page } = await open('ADMIN', DESKTOP);
  await submit(page, '263056');
  await page.waitForFunction(() => location.pathname === '/admin/login', { timeout: 8000 }).catch(() => {});
  check('401 → signed out to /admin/login', new URL(page.url()).pathname === '/admin/login', page.url());
  check('…and the token is cleared', !(await page.evaluate(() => localStorage.getItem('token'))));
  await ctx.close();
}

// 14. Phone layout.
console.log('\nPhone');
{
  const { ctx, page } = await open('SUPER_ADMIN', PHONE);
  await submit(page, '263050');
  await settle(page);
  const m = await page.evaluate(() => ({ name: document.querySelector('.stu-ident h2')?.textContent, over: document.documentElement.scrollWidth > 391 }));
  check('phone: student shown, no sideways scroll', m.name === 'Chyna Brooks' && !m.over, m);
  await shot(page, 'students-phone');
  await submit(page, '');
  await sleep(200);
  check('phone: empty search shows the message', /Enter a student ID or email/.test((await shown(page)).msg ?? ''));
  await ctx.close();
}

await browser.close();
console.log(`\n  ${passed}/${passed + failed} passed`);
process.exit(failed ? 1 : 0);
