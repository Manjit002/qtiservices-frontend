/**
 * Every admin screen that lists or looks up orders, against a backend that
 * behaves like production does now:
 *
 *   GET /orders/all  → 400 "Method parameter 'orderId': Failed to convert …
 *                      For input string: "all"" (the endpoint is gone; Spring
 *                      matches the path to /orders/{orderId})
 *   GET /admin/all   → Page<OrderDTO> with only the eight fields
 *                      OrderService.mapToOrderDTO sets; size 1–100, else 500
 *
 * For each screen it checks: no request to /orders/all, no /admin/all request
 * above size 100, no "Couldn't load this" card, real rows on screen, and that
 * a field the rows don't carry (student, expert) is never shown as a false
 * value — no "Unassigned", no "0 active orders", no "Student unknown".
 *
 * TEST SCAFFOLDING ONLY — the backend is not reachable from the test machine,
 * so its responses are answered by request interception. Nothing here ships.
 *
 *   BASE=http://localhost:7600 node order-lists.test.mjs
 */
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const BASE = process.env.BASE;
if (!BASE) { console.error('Set BASE, e.g. BASE=http://localhost:7600'); process.exit(2); }
const OUT = process.env.OUT ?? '';
if (OUT) fs.mkdirSync(OUT, { recursive: true });
const shot = (page, name) => (OUT ? page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true }).catch(() => {}) : null);

