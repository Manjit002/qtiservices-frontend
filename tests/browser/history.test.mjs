import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

const BASE = process.env.BASE;
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  cond ? pass++ : fail++;
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  → ' + extra : ''}`);
};

// --single-process is @sparticuz/chromium's Lambda default; it crashes when a
// second browser context is created, which each scenario needs for clean storage.
const args = chromium.args.filter((a) => a !== '--single-process');
const browser = await puppeteer.launch({ args, executablePath: await chromium.executablePath(), headless: true });

async function fresh(viewport = { width: 1280, height: 860 }) {
  const ctx = await browser.createBrowserContext();       // isolated storage per scenario
  const page = await ctx.newPage();
  await page.setViewport(viewport);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // Every API call answers 503: never a 401/403, so the auth-redirect path in the
  // API client can't fire. The test then measures routing and the guard only.
  await page.setRequestInterception(true);
  page.on('request', (r) => {
    const h = r.headers();
    // Next fetches the RSC payload for client-side navigation via fetch(); stubbing
    // it forces a full page load and would misreport soft navigation as hard.
    const isRsc = h['rsc'] || h['next-router-prefetch'] || h['next-router-state-tree'] || r.url().includes('_rsc=');
    if (isRsc) return r.continue();
    return ['fetch', 'xhr', 'eventsource'].includes(r.resourceType())
      ? r.respond({ status: 503, contentType: 'application/json', body: '{"message":"test stub"}' })
      : r.continue();
  });
  return { ctx, page, errors };
}

const path = (page) => page.evaluate(() => location.pathname + location.search);
const settle = async (page, want) => {
  try {
    await page.waitForFunction((w) => location.pathname + location.search === w, { timeout: 8000 }, want);
  } catch {}
  await new Promise((r) => setTimeout(r, 350));   // let React paint the new page
};
const title = (page) => page.evaluate(() => document.querySelector('.crumb strong')?.textContent?.trim() ?? '');
const active = (page) => page.evaluate(() =>
  document.querySelector('a.nav-item[aria-current="page"]')?.getAttribute('href') ?? '');
const seed = (page, role, email) => page.evaluate((role, email) => {
  localStorage.setItem('token', 'test.jwt.token');
  localStorage.setItem('refreshToken', 'test.refresh');
  localStorage.setItem('userId', '7');
  localStorage.setItem('userRole', role);
  localStorage.setItem('userEmail', email);
}, role, email);
const click = async (page, href) => {
  await page.click(`a.nav-item[href="${href}"]`);
  await settle(page, href);
};
const back = async (page, want) => { await page.goBack(); await settle(page, want); };
const fwd = async (page, want) => { await page.goForward(); await settle(page, want); };

