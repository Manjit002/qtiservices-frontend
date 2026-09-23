import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
const BASE = process.env.BASE;
let pass = 0, fail = 0;
const ok = (n, c, x = '') => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  → ' + x : ''}`); };
const args = chromium.args.filter((a) => a !== '--single-process');
const browser = await puppeteer.launch({ args, executablePath: await chromium.executablePath(), headless: true });

const ADMIN = ['/admin/dashboard','/admin/orders','/admin/orders/2417','/admin/assign-orders','/admin/deleted-orders',
  '/admin/analytics','/admin/students','/admin/experts','/admin/chat','/admin/installments','/admin/verify-payments',
  '/admin/coupons','/admin/create-order','/admin/reviews','/admin/external-reviews','/admin/system-overview',
  '/admin/roles-access','/admin/add-expert'];
const EXPERT = ['/expert/dashboard','/expert/orders','/expert/deadlines','/expert/files','/expert/profile'];

const ctx = await browser.createBrowserContext();
const page = await ctx.newPage();
await page.setViewport({ width: 1280, height: 900 });
const react = [], uncaught = [];
page.on('pageerror', (e) => uncaught.push(e.message));
page.on('console', (m) => {
  const t = m.text();
  if (/Warning:|hydrat|unique "key"|Each child|validateDOMNesting|cannot appear as a descendant/i.test(t)) react.push(t.slice(0, 160));
});
await page.setRequestInterception(true);
page.on('request', (r) => {
  const h = r.headers();
  const isRsc = h['rsc'] || h['next-router-prefetch'] || h['next-router-state-tree'] || r.url().includes('_rsc=');
  return (!isRsc && ['fetch','xhr','eventsource'].includes(r.resourceType()))
    ? r.respond({ status: 503, contentType: 'application/json', body: '{"message":"stub"}' })
    : r.continue();
});

await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' });
await page.evaluate(() => {
  localStorage.setItem('token','t'); localStorage.setItem('userId','7');
  localStorage.setItem('userRole','SUPER_ADMIN'); localStorage.setItem('userEmail','owner@qtiservices.com');
});

console.log('\n── Heading structure on every portal page ──');
const bad = [];
for (const url of [...ADMIN, ...EXPERT]) {
  await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 300));
  const { h1, skips } = await page.evaluate(() => {
    const lv = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((e) => +e.tagName[1]);
    const skips = [];
    for (let i = 1; i < lv.length; i++) if (lv[i] - lv[i-1] > 1) skips.push(`h${lv[i-1]}→h${lv[i]}`);
    return { h1: lv.filter((l) => l === 1).length, skips: [...new Set(skips)] };
  });
  if (h1 !== 1 || skips.length) bad.push(`${url}: h1=${h1}${skips.length ? ' ' + skips.join(',') : ''}`);
}
ok(`all ${ADMIN.length + EXPERT.length} portal pages have exactly one h1 and no skipped levels`, bad.length === 0, bad.slice(0, 6).join(' | '));

console.log('\n── React correctness (only visible at runtime) ──');
ok('no hydration mismatch / duplicate-key / DOM-nesting warnings', react.length === 0, [...new Set(react)].slice(0, 3).join(' | '));
ok('no uncaught exceptions', uncaught.length === 0, uncaught.slice(0, 2).join(' | '));

console.log('\n── Layout persistence (the point of the route group) ──');
await page.goto(`${BASE}/admin/dashboard`, { waitUntil: 'networkidle0' });
await page.evaluate(() => { window.__shellProbe = document.querySelector('aside.side'); });
await page.click('a.nav-item[href="/admin/orders"]');
await page.waitForFunction(() => location.pathname === '/admin/orders', { timeout: 8000 });
await new Promise((r) => setTimeout(r, 300));
const same = await page.evaluate(() => window.__shellProbe === document.querySelector('aside.side'));
ok('sidebar is the SAME DOM node after navigating (layout not remounted)', same);
const navCount = await page.evaluate(() => document.querySelectorAll('aside.side').length);
ok('exactly one sidebar rendered (no duplicated shell)', navCount === 1, String(navCount));

await ctx.close();
await browser.close();
console.log(`\n  ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