let passed = 0, failed = 0;
const check = (name, ok, detail) => {
  if (ok) passed += 1; else failed += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail !== undefined ? `  → ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Backend stand-in ────────────────────────────────────────────────────────
const NOW = Date.now();
const ldt = (ms) => { const d = new Date(ms); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00`; };
const STATUSES = ['REVIEW_PENDING', 'UNDER_REVIEW', 'PRICE_SET', 'ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'COMPLETED', 'CANCELLED'];
const SUBJECTS = ['Statistics Project', 'Nursing Care Plan', 'Organic Chemistry Lab', 'Macroeconomics Essay', 'Business Law Case'];
const STUDENTS = [
  { id: 501, name: 'Wade Morgan', email: 'wade@example.com', phone: '+1 555 0101', country: 'Canada', active: true, walletBalance: 12 },
  { id: 502, name: 'Dan Wade', email: 'dwade@example.com', phone: null, country: 'United States', active: true, walletBalance: 0 },
];
const EXPERTS = [
  { id: 21, name: 'Elena Petrova', email: 'elena@qtiservices.com', role: 'EXPERT', active: true, availabilityStatus: 'AVAILABLE' },
  { id: 22, name: 'Marcus Reed', email: 'marcus@qtiservices.com', role: 'EXPERT', active: true, availabilityStatus: 'AVAILABLE' },
];
const ORDERS = [];
for (let id = 1260; id >= 1001; id--) {
  const n = 1260 - id;
  const status = STATUSES[id % STATUSES.length];
  // Student 501 owns 1252 and 1244; 502 ("dwade@…", which contains "wade@…") owns 1250.
  const student = id === 1252 || id === 1244 ? STUDENTS[0] : id === 1250 ? STUDENTS[1] : null;
  const expert = ['ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'COMPLETED'].includes(status) ? EXPERTS[id % 2] : null;
  ORDERS.push({
    id, subject: `${SUBJECTS[id % SUBJECTS.length]} ${id}`, assignmentType: id % 2 ? 'Essay' : 'Online Class',
    price: 90 + (id % 50), status, paymentStatus: id % 3 ? 'PENDING' : 'SUCCESS',
    deadline: ldt(NOW + ((id % 9) - 2) * 86400e3), createdAt: ldt(NOW - n * 5 * 3600e3),
    studentId: student?.id ?? 600 + (id % 40), studentEmail: student?.email ?? `s${600 + (id % 40)}@example.com`, studentName: student?.name ?? 'Another Student',
    assignedEmployeeId: expert?.id ?? null, assignedEmployeeName: expert?.name ?? null,
    expertDeadline: expert ? ldt(NOW + 86400e3) : null,
  });
}
const byId = Object.fromEntries(ORDERS.map((o) => [o.id, o]));
// OrderService.mapToOrderDTO: these eight fields and nothing else.
const slim = ({ id, subject, assignmentType, price, status, paymentStatus, deadline, createdAt }) => ({ id, subject, assignmentType, price, status, paymentStatus, deadline, createdAt });
const PROD_404 = { status: 400, error: 'Bad Request', message: "Method parameter 'orderId': Failed to convert value of type 'java.lang.String' to required type 'java.lang.Long'; For input string: \"all\"", path: '/orders/all' };

function adminAll(q) {
  const page = Number(q.get('page') ?? 0), size = Number(q.get('size') ?? 10);
  if (page < 0 || size < 1 || size > 100) return [500, {}];
  const st = q.get('status'); const kw = q.get('keyword')?.trim().toLowerCase();
  // A LIKE search over id, subject and student email: "wade@example.com"
  // also matches "dwade@example.com", which the app must not show as Wade's.
  const list = ORDERS.filter((o) => (!st || o.status === st)
    && (!kw || String(o.id).includes(kw) || o.subject.toLowerCase().includes(kw) || o.studentEmail.includes(kw)));
  return [200, { content: list.slice(page * size, page * size + size).map(slim), totalElements: list.length, totalPages: Math.ceil(list.length / size), number: page, size }];
}

function fixture(method, u) {
  const p = u.pathname; const q = u.searchParams;
  let m;
  if (p === '/orders/all') return [400, PROD_404];
  if (p === '/admin/all') return adminAll(q);
  if ((m = /^\/admin\/orders\/(\d+)$/.exec(p))) {
    const o = byId[m[1]];
    return o ? [200, { ...o, instructions: 'Follow the rubric.', payments: [], installments: [], paidAmount: 0, totalPrice: o.price, remainingAmount: o.price, files: [], fileCount: 0 }] : [500, { message: 'Order not found' }];
  }
  if ((m = /^\/admin\/orders\/(\d+)\/installments$/.exec(p))) return [200, []];
  if (p === '/admin/students/search') {
    const k = (q.get('keyword') ?? '').toLowerCase();
    const s = q.get('searchType') === 'id' ? STUDENTS.find((x) => String(x.id) === k) : STUDENTS.find((x) => x.email === k);
    return s ? [200, s] : [500, { message: 'Student not found' }];
  }
  if (p === '/admin/admin-dashboard') return [200, { reviewPending: 33, assignedOrders: 32, completedOrders: 32, availableExperts: 2, totalRevenue: 18450, pendingPayments: 7 }];
  if (p === '/admin/experts/available') return [200, EXPERTS];
  if (p === '/admin/employees') return [200, [{ id: 3, name: 'Ravi Sharma', email: 'ravi@qtiservices.com', role: 'SUPER_ADMIN', active: true }, ...EXPERTS]];
  if (p === '/admin/roles') return [200, []];
  if (p === '/api/order-chat/conversations') return [200, [{ orderId: 1259, studentId: 619, studentName: 'Another Student', lastMessage: 'Hello?', lastMessageTime: NOW - 60e3, unreadCount: 1, hasConversation: true }]];
  if (p === '/api/order-chat/unread-count') return [200, 0];
  if (p === '/installments/due') return [200, [{ id: 71, orderId: 1255, studentId: 615, finalAmount: 40, dueDateTime: ldt(NOW + 3600e3), status: 'PENDING' }, { id: 72, orderId: 900, studentId: 640, finalAmount: 25, dueDateTime: ldt(NOW + 7200e3), status: 'PENDING' }]];
  if (p === '/installments/overdue') return [200, []];
  if (p.startsWith('/payments/order/')) return [200, []];
  if (p.startsWith('/files/')) return [200, { content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 }];
  if (method !== 'GET') return [200, { message: 'ok' }];
  return [404, { message: 'Not found' }];
}

// ── Harness ─────────────────────────────────────────────────────────────────
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (role) => `${b64({ alg: 'HS256' })}.${b64({ sub: '3', role, exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
const browser = await puppeteer.launch({ args: chromium.args.filter((a) => a !== '--single-process'), executablePath: await chromium.executablePath(), headless: true });

async function open(role, path, viewport = { width: 1440, height: 900 }) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport(viewport);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.evaluateOnNewDocument((t, r) => {
    localStorage.setItem('token', t); localStorage.setItem('refreshToken', 'r'); localStorage.setItem('userId', '3');
    localStorage.setItem('userRole', r); localStorage.setItem('userEmail', 'ravi.sharma@qtiservices.com');
  }, jwt(role), role);
  const log = [];
  await page.setRequestInterception(true);
  page.on('request', (r) => {
    const u = new URL(r.url());
    const h = r.headers();
    const isRsc = h.rsc || h['next-router-prefetch'] || h['next-router-state-tree'] || u.searchParams.has('_rsc');
    if (u.hostname.endsWith('googleapis.com') || u.hostname.endsWith('gstatic.com')) return r.respond({ status: 200, contentType: 'text/css', body: '' });
    if (isRsc || !['fetch', 'xhr', 'eventsource'].includes(r.resourceType())) return r.continue();
    if (u.pathname.startsWith('/ws/')) return r.respond({ status: 503, contentType: 'application/json', body: '{}' });
    log.push({ path: u.pathname, query: Object.fromEntries(u.searchParams), t: Date.now() });
    const [status, body] = fixture(r.method(), u);
    r.respond({ status, contentType: 'application/json', body: JSON.stringify(body) }).catch(() => {});
  });
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});
  await sleep(500);
  return { ctx, page, log, errors };
}
const text = (page) => page.evaluate(() => document.querySelector('main')?.innerText ?? document.body.innerText);
const common = async (label, page, log, errors) => {
  const body = await text(page);
  check(`${label}: no request to the removed /orders/all`, !log.some((x) => x.path === '/orders/all'), log.filter((x) => x.path === '/orders/all').length);
  check(`${label}: every /admin/all request is size 1–100`, log.filter((x) => x.path === '/admin/all').every((x) => +x.query.size >= 1 && +x.query.size <= 100), log.filter((x) => x.path === '/admin/all').map((x) => x.query.size));
  check(`${label}: no "Couldn't load this" card`, !/Couldn.t load this/.test(body), body.slice(0, 200));
  check(`${label}: no page errors`, errors.length === 0, errors);
  return body;
};
const admin = (log) => log.filter((x) => x.path === '/admin/all');

for (const role of ['SUPER_ADMIN', 'ADMIN']) {
  console.log(`\n${role}`);

  // ── Dashboard (the screen in the bug report) ──
  {
    const { ctx, page, log, errors } = await open(role, '/admin/dashboard');
    const body = await common('dashboard', page, log, errors);
    const rows = await page.$$eval('.att-row .att-id', (els) => els.map((e) => e.textContent));
    check('dashboard: "Needs attention" lists open orders', rows.length > 0 && rows.every((r) => /^OD-\d+$/.test(r)), rows);
    check('dashboard: one /admin/all request (page=0&size=100)', admin(log).length === 1 && admin(log)[0].query.page === '0' && admin(log)[0].query.size === '100', admin(log).map((x) => x.query));
    check('dashboard: the shell no longer fetches order lists for workload on load', admin(log).length === 1);
    check('dashboard: no error text from the old endpoint', !/Failed to convert value/.test(body));
    await shot(page, `lists-${role}-dashboard`);
    await ctx.close();
  }

  // ── Orders + assign dialog workload ──
  {
    const { ctx, page, log, errors } = await open(role, '/admin/orders');
    await common('orders', page, log, errors);
    const ids = await page.$$eval('.ord-table-wrap tbody tr .ord-id', (els) => els.map((e) => e.textContent));
    check('orders: rows from /admin/all', ids.length === 15 && ids[0] === 'OD-1260', ids.slice(0, 3));
    const experts = await page.$$eval('.ord-table-wrap tbody tr', (rows) => rows.map((tr) => tr.children[6]?.innerText.trim()));
    check('orders: Expert column never says "Unassigned" without data', !experts.includes('Unassigned'), experts);
    const before = admin(log).length;
    const opened = await page.evaluate(() => {
      const b = [...document.querySelectorAll('.ord-table-wrap tbody button')].find((x) => /^\s*(Assign|Reassign)\s*$/.test(x.textContent));
      b?.click();
      return Boolean(b);
    });
    await page.waitForSelector('[role="dialog"] .ep-item', { timeout: 6000 }).catch(() => {});
    await sleep(600);
    const dlg = await page.evaluate(() => document.querySelector('[role="dialog"]')?.innerText ?? '');
    const wlReqs = admin(log).slice(before).map((x) => x.query);
    check('assign dialog: workload fetched only when the dialog opens (pages 0 and 1, size 100)', opened && wlReqs.length === 2 && wlReqs.every((x) => x.size === '100'), wlReqs);
    check('assign dialog: no false "no active orders" for experts', !/no active orders/.test(dlg) && /Elena Petrova/.test(dlg), dlg.slice(0, 300));
    check('assign dialog: says why workload is not shown', /don.t include the assigned expert/.test(dlg), dlg.slice(-200));
    check('assign dialog: no "Student unknown"', !/Student unknown/.test(dlg));
    await shot(page, `lists-${role}-assign-dialog`);
    await ctx.close();
  }

  // ── Students: orders confirmed per student ──
  {
    const { ctx, page, log, errors } = await open(role, '/admin/students');
    await page.type('.stu-search input', '501');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('.stu-ident h2')?.textContent === 'Wade Morgan', { timeout: 8000 }).catch(() => {});
    await sleep(900);
    await common('students', page, log, errors);
    const rows = await page.$$eval('[role="tabpanel"] table.data tbody tr', (trs) => trs.map((tr) => tr.innerText.split(/[\t\n]/)[0].trim()));
    check('students: orders searched by email on /admin/all', admin(log).some((x) => x.query.keyword === 'wade@example.com'), admin(log).map((x) => x.query));
    check('students: shows exactly Wade\'s two orders (1252, 1244)', rows.length === 2 && rows.includes('OD-1252') && rows.includes('OD-1244'), rows);
    check('students: "dwade@…" order 1250 matched the search but is not shown', !rows.includes('OD-1250') && log.some((x) => x.path === '/admin/orders/1250'), rows);
    check('students: confirmation reads ≤ 25 details', log.filter((x) => /^\/admin\/orders\/\d+$/.test(x.path)).length <= 25);
    await shot(page, `lists-${role}-students`);
    await ctx.close();
  }

  if (role === 'ADMIN') continue; // the rest are the same code for both roles

  // ── Assign orders ──
  {
    const { ctx, page, log, errors } = await open(role, '/admin/assign-orders');
    await common('assign-orders', page, log, errors);
    const heads = await page.$$eval('.as-table-wrap thead th', (ths) => ths.map((t) => t.textContent.trim()));
    const rows = await page.$$eval('.as-table-wrap tbody tr .as-id', (els) => els.length);
    const ph = await page.$eval('.ord-search input', (i) => i.placeholder);
    check('assign-orders: queue rows shown', rows > 0, rows);
    check('assign-orders: no Student column of dashes (rows carry no student)', !heads.includes('Student'), heads);
    check('assign-orders: search says what it can match', ph === 'Search order ID or subject…', ph);
    check('assign-orders: one /admin/all request, size 100', admin(log).length === 1 && admin(log)[0].query.size === '100');
    await ctx.close();
  }

  // ── Chat sidebar ──
  {
    const { ctx, page, log, errors } = await open(role, '/admin/chat');
    await page.waitForSelector('.ch-item', { timeout: 8000 }).catch(() => {});
    await common('chat', page, log, errors);
    const n = await page.$$eval('.ch-item', (els) => els.length);
    check('chat: sidebar lists the 60 newest orders', n === 60, n);
    check('chat: one /admin/all request, page=0&size=60', admin(log).length === 1 && admin(log)[0].query.size === '60' && admin(log)[0].query.page === '0', admin(log).map((x) => x.query));
    await ctx.close();
  }

  // ── Analytics ──
  {
    const { ctx, page, log, errors } = await open(role, '/admin/analytics');
    const body = await common('analytics', page, log, errors);
    const pages = admin(log).map((x) => x.query.page).sort();
    // A 500-order window, but only 260 orders exist: pages 0–2, no empty requests.
    check('analytics: size-100 pages only as far as orders exist (0, 1, 2 of 260)', admin(log).length === 3 && JSON.stringify(pages) === '["0","1","2"]' && admin(log).every((x) => x.query.size === '100'), admin(log).map((x) => x.query));
    check('analytics: "Orders by expert" says Not available, not "No assigned orders"', /Orders by expert[\s\S]*Not available/.test(body) && !/No assigned orders in this range/.test(body), body.slice(body.indexOf('Orders by expert'), body.indexOf('Orders by expert') + 200));
    await shot(page, `lists-${role}-analytics`);
    await ctx.close();
  }

  // ── System overview ──
  {
    const { ctx, page, log, errors } = await open(role, '/admin/system-overview');
    await common('system-overview', page, log, errors);
    check('system-overview: 200 orders as two size-100 requests', admin(log).length === 2 && admin(log).every((x) => x.query.size === '100'), admin(log).map((x) => x.query));
    await ctx.close();
  }

  // ── Experts ──
  {
    const { ctx, page, log, errors } = await open(role, '/admin/experts');
    const body = await common('experts', page, log, errors);
    const loads = await page.$$eval('table.data tbody tr', (trs) => trs.map((tr) => tr.children[4]?.innerText.trim()));
    check('experts: Active orders reads "Not available", never a false 0 or —', loads.length > 0 && loads.every((x) => x === 'Not available'), loads);
    check('experts: note explains why', /Active orders aren.t shown/.test(body));
    await ctx.close();
  }

  // ── Installments ──
  {
    const { ctx, page, log, errors } = await open(role, '/admin/installments');
    await common('installments', page, log, errors);
    const q = await page.$$eval('.in-q .in-q-main .t-sm', (els) => els.map((e) => e.textContent));
    check('installments: queue row shows its order subject from the recent window', q.some((t) => /1255/.test(t)), q);
    check('installments: an order outside the window shows its ID', q.some((t) => /OD-900/.test(t)), q);
    const before = log.length;
    await page.type('form[role="search"] input[aria-label="Search orders"]', 'OD-1052');
    await page.keyboard.press('Enter');
    await page.waitForSelector('.pv-hit', { timeout: 6000 }).catch(() => {});
    const hits = await page.$$eval('.pv-hit .ord-id', (els) => els.map((e) => e.textContent));
    const reqs = log.slice(before).map((x) => `${x.path}?${new URLSearchParams(x.query)}`);
    check('installments: search reads the exact order and searches the server', reqs.some((r) => r.startsWith('/admin/orders/1052')) && reqs.some((r) => r.startsWith('/admin/all?') && r.includes('keyword=1052')), reqs);
    check('installments: OD-1052 listed first', hits[0] === 'OD-1052', hits);
    await ctx.close();
  }

  // ── Verify payments ──
  {
    const { ctx, page, log, errors } = await open(role, '/admin/verify-payments');
    await page.type('.pv-cols input[aria-label^="Search orders"]', '1101');
    await page.keyboard.press('Enter');
    await page.waitForSelector('.pv-hit', { timeout: 6000 }).catch(() => {});
    await common('verify-payments', page, log, errors);
    const hits = await page.$$eval('.pv-hit .ord-id', (els) => els.map((e) => e.textContent));
    check('verify-payments: exact order first, then server matches', hits[0] === 'OD-1101' && hits.length >= 1 && hits.length <= 8, hits);
    check('verify-payments: search is keyword=1101, size 8', admin(log).some((x) => x.query.keyword === '1101' && x.query.size === '8'), admin(log).map((x) => x.query));
    await ctx.close();
  }

  // ── Create order: student picker ──
  {
    const { ctx, page, log, errors } = await open(role, '/admin/create-order');
    await page.type('input[aria-label="Search students"]', '501').catch(() => {});
    await page.waitForSelector('.pv-hit', { timeout: 6000 }).catch(() => {});
    const hit = await page.$eval('.pv-hit', (b) => b.innerText).catch(() => '');
    check('create-order: student found by ID via /admin/students/search', /Wade Morgan/.test(hit) && log.some((x) => x.path === '/admin/students/search' && x.query.keyword === '501' && x.query.searchType === 'id'), hit);
    await page.click('.pv-hit').catch(() => {});
    await sleep(300);
    const f = await page.evaluate(() => ['#co-email', '#co-name', '#co-phone', '#co-country'].map((s) => document.querySelector(s)?.value));
    check('create-order: Use fills email, name, phone and country', JSON.stringify(f) === JSON.stringify(['wade@example.com', 'Wade Morgan', '+1 555 0101', 'Canada']), f);
    await page.$eval('#co-email', (el) => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(el, ''); el.dispatchEvent(new Event('input', { bubbles: true })); }).catch(() => {});
    await page.type('#co-email', 'Wade@Example.com').catch(() => {});
    await page.waitForFunction(() => /saved as/.test(document.body.innerText), { timeout: 6000 }).catch(() => {});
    let body = await text(page);
    check('create-order: a differently-cased email is flagged with the stored one', /saved as wade@example\.com/.test(body), body.slice(0, 400));
    await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /^Use wade@example\.com$/.test(b.textContent.trim()))?.click());
    await sleep(300);
    check('create-order: "Use …" puts the stored email back', await page.$eval('#co-email', (i) => i.value).catch(() => null) === 'wade@example.com');
    await page.$eval('#co-email', (el) => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(el, ''); el.dispatchEvent(new Event('input', { bubbles: true })); }).catch(() => {});
    await page.type('#co-email', 'brand.new@example.com').catch(() => {});
    await page.waitForFunction(() => /create a new student/.test(document.body.innerText), { timeout: 6000 }).catch(() => {});
    body = await text(page);
    check('create-order: an unknown email says a new account will be created', /create a new student/.test(body));
    await common('create-order', page, log, errors);
    await shot(page, `lists-${role}-create-order`);
    await ctx.close();
  }
}

await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
