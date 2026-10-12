/**
 * Admin Orders page → GET /admin/all (AdminController "ADMIN SEARCH ORDERS")
 *
 * Drives the real page (/admin/orders) as ADMIN and SUPER_ADMIN, desktop and
 * phone, and checks the exact requests and what is shown for: first load,
 * paging, each status tab, keyword (debounced, "OD-" prefix removed), country,
 * created-date range, a reversed range, clearing, no results, server errors
 * (with a status, with dates), both Spring Page JSON shapes, a superseded slow
 * search, the Expert column without expert fields, selection across pages,
 * CSV export of every matching page (100 per request), and the dialogs and
 * detail page that read fields /admin/all rows don't carry.
 *
 * TEST SCAFFOLDING ONLY — the backend is not reachable from the test machine,
 * so its responses are answered by request interception. The stand-in for
 * /admin/all follows OrderService.getAllOrdersAdvancedDTO: same parameter
 * names, same validation, newest first, and rows with only the eight fields
 * mapToOrderDTO sets. Its keyword and country matching is a guess — the
 * repository query wasn't shared — and the assertions don't depend on it
 * beyond "the server decides".
 *
 *   BASE=http://localhost:7600 node order-search.test.mjs
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

// ── Backend stand-in ────────────────────────────────────────────────────────
const STATUSES = ['REVIEW_PENDING', 'UNDER_REVIEW', 'PRICE_SET', 'ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'COMPLETED', 'CANCELLED'];
const ENUM = new Set([...STATUSES, 'CREATED', 'REASSIGNED', 'PAID']);
const COUNTRIES = ['United States', 'Canada', 'United Kingdom', 'Australia', null];
const SUBJECTS = ['Statistics Project', 'Nursing Care Plan', 'Organic Chemistry Lab', 'Macroeconomics Essay', 'Business Law Case', 'Calculus Problem Set', 'Marketing Plan'];
const NOW = Date.parse('2026-10-10T12:00:00Z');
const iso = (ms) => new Date(ms).toISOString().slice(0, 19);
const ALL = [];
for (let id = 1230; id >= 1001; id--) {
  const n = 1230 - id;
  ALL.push({
    entity: {
      id,
      subject: id >= 1226 ? `Slowpoke Lab ${id}` : `${SUBJECTS[id % SUBJECTS.length]} ${id}`,
      assignmentType: id % 2 ? 'Essay' : 'Online Class',
      price: id % 5 === 0 ? null : 100 + (id % 40),
      status: id >= 1226 ? 'REVIEW_PENDING' : STATUSES[id % STATUSES.length],
      paymentStatus: id % 3 ? 'PENDING' : 'SUCCESS',
      deadline: iso(NOW + (id % 20) * 86400e3),
      createdAt: iso(NOW - n * 7 * 3600e3),
      country: COUNTRIES[id % COUNTRIES.length],
    },
  });
}
// mapToOrderDTO: exactly these eight fields, nothing about student or expert.
const toDTO = ({ entity: e }, withNames) => {
  const dto = { id: e.id, subject: e.subject, assignmentType: e.assignmentType, price: e.price, status: e.status, paymentStatus: e.paymentStatus, deadline: e.deadline, createdAt: e.createdAt };
  if (withNames && ['ASSIGNED', 'IN_PROGRESS', 'SUBMITTED'].includes(e.status)) dto.assignedEmployeeName = `Expert ${e.id % 3}`;
  return dto;
};
const LDT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;
const state = { viaDto: false, withNames: false, fail: null };

function adminAll(u) {
  const q = u.searchParams;
  if (state.fail) return [state.fail, {}]; // Spring's default error body has no message
  const page = Number(q.get('page') ?? 0);
  const size = Number(q.get('size') ?? 10);
  if (page < 0) return [500, {}];
  if (size < 1 || size > 100) return [500, {}];
  const status = q.get('status');
  if (status && !ENUM.has(status.trim().toUpperCase())) return [500, {}];
  const from = q.get('fromDate'); const to = q.get('toDate');
  if ((from && !LDT.test(from)) || (to && !LDT.test(to))) return [400, {}];
  if (from && to && from > to) return [500, {}];
  const kw = q.get('keyword')?.trim().toLowerCase();
  const country = q.get('country')?.trim().toLowerCase();
  const list = ALL.filter(({ entity: e }) =>
    (!status || e.status === status.trim().toUpperCase())
    && (!country || (e.country ?? '').toLowerCase() === country)
    && (!kw || String(e.id).includes(kw) || e.subject.toLowerCase().includes(kw))
    && (!from || e.createdAt >= from) && (!to || e.createdAt <= to));
  const content = list.slice(page * size, page * size + size).map((o) => toDTO(o, state.withNames));
  const totalPages = Math.ceil(list.length / size);
  const meta = { size, number: page, totalElements: list.length, totalPages };
  if (state.viaDto) return [200, { content, page: meta }];
  return [200, { content, pageable: { pageNumber: page, pageSize: size }, ...meta, first: page === 0, last: page >= totalPages - 1, empty: !content.length, numberOfElements: content.length }];
}

function detail(id) {
  const o = ALL.find((x) => x.entity.id === id)?.entity;
  if (!o) return [500, { message: 'Order not found' }];
  // mapToOrderDetailDTO: no academicLevel / instructionsWordCount keys at all.
  // `university: null` is here only to exercise the present-but-empty branch.
  return [200, { ...o, instructions: 'Follow the rubric.', paidAmount: 0, remainingAmount: o.price ?? 0, totalPrice: o.price, fullyPaid: false, payments: [], installments: [], studentId: 501, studentName: 'Wade Morgan', studentEmail: 'wade@example.com', assignedEmployeeId: 7, assignedEmployeeName: 'Priya Nair', expertDeadline: '2026-10-20T18:00:00', fileCount: 0, files: [], university: null }];
}

function respond(r, log) {
  const u = new URL(r.url());
  const h = r.headers();
  const isRsc = h.rsc || h['next-router-prefetch'] || h['next-router-state-tree'] || u.searchParams.has('_rsc');
  if (u.hostname.endsWith('googleapis.com') || u.hostname.endsWith('gstatic.com')) return r.respond({ status: 200, contentType: 'text/css', body: '' });
  if (isRsc || !['fetch', 'xhr'].includes(r.resourceType())) return r.continue();
  const send = ([status, body], delay = 0) => {
    const go = () => r.respond({ status, contentType: 'application/json', body: JSON.stringify(body) }).catch(() => {});
    if (delay) setTimeout(go, delay); else go();
  };
  const p = u.pathname;
  log.push({ path: p, method: r.method(), query: Object.fromEntries(u.searchParams), auth: h.authorization ?? null, t: Date.now() });
  if (p === '/admin/all') {
    const slow = u.searchParams.get('keyword') === 'slowpoke' && !u.searchParams.get('status');
    return send(adminAll(u), slow ? 1500 : 60);
  }
  const m = /^\/admin\/orders\/(\d+)$/.exec(p);
  if (m) return send(detail(Number(m[1])), 150);
  // The portal shell reads the legacy list for the assign dialog's workload.
  // Production no longer serves /orders/all; this is its real answer now.
  if (p === '/orders/all') return send([400, { status: 400, error: 'Bad Request', message: "Method parameter 'orderId': Failed to convert value of type 'java.lang.String' to required type 'java.lang.Long'; For input string: \"all\"", path: p }]);
  if (p === '/admin/experts/available') return send([200, [{ id: 7, name: 'Priya Nair', email: 'priya@qtiservices.com', role: 'EXPERT', active: true, availabilityStatus: 'AVAILABLE' }]]);
  if (p === '/api/order-chat/conversations') return send([200, []]);
  if (p === '/admin/admin-dashboard') return send([200, { reviewPending: 4 }]);
  if (p.startsWith('/payments/order/') || p.startsWith('/files/')) return send([200, []]);
  return send([404, { message: 'Not found' }]);
}

// ── Harness ─────────────────────────────────────────────────────────────────
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (role) => `${b64({ alg: 'HS256' })}.${b64({ sub: '3', role, exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
const browser = await puppeteer.launch({ args: chromium.args.filter((a) => a !== '--single-process'), executablePath: await chromium.executablePath(), headless: true });

async function open(role, viewport, path = '/admin/orders') {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport(viewport);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && /Warning|hydrat/i.test(m.text())) errors.push(m.text()); });
  const token = jwt(role);
  await page.evaluateOnNewDocument((t, r) => {
    localStorage.setItem('token', t); localStorage.setItem('refreshToken', 'r'); localStorage.setItem('userId', '3');
    localStorage.setItem('userRole', r); localStorage.setItem('userEmail', 'ravi.sharma@qtiservices.com');
    // Capture CSV downloads: the page builds a Blob and an object URL.
    const orig = URL.createObjectURL.bind(URL);
    window.__csv = [];
    URL.createObjectURL = (b) => { b.text().then((t) => window.__csv.push(t)); return orig(b); };
  }, token, role);
  const log = [];
  await page.setRequestInterception(true);
  page.on('request', (r) => respond(r, log));
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});
  return { ctx, page, log, errors, token };
}
const searches = (log) => log.filter((x) => x.path === '/admin/all');
const last = (log) => searches(log).at(-1)?.query ?? null;
const idle = (page) => page.waitForFunction(() => document.querySelector('.ord-table-wrap')?.getAttribute('aria-busy') === 'false', { timeout: 10000 }).then(() => sleep(120)).catch(() => {});
const view = (page) => page.evaluate(() => {
  const vis = (el) => el && el.offsetParent !== null;
  const cards = [...document.querySelectorAll('.ord-cards .ord-card .ord-id')].map((e) => e.textContent);
  return {
    count: document.querySelector('.ord-head p')?.textContent ?? '',
    ids: vis(document.querySelector('.ord-table-wrap'))
      ? [...document.querySelectorAll('.ord-table-wrap tbody tr .ord-id')].map((e) => e.textContent)
      : cards,
    statuses: [...document.querySelectorAll('.ord-table-wrap tbody tr')].map((tr) => tr.children[4]?.innerText.trim()).filter(Boolean),
    experts: [...document.querySelectorAll('.ord-table-wrap tbody tr')].map((tr) => tr.children[6]?.innerText.trim()),
    pager: document.querySelector('.pager .t-xs')?.textContent ?? null,
    body: document.querySelector('main')?.innerText ?? document.body.innerText,
    dateErr: [...document.querySelectorAll('.field-error')].map((e) => e.textContent).join(' '),
    overflow: document.documentElement.scrollWidth - window.innerWidth,
  };
});
async function setInput(page, sel, text) {
  await page.$eval(sel, (el) => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(el, ''); el.dispatchEvent(new Event('input', { bubbles: true })); });
  if (text) await page.type(sel, text, { delay: 25 });
}
async function setDate(page, label, value) {
  await page.$eval(`input[aria-label="${label}"]`, (el, v) => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}
const clickText = (page, sel, re) => page.$$eval(sel, (els, src) => {
  const el = els.find((e) => new RegExp(src).test(e.textContent.trim()));
  if (el) el.click();
  return Boolean(el);
}, re.source);
const csv = (page) => page.evaluate(() => window.__csv.at(-1) ?? null);
const csvLines = (text) => (text ?? '').replace(/^﻿/, '').trim().split(/\r\n/);

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };

for (const role of ['ADMIN', 'SUPER_ADMIN']) {
  console.log(`\n${role} — desktop`);
  Object.assign(state, { viaDto: false, withNames: false, fail: null });
  const { ctx, page, log, errors, token } = await open(role, DESKTOP);
  await idle(page);
  let v = await view(page);
  let q = last(log);

  // First load
  check('one /admin/all request on load', searches(log).length === 1, searches(log).length);
  check('load query is page=0&size=15 only (no status, keyword, dates, sort)', q && q.page === '0' && q.size === '15' && Object.keys(q).length === 2, q);
  check('request carries the session bearer token', searches(log).every((x) => x.auth === `Bearer ${token}`));
  check('table shows the 15 newest orders from /admin/all', v.ids.length === 15 && v.ids[0] === 'OD-1230' && v.ids[14] === 'OD-1216', v.ids);
  check('no request to the removed /orders/all', !log.some((x) => x.path === '/orders/all'));
  check('count reads the server total, newest first', /230 orders · newest first/.test(v.count), v.count);
  check('pager: page 1 of 16', /Page 1 of 16 · 230 orders/.test(v.pager ?? ''), v.pager);
  check('"All fields" select is gone (endpoint has no searchType)', !(await page.$('select[aria-label="Search field"]')));
  await shot(page, `orders-${role}-desktop`);

  // Expert column without expert fields
  const assignedIdx = v.statuses.findIndex((s) => /Assigned|In progress|Submitted/i.test(s));
  const pendingIdx = v.statuses.findIndex((s) => /review/i.test(s));
  check('assigned-status row with no name says "Assigned", not "Unassigned"', assignedIdx >= 0 && v.experts[assignedIdx] === 'Assigned', { s: v.statuses[assignedIdx], e: v.experts[assignedIdx] });
  check('no row claims "Unassigned" when the server sent no expert field', !v.experts.includes('Unassigned'), v.experts);
  check('pre-assignment row shows "—"', pendingIdx >= 0 && v.experts[pendingIdx] === '—', v.experts[pendingIdx]);

  // Paging
  await page.click('.pager button[aria-label="Next page"]');
  await idle(page); v = await view(page); q = last(log);
  check('Next → page=1&size=15', q.page === '1' && q.size === '15', q);
  check('page 2 shows OD-1215…OD-1201', v.ids[0] === 'OD-1215' && v.ids[14] === 'OD-1201', v.ids);
  await clickText(page, '.pager .pg-n', /^3$/);
  await idle(page); q = last(log);
  check('page 3 button → page=2', q.page === '2', q);

  // Status tab resets to page 0 in the same request
  const before = searches(log).length;
  await clickText(page, '.seg button', /^Assigned$/);
  await idle(page); v = await view(page);
  const sinceStatus = searches(log).slice(before).map((x) => x.query);
  check('status tab → exactly one request, status=ASSIGNED&page=0', sinceStatus.length === 1 && sinceStatus[0].status === 'ASSIGNED' && sinceStatus[0].page === '0', sinceStatus);
  check('Assigned tab rows are all Assigned', v.statuses.length > 0 && v.statuses.every((s) => /^Assigned$/i.test(s)), v.statuses);
  check('count says the orders match', /\d+ orders match/.test(v.count), v.count);
  for (const [label, value] of [['Needs review', 'REVIEW_PENDING'], ['In review', 'UNDER_REVIEW'], ['Priced', 'PRICE_SET'], ['In progress', 'IN_PROGRESS'], ['Submitted', 'SUBMITTED'], ['Completed', 'COMPLETED'], ['Cancelled', 'CANCELLED']]) {
    await clickText(page, '.seg button', new RegExp(`^${label}$`));
    await idle(page);
    check(`"${label}" tab → status=${value}`, last(log).status === value, last(log));
  }
  await clickText(page, '.seg button', /^All$/);
  await idle(page);
  check('"All" tab sends no status', !('status' in last(log)), last(log));

  // Keyword: debounced, prefix removed
  const kwBefore = searches(log).length;
  await setInput(page, '.ord-search input', 'OD-1212');
  await sleep(700); await idle(page); v = await view(page);
  const kwReqs = searches(log).slice(kwBefore).map((x) => x.query);
  check('typing "OD-1212" sends one request, after the debounce', kwReqs.length === 1, kwReqs);
  check('"OD-" prefix removed → keyword=1212', kwReqs[0]?.keyword === '1212' && kwReqs[0]?.page === '0', kwReqs[0]);
  check('row OD-1212 shown', v.ids.includes('OD-1212'), v.ids);
  await setInput(page, '.ord-search input', '  statistics  ');
  await sleep(700); await idle(page); v = await view(page);
  check('keyword is trimmed → keyword=statistics', last(log).keyword === 'statistics', last(log));
  check('statistics results shown', v.ids.length > 0 && /orders match/.test(v.count), v.count);

  // Country
  await setInput(page, '.ord-search input', '');
  await setInput(page, '.ord-country input', '  Canada ');
  await sleep(700); await idle(page); q = last(log);
  check('country is trimmed → country=Canada, no keyword', q.country === 'Canada' && !('keyword' in q), q);

  // Created date range
  await setInput(page, '.ord-country input', '');
  await sleep(600);
  await setDate(page, 'Created from', '2026-09-01');
  await setDate(page, 'Created to', '2026-09-30');
  await sleep(300); await idle(page); q = last(log); v = await view(page);
  check('dates → fromDate=2026-09-01T00:00:00 & toDate=2026-09-30T23:59:59', q.fromDate === '2026-09-01T00:00:00' && q.toDate === '2026-09-30T23:59:59', q);
  check('date range results shown', v.ids.length > 0, v.count);

  // Reversed range: not sent, explained
  const revBefore = searches(log).length;
  await setDate(page, 'Created from', '2026-10-05');
  await sleep(300); await idle(page); v = await view(page);
  const revReqs = searches(log).slice(revBefore).map((x) => x.query);
  check('reversed range → explained under the filters', /end date is before the start date/.test(v.dateErr), v.dateErr);
  check('reversed range → no request carries the reversed dates', revReqs.every((x) => !x.fromDate && !x.toDate), revReqs);

  // Clear filters — still offered while the reversed range isn't applied
  const cleared = await clickText(page, '.ord-bar button', /^Clear filters$/);
  await sleep(700); await idle(page); q = last(log); v = await view(page);
  const dateVals = await page.$$eval('.ord-dates input', (els) => els.map((e) => e.value));
  check('Clear filters is offered with a reversed (unapplied) range', cleared);
  check('Clear filters empties both date fields and the error', dateVals.every((x) => x === '') && !/end date is before/.test(v.dateErr), { dateVals, e: v.dateErr });
  check('Clear filters → back to page=0&size=15 only', Object.keys(q).length === 2 && q.page === '0', q);
  check('Clear filters → full list again', /230 orders · newest first/.test(v.count), v.count);

  // No results
  await setInput(page, '.ord-search input', 'zzz-nothing');
  await sleep(700); await idle(page); v = await view(page);
  check('no results → "No orders match" with Clear filters', /No orders match/.test(v.body) && /Clear filters/.test(v.body), v.body.slice(0, 200));
  check('no results → count reads 0, no pager', /^0 orders match/.test(v.count) && v.pager === null, { c: v.count, p: v.pager });
  await setInput(page, '.ord-search input', '');
  await sleep(700); await idle(page);

  // Errors
  state.fail = 500;
  await clickText(page, '.seg button', /^Submitted$/);
  await idle(page); v = await view(page);
  check('500 with a status → says the status may not be accepted, offers Retry', /may not accept this status/.test(v.body) && /Retry|Try again/.test(v.body), v.body.slice(0, 300));
  check('500 → count says search unavailable, export disabled', /Search unavailable/.test(v.count) && await page.$eval('.ord-head button', (b) => b.disabled), v.count);
  state.fail = null;
  await clickText(page, '.seg button', /^All$/);
  await idle(page);
  state.fail = 400;
  await setDate(page, 'Created from', '2026-09-01');
  await idle(page); v = await view(page);
  check('400 with dates → says the date filter could not be read', /couldn.t read the date filter/.test(v.body), v.body.slice(0, 300));
  state.fail = null;
  await setDate(page, 'Created from', '');
  await idle(page); v = await view(page);
  check('recovers after the error', v.ids.length === 15, v.ids.length);

  // Spring Data VIA_DTO page shape
  state.viaDto = true;
  await page.click('.pager button[aria-label="Next page"]');
  await idle(page); v = await view(page);
  check('VIA_DTO shape ({content, page:{…}}) → rows and totals still read', v.ids[0] === 'OD-1215' && /Page 2 of 16 · 230 orders/.test(v.pager ?? ''), { ids: v.ids[0], p: v.pager, q: last(log) });
  state.viaDto = false;
  await clickText(page, '.pager .pg-n', /^1$/);
  await idle(page);

  // A slow search superseded by a newer one must not overwrite it
  await setInput(page, '.ord-search input', 'slowpoke');
  await sleep(550); // debounce fired; the slow request is in flight
  await clickText(page, '.seg button', /^Completed$/);
  await sleep(2200); await idle(page); v = await view(page);
  check('superseded slow response does not overwrite the newer search', /No orders match/.test(v.body) && !v.ids.some((id) => /OD-12(2[6-9]|30)/.test(id)), { ids: v.ids, c: v.count });
  check('Clear filters found after the slow-search case', await clickText(page, '.ord-bar button', /^Clear filters$/));
  await sleep(700); await idle(page);

  // Expert names, once the backend sends them
  state.withNames = true;
  await page.click('.pager button[aria-label="Next page"]');
  await idle(page); v = await view(page);
  check('when rows include assignedEmployeeName, it is shown', v.experts.some((e) => /^Expert \d$/.test(e)), v.experts);
  state.withNames = false;
  await clickText(page, '.pager .pg-n', /^1$/);
  await idle(page);

  // Selection across pages + export selected
  await page.$$eval('.ord-table-wrap tbody tr input.check', (els) => { els[0].click(); els[1].click(); });
  await page.click('.pager button[aria-label="Next page"]');
  await idle(page);
  await page.$$eval('.ord-table-wrap tbody tr input.check', (els) => els[0].click());
  v = await view(page);
  check('selection survives paging (3 selected)', /3\s*selected/.test(v.body), v.body.slice(0, 200));
  await clickText(page, '.bulk button', /Export selected/);
  await sleep(400);
  let lines = csvLines(await csv(page));
  check('Export selected includes rows from the previous page', lines.length === 4 && lines.some((l) => l.startsWith('"OD-1230"')) && lines.some((l) => l.startsWith('"OD-1215"')), lines.map((l) => l.slice(0, 12)));
  await clickText(page, '.bulk button', /^Clear$/);

  // Export every matching order, 100 per request
  const exBefore = searches(log).length;
  await clickText(page, '.ord-head button', /Export CSV/);
  await page.waitForFunction(() => window.__csv.length >= 2, { timeout: 10000 }).catch(() => {});
  await sleep(300);
  const exReqs = searches(log).slice(exBefore).map((x) => x.query);
  lines = csvLines(await csv(page));
  check('Export CSV pages through the search at size=100 (pages 0, 1, 2)', exReqs.length === 3 && exReqs.every((x, i) => x.size === '100' && x.page === String(i)), exReqs);
  check('Export CSV has all 230 matching orders, newest first', lines.length === 231 && lines[1].startsWith('"OD-1230"'), lines.length);
  check('CSV Type column uses assignmentType', /"(Essay|Online Class)"/.test(lines[1] ?? ''), lines[1]);

  // Dialogs that need fields the search rows don't carry
  await clickText(page, '.pager .pg-n', /^1$/);
  await idle(page);
  const detBefore = log.length;
  await page.$eval('.ord-table-wrap button[aria-label="Edit deadlines for OD-1230"]', (b) => b.click());
  await page.waitForFunction(() => document.querySelector('#dl-expert')?.value, { timeout: 5000 }).catch(() => {});
  const dl = await page.evaluate(() => ({ expert: document.querySelector('#dl-expert')?.value, student: document.querySelector('#dl-student')?.value }));
  check('Edit deadlines reads the expert deadline from GET /admin/orders/{id}', log.slice(detBefore).some((x) => x.path === '/admin/orders/1230') && dl.expert === '2026-10-20T18:00', dl);
  check('Edit deadlines keeps the student deadline from the row', Boolean(dl.student), dl);
  await page.keyboard.press('Escape'); await sleep(300);

  const reassign = await page.evaluate(() => {
    const row = [...document.querySelectorAll('.ord-table-wrap tbody tr')].find((tr) => /Reassign/.test(tr.innerText));
    const btn = row && [...row.querySelectorAll('button')].find((b) => /Reassign/.test(b.textContent));
    btn?.click();
    return Boolean(btn);
  });
  await sleep(500);
  const dlg = await page.evaluate(() => document.querySelector('[role="dialog"]')?.innerText ?? '');
  check('Assign dialog opens from a search row without "Student unknown"', reassign && /Reassign order/.test(dlg) && !/Student unknown/.test(dlg), dlg.slice(0, 160));
  await page.keyboard.press('Escape'); await sleep(300);

  await page.$$eval('.ord-table-wrap tbody tr', (rows) => {
    const b = [...rows[0].querySelectorAll('button')].find((x) => /Edit$/.test(x.textContent.trim()));
    b?.click();
  });
  await page.waitForSelector('#oe-level', { timeout: 6000 }).catch(() => {});
  const ed = await page.evaluate(() => document.querySelector('[role="dialog"]')?.innerText ?? '');
  check('Edit order: level hint when the details omit academicLevel', /don.t include the saved level/.test(ed), ed.slice(0, 300));
  await page.keyboard.press('Escape'); await sleep(300);

  check('still no request to /orders/all after every action', !log.some((x) => x.path === '/orders/all'));
  check('no page errors or React warnings', errors.length === 0, errors);
  check('every /admin/all request has size 1–100 and page ≥ 0, never a sort param', searches(log).every((x) => +x.query.size >= 1 && +x.query.size <= 100 && +x.query.page >= 0 && !('sort' in x.query)));
  await ctx.close();

  // Order detail: fields the detail DTO doesn't send
  {
    const { ctx: c2, page: p2 } = await open(role, DESKTOP, '/admin/orders/1212');
    await p2.waitForFunction(() => /Academic level/.test(document.body.innerText), { timeout: 10000 }).catch(() => {});
    const f = await p2.evaluate(() => Object.fromEntries([...document.querySelectorAll('.od-field')].map((e) => [e.querySelector('.od-field-lbl')?.textContent, e.querySelector('.od-field-val')?.textContent])));
    check('detail: academicLevel absent from the response → "Not available"', f['Academic level'] === 'Not available', f);
    check('detail: university sent as null → "Not provided"', f['University'] === 'Not provided', f);
    check('detail: subject still shown', /1212/.test(f['Subject'] ?? ''), f['Subject']);
    await c2.close();
  }

  console.log(`${role} — phone`);
  {
    Object.assign(state, { viaDto: false, withNames: false, fail: null });
    const { ctx: c3, page: p3, log: l3, errors: e3 } = await open(role, PHONE);
    await idle(p3);
    let pv = await view(p3);
    check('phone: 15 order cards from /admin/all', pv.ids.length === 15 && pv.ids[0] === 'OD-1230', pv.ids.length);
    check('phone: no horizontal overflow', pv.overflow <= 0, pv.overflow);
    const vis = await p3.evaluate(() => ['.ord-search input', '.ord-country input', 'input[aria-label="Created from"]', 'input[aria-label="Created to"]'].map((s) => {
      const r = document.querySelector(s)?.getBoundingClientRect();
      return r && r.width >= 120 && r.left >= 15.5 && r.right <= window.innerWidth - 15.5;
    }));
    check('phone: search, country and both dates fit inside the 16px gutters', vis.every(Boolean), vis);
    await shot(p3, `orders-${role}-phone`);
    await setInput(p3, '.ord-search input', 'OD-1205');
    await sleep(700); await idle(p3); pv = await view(p3);
    check('phone: search works (keyword=1205)', last(l3).keyword === '1205' && pv.ids.includes('OD-1205'), { q: last(l3), ids: pv.ids });
    check('phone: count reads "1 order matches"', /^1 order matches/.test(pv.count), pv.count);
    await setDate(p3, 'Created from', '2026-10-05');
    await setDate(p3, 'Created to', '2026-10-01');
    await sleep(400); pv = await view(p3);
    const filled = await p3.evaluate(() => [...document.querySelectorAll('.ord-dates input')].map((i) => {
      const r = i.getBoundingClientRect();
      return r.right <= window.innerWidth - 15.5;
    }));
    check('phone: reversed dates explained, no overflow', /end date is before/.test(pv.dateErr) && pv.overflow <= 0, { e: pv.dateErr, o: pv.overflow });
    check('phone: filled date fields stay inside the gutter', filled.every(Boolean), filled);
    await shot(p3, `orders-${role}-phone-filters`);
    check('phone: no page errors', e3.length === 0, e3);
    await c3.close();
  }
}

await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
