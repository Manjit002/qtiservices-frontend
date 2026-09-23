import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
const BASE = process.env.BASE;
let pass = 0, fail = 0;
const ok = (n, c, x = '') => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  → ' + x : ''}`); };
const args = chromium.args.filter((a) => a !== '--single-process');
const browser = await puppeteer.launch({ args, executablePath: await chromium.executablePath(), headless: true });

async function run(portal, role, email, dash, firstLink) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 1280, height: 860 });
  await page.setRequestInterception(true);
  page.on('request', (r) => {
    if (r.url().endsWith('/auth/employee/login') && r.method() === 'POST') {
      return r.respond({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ accessToken: 'test.jwt.token', refreshToken: 'test.refresh', userId: 7, role }) });
    }
    const h = r.headers();
    const isRsc = h['rsc'] || h['next-router-prefetch'] || h['next-router-state-tree'] || r.url().includes('_rsc=');
    if (!isRsc && ['fetch', 'xhr', 'eventsource'].includes(r.resourceType()))
      return r.respond({ status: 503, contentType: 'application/json', body: '{"message":"stub"}' });
    r.continue();
  });
  const path = () => page.evaluate(() => location.pathname);
  const settle = async (w) => { try { await page.waitForFunction((w) => location.pathname === w, { timeout: 8000 }, w); } catch {} await new Promise((r) => setTimeout(r, 350)); };

  await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' });                 // the page before signing in
  await page.goto(`${BASE}/${portal}/login`, { waitUntil: 'networkidle0' });
  ok(`${portal}: login form shown when signed out`, await page.evaluate(() => !!document.querySelector('#password')));
  await page.type('#email', email);
  await page.type('#password', 'correct horse battery');
  await page.keyboard.press('Enter');
  await settle(dash);
  ok(`${portal}: submitting the REAL form signs in → ${dash}`, (await path()) === dash, await path());

  await page.click(`a.nav-item[href="${firstLink}"]`);
  await settle(firstLink);
  ok(`${portal}: sidebar → ${firstLink}`, (await path()) === firstLink);
  await page.goBack(); await settle(dash);
  ok(`${portal}: BACK → ${dash}`, (await path()) === dash, await path());
  await page.goBack(); await settle('/');
  const p = await path();
  ok(`${portal}: BACK again → the page before sign-in, NOT /${portal}/login`, p === '/', p);
  await ctx.close();
}

console.log('\n── Real sign-in form, then Back ──');
await run('admin', 'SUPER_ADMIN', 'owner@qtiservices.com', '/admin/dashboard', '/admin/orders');
await run('expert', 'EXPERT', 'writer@qtiservices.com', '/expert/dashboard', '/expert/orders');
await browser.close();
console.log(`\n  ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