// ────────────────────────────────────────────────────────────────────────────
console.log('\n── ADMIN: the reported bug, and full Back / Forward chain ──');
{
  const { ctx, page, errors } = await fresh();
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' });       // a real prior page
  await seed(page, 'SUPER_ADMIN', 'owner@qtiservices.com');
  await page.goto(`${BASE}/admin/login`, { waitUntil: 'networkidle0' });
  await settle(page, '/admin/dashboard');
  ok('signed-in visit to /admin/login forwards to /admin/dashboard', (await path(page)) === '/admin/dashboard', await path(page));

  await click(page, '/admin/orders');
  ok('sidebar Orders → URL /admin/orders', (await path(page)) === '/admin/orders');
  ok('  title reads "Orders"', (await title(page)) === 'Orders', await title(page));
  ok('  sidebar highlights Orders', (await active(page)) === '/admin/orders');

  await back(page, '/admin/dashboard');
  ok('BACK from Orders → /admin/dashboard (the reported bug)', (await path(page)) === '/admin/dashboard', await path(page));
  ok('  title reads "Dashboard"', (await title(page)) === 'Dashboard', await title(page));

  await click(page, '/admin/orders');
  await click(page, '/admin/reviews');
  ok('Orders → Reviews → URL /admin/reviews', (await path(page)) === '/admin/reviews');
  await back(page, '/admin/orders');
  ok('BACK from Reviews → /admin/orders', (await path(page)) === '/admin/orders', await path(page));
  await back(page, '/admin/dashboard');
  ok('BACK again → /admin/dashboard', (await path(page)) === '/admin/dashboard', await path(page));
  await back(page, '/');
  const after = await path(page);
  ok('BACK past the dashboard → the page before sign-in, NOT the login form', after === '/', after);

  await fwd(page, '/admin/dashboard');
  ok('FORWARD → /admin/dashboard', (await path(page)) === '/admin/dashboard', await path(page));
  await fwd(page, '/admin/orders');
  ok('FORWARD → /admin/orders', (await path(page)) === '/admin/orders', await path(page));
  await fwd(page, '/admin/reviews');
  ok('FORWARD → /admin/reviews', (await path(page)) === '/admin/reviews', await path(page));

  await page.goto(`${BASE}/admin/orders`, { waitUntil: 'networkidle0' });
  await page.reload({ waitUntil: 'networkidle0' });
  await settle(page, '/admin/orders');
  ok('REFRESH on /admin/orders stays on /admin/orders (not login)', (await path(page)) === '/admin/orders', await path(page));
  ok('  and still renders the Orders page', (await title(page)) === 'Orders', await title(page));

  ok('no uncaught page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

// ────────────────────────────────────────────────────────────────────────────
console.log('\n── ADMIN: direct URL to every route (SUPER_ADMIN) ──');
{
  const { ctx, page, errors } = await fresh();
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' });
  await seed(page, 'SUPER_ADMIN', 'owner@qtiservices.com');
  const routes = [
    ['/admin/dashboard', 'Dashboard', '/admin/dashboard'],
    ['/admin/orders', 'Orders', '/admin/orders'],
    ['/admin/orders/2417', 'Order detail', '/admin/orders'],
    ['/admin/assign-orders', 'Assign orders', '/admin/assign-orders'],
    ['/admin/deleted-orders', 'Deleted orders', '/admin/deleted-orders'],
    ['/admin/analytics', 'Analytics', '/admin/analytics'],
    ['/admin/students', 'Students', '/admin/students'],
    ['/admin/experts', 'Experts', '/admin/experts'],
    ['/admin/chat', 'Chat', '/admin/chat'],
    ['/admin/chat?order=2417', 'Chat', '/admin/chat'],
    ['/admin/installments', 'Installments', '/admin/installments'],
    ['/admin/verify-payments', 'Verify payments', '/admin/verify-payments'],
    ['/admin/coupons', 'Coupons', '/admin/coupons'],
    ['/admin/create-order', 'Create order', '/admin/create-order'],
    ['/admin/reviews', 'Reviews', '/admin/reviews'],
    ['/admin/external-reviews', 'External review', '/admin/external-reviews'],
    ['/admin/system-overview', 'System overview', '/admin/system-overview'],
    ['/admin/roles-access', 'Roles & access', '/admin/roles-access'],
    ['/admin/add-expert', 'Add expert', '/admin/add-expert'],
  ];
  for (const [url, t, hl] of routes) {
    await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle0' });
    await settle(page, url);
    const p = await path(page), tt = await title(page), a = await active(page);
    ok(`${url.padEnd(26)} loads · "${t}" · highlights ${hl}`, p === url && tt === t && a === hl,
       p !== url ? `landed on ${p}` : tt !== t ? `title "${tt}"` : a !== hl ? `highlighted ${a}` : '');
  }
  ok('no uncaught page errors across all 19', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

// ────────────────────────────────────────────────────────────────────────────
console.log('\n── ADMIN (not super): super-admin URLs are refused, not rendered ──');
{
  const { ctx, page } = await fresh();
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' });
  await seed(page, 'ADMIN', 'staff@qtiservices.com');
  for (const url of ['/admin/system-overview', '/admin/roles-access', '/admin/add-expert']) {
    await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle0' });
    await settle(page, url);
    const txt = await page.evaluate(() => document.body.innerText);
    ok(`${url} shows "Super Admin access required"`, txt.includes('Super Admin access required'));
  }
  const hidden = await page.evaluate(() =>
    ['/admin/system-overview', '/admin/roles-access', '/admin/add-expert']
      .every((h) => !document.querySelector(`a.nav-item[href="${h}"]`)));
  ok('super-admin items are not in an ADMIN\'s sidebar', hidden);
  await page.goto(`${BASE}/admin/orders`, { waitUntil: 'networkidle0' });
  await settle(page, '/admin/orders');
  ok('an ADMIN can still open ordinary pages', (await path(page)) === '/admin/orders');
  await ctx.close();
}

// ────────────────────────────────────────────────────────────────────────────
console.log('\n── AUTH: signed out and wrong portal ──');
{
  const { ctx, page } = await fresh();
  await page.goto(`${BASE}/admin/orders`, { waitUntil: 'networkidle0' });
  await settle(page, '/admin/login');
  ok('signed out → /admin/orders redirects to /admin/login', (await path(page)) === '/admin/login', await path(page));
  const form = await page.evaluate(() => !!document.querySelector('input[type="password"]'));
  ok('  and the login form is shown (not bounced onward)', form);
  await page.goto(`${BASE}/expert/orders`, { waitUntil: 'networkidle0' });
  await settle(page, '/expert/login');
  ok('signed out → /expert/orders redirects to /expert/login', (await path(page)) === '/expert/login', await path(page));

  await seed(page, 'EXPERT', 'writer@qtiservices.com');
  await page.goto(`${BASE}/admin/orders`, { waitUntil: 'networkidle0' });
  await settle(page, '/expert/dashboard');
  ok('an EXPERT opening /admin/orders is sent to /expert/dashboard', (await path(page)) === '/expert/dashboard', await path(page));
  await ctx.close();

  const b = await fresh();
  await b.page.goto(`${BASE}/`, { waitUntil: 'networkidle0' });
  await seed(b.page, 'ADMIN', 'staff@qtiservices.com');
  await b.page.goto(`${BASE}/expert/orders`, { waitUntil: 'networkidle0' });
  await settle(b.page, '/admin/dashboard');
  ok('an ADMIN opening /expert/orders is sent to /admin/dashboard', (await path(b.page)) === '/admin/dashboard', await path(b.page));
  await b.ctx.close();
}

// ────────────────────────────────────────────────────────────────────────────
console.log('\n── EXPERT: Back / Forward / refresh / direct URL ──');
{
  const { ctx, page, errors } = await fresh();
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' });
  await seed(page, 'EXPERT', 'writer@qtiservices.com');
  await page.goto(`${BASE}/expert/login`, { waitUntil: 'networkidle0' });
  await settle(page, '/expert/dashboard');
  ok('signed-in visit to /expert/login forwards to /expert/dashboard', (await path(page)) === '/expert/dashboard', await path(page));

  await click(page, '/expert/orders');
  ok('sidebar My orders → /expert/orders', (await path(page)) === '/expert/orders');
  await click(page, '/expert/deadlines');
  ok('then Deadlines → /expert/deadlines', (await path(page)) === '/expert/deadlines');
  await back(page, '/expert/orders');
  ok('BACK → /expert/orders', (await path(page)) === '/expert/orders', await path(page));
  await back(page, '/expert/dashboard');
  ok('BACK → /expert/dashboard', (await path(page)) === '/expert/dashboard', await path(page));
  await back(page, '/');
  ok('BACK past the dashboard → the page before sign-in, NOT login', (await path(page)) === '/', await path(page));
  await fwd(page, '/expert/dashboard');
  ok('FORWARD → /expert/dashboard', (await path(page)) === '/expert/dashboard', await path(page));

  for (const [url, t] of [['/expert/dashboard','Dashboard'],['/expert/orders','My orders'],['/expert/deadlines','Deadlines'],
                          ['/expert/files','Order files'],['/expert/files?order=2417','Order files'],['/expert/profile','My profile']]) {
    await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle0' });
    await page.reload({ waitUntil: 'networkidle0' });
    await settle(page, url);
    ok(`${url.padEnd(26)} direct + refresh · "${t}"`, (await path(page)) === url && (await title(page)) === t,
       `${await path(page)} "${await title(page)}"`);
  }
  ok('no uncaught page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

// ────────────────────────────────────────────────────────────────────────────
console.log('\n── MOBILE (390px): drawer navigation keeps history ──');
{
  const { ctx, page } = await fresh({ width: 390, height: 844 });
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' });
  await seed(page, 'SUPER_ADMIN', 'owner@qtiservices.com');
  await page.goto(`${BASE}/admin/dashboard`, { waitUntil: 'networkidle0' });
  await page.click('button.menu-btn');
  await new Promise((r) => setTimeout(r, 300));
  ok('drawer opens', await page.evaluate(() => !!document.querySelector('aside.side.open')));
  await click(page, '/admin/students');
  ok('drawer link → /admin/students', (await path(page)) === '/admin/students');
  ok('  drawer closed after navigating', await page.evaluate(() => !document.querySelector('aside.side.open')));
  await back(page, '/admin/dashboard');
  ok('BACK on mobile → /admin/dashboard', (await path(page)) === '/admin/dashboard', await path(page));
  await page.click('button.menu-btn');
  await new Promise((r) => setTimeout(r, 300));
  await page.click('a.nav-item[href="/admin/dashboard"]');
  await new Promise((r) => setTimeout(r, 400));
  ok('tapping the CURRENT page closes the drawer too', await page.evaluate(() => !document.querySelector('aside.side.open')));
  await ctx.close();
}

await browser.close();
console.log(`\n  ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
