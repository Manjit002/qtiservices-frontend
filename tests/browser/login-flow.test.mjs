/**
 * Employee sign-in with mandatory 2FA, driven through the real form.
 *
 *   POST /auth/employee/login      → { requiresTwoFactor, challengeToken, … }  (no tokens)
 *   POST /auth/employee/verify-otp → { accessToken, refreshToken, userId, role }
 *
 * Both endpoints are scripted per scenario; every other API call answers 503 so
 * the client's 401/403 logout path can never fire by accident. Next's RSC
 * requests are passed through (see README).
 */
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

const BASE = process.env.BASE;
let pass = 0, fail = 0;
const ok = (n, c, x = '') => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${x !== '' ? '  → ' + x : ''}`); };
const args = chromium.args.filter((a) => a !== '--single-process');
const browser = await puppeteer.launch({ args, executablePath: await chromium.executablePath(), headless: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Values the app must never log, store early, or put in a URL.
const PASSWORD = 'SECRET-pass-w0rd!';
const OTP = '483921';
const ACCESS = 'SECRET_ACCESS.jwt.7f3';
const REFRESH = 'SECRET_REFRESH_19c';
const chal = (n) => `SECRET_CHALLENGE_${n}`;

const MSG = {
  credentials: 'Incorrect email or password. Please try again.',
  invalidOtp: 'Invalid verification code. Please check the code and try again.',
  expired: 'This verification code has expired. Please log in again.',
  used: 'This verification code has already been used. Please log in again.',
  attempts: 'Maximum verification attempts exceeded. Please log in again.',
  session: 'Your login session has expired. Please log in again.',
  inactive: 'Your employee account is inactive. Please contact your administrator.',
  network: "We couldn't reach the server. Check your connection and try again.",
  server: 'Something went wrong on our side. Please try again in a moment.',
  bad: "Sign-in couldn't be completed. Please try again.",
};
const OTP_HELP = "We've sent a 6-digit verification code to your registered email address.";
const AUTH_KEYS = ['token', 'refreshToken', 'userId', 'userRole', 'userEmail'];

const challengeOk = (role = 'ADMIN') => (n) => ({
  status: 200,
  body: { requiresTwoFactor: true, message: 'OTP sent to your registered email address', challengeToken: chal(n), userId: 7, role },
});
const tokensOk = (role = 'ADMIN') => () => ({
  status: 200, body: { accessToken: ACCESS, refreshToken: REFRESH, userId: 7, role },
});

async function open({ login, verify, viewport } = {}) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport(viewport ?? { width: 1280, height: 860 });
  const calls = { login: [], verify: [] };
  const logs = [];
  const errors = [];
  page.on('console', (m) => logs.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  const handlers = { login, verify };
  await page.setRequestInterception(true);
  page.on('request', async (r) => {
    const u = r.url();
    const which = /\/auth\/employee\/login(\?|$)/.test(u) ? 'login'
      : /\/auth\/employee\/verify-otp(\?|$)/.test(u) ? 'verify' : null;
    if (which && r.method() === 'POST') {
      let body = null;
      try { body = JSON.parse(r.postData() ?? ''); } catch { /* recorded raw below */ }
      calls[which].push({ url: u, raw: r.postData(), body, headers: r.headers() });
      const h = handlers[which];
      const spec = h ? h(calls[which].length, body) : { status: 503, body: { message: 'unscripted' } };
      if (spec.delay) await sleep(spec.delay);
      if (spec.abort) return r.abort('failed');
      return r.respond({
        status: spec.status,
        contentType: spec.contentType ?? 'application/json',
        body: typeof spec.body === 'string' ? spec.body : JSON.stringify(spec.body ?? {}),
      });
    }
    const hd = r.headers();
    const isRsc = hd['rsc'] || hd['next-router-prefetch'] || hd['next-router-state-tree'] || u.includes('_rsc=');
    if (!isRsc && ['fetch', 'xhr', 'eventsource'].includes(r.resourceType()))
      return r.respond({ status: 503, contentType: 'application/json', body: '{"message":"stub"}' });
    r.continue();
  });
  return { ctx, page, calls, logs, errors, handlers };
}

const path = (page) => page.evaluate(() => location.pathname);
const settle = async (page, want) => {
  try { await page.waitForFunction((w) => location.pathname === w, { timeout: 8000 }, want); } catch {}
  await sleep(350);
};
const stored = (page) => page.evaluate((keys) => Object.fromEntries(keys.map((k) => [k, localStorage.getItem(k)])), AUTH_KEYS);
const nothingStored = async (page) => Object.values(await stored(page)).every((v) => v === null);
/** Everywhere a token could leak to in the page: storage, cookies, URL. */
const everywhere = (page) => page.evaluate(() =>
  JSON.stringify({ ls: { ...localStorage }, ss: { ...sessionStorage }, c: document.cookie, href: location.href }));
const onOtpStep = (page) => page.evaluate(() =>
  !!document.querySelector('#otp') && document.querySelector('h2')?.textContent === 'Verify Your Identity');
const onLoginStep = (page) => page.evaluate(() => !!document.querySelector('#password') && !document.querySelector('#otp'));
const alertText = (page) => page.evaluate(() => document.querySelector('.auth-alert.err')?.textContent.trim() ?? '');
const submitText = (page) => page.evaluate(() => document.querySelector('button[type=submit]')?.innerText.trim() ?? '');
const otpValue = (page) => page.evaluate(() => document.querySelector('#otp')?.value ?? null);
const clickText = (page, text) => page.evaluate((t) => {
  const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim().includes(t));
  b?.click(); return !!b;
}, text);
const waitAny = (page, sel, ms = 8000) => page.waitForFunction(
  (s) => s.some((q) => document.querySelector(q)), { timeout: ms }, sel).catch(() => {});

async function goLogin(page, portal) {
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' });
  await page.goto(`${BASE}/${portal}/login`, { waitUntil: 'networkidle0' });
}
async function submitPassword(page, email, pw = PASSWORD) {
  await page.click('#email', { clickCount: 3 }); await page.type('#email', email);
  await page.click('#password', { clickCount: 3 }); await page.type('#password', pw);
  await page.keyboard.press('Enter');
  await waitAny(page, ['#otp', '.auth-alert.err']);
  await sleep(150);
}
async function submitCode(page, code = OTP) {
  if (!(await page.$('#otp'))) return;   // reported by the caller's assertions, not a crash
  await page.$eval('#otp', (el) => el.select());
  await page.type('#otp', code);
  await page.keyboard.press('Enter');
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Full flow, ADMIN on the admin portal ──');
{
  const s = await open({
    login: (n) => ({ ...challengeOk('ADMIN')(n), delay: 500 }),
    verify: () => ({ ...tokensOk('ADMIN')(), delay: 500 }),
  });
  const { page, calls } = s;
  await goLogin(page, 'admin');
  ok('step 1 shows email + password, button "Login"', (await onLoginStep(page)) && (await submitText(page)) === 'Login', await submitText(page));

  await page.type('#email', 'owner@qtiservices.com');
  await page.type('#password', PASSWORD);
  await page.evaluate(() => { const f = document.querySelector('form'); f.requestSubmit(); f.requestSubmit(); });
  await sleep(150);
  ok('while the password is checked the button reads "Logging in..."', (await submitText(page)) === 'Logging in...', await submitText(page));
  await waitAny(page, ['#otp']); await sleep(150);
  ok('double submit sends ONE login request', calls.login.length === 1, calls.login.length);
  ok('login body is exactly { email, password }',
    JSON.stringify(calls.login[0]?.body) === JSON.stringify({ email: 'owner@qtiservices.com', password: PASSWORD }), calls.login[0]?.raw);
  ok('login request carries no Authorization header', !calls.login[0]?.headers.authorization);

  ok('OTP step: "Verify Your Identity"', await onOtpStep(page));
  ok('OTP step: exact sent-code message', (await page.evaluate(() => document.querySelector('#otp-help')?.textContent.trim())) === OTP_HELP);
  ok('no page change: still /admin/login, no query, no hash',
    await page.evaluate(() => location.pathname === '/admin/login' && !location.search && !location.hash));
  ok('password field is gone (and the value with it)', !(await page.$('#password')));
  ok('NO token, refresh token, role, id or email stored after the password step', await nothingStored(page), JSON.stringify(await stored(page)));
  ok('challengeToken is not in storage, cookies or the URL', !(await everywhere(page)).includes(chal(1)));
  ok('OTP field is focused', (await page.evaluate(() => document.activeElement?.id)) === 'otp');
  const attrs = await page.evaluate(() => { const e = document.querySelector('#otp'); return e ? [e.getAttribute('inputmode'), e.getAttribute('autocomplete'), e.getAttribute('maxlength')].join('|') : 'missing'; });
  ok('OTP field: numeric keypad, one-time-code autofill, 6 max', attrs === 'numeric|one-time-code|6', attrs);
  ok('buttons: "Verify & Continue" and "Back to Login"',
    (await submitText(page)) === 'Verify & Continue' && (await page.evaluate(() => [...document.querySelectorAll('button')].some((b) => b.innerText.trim() === 'Back to Login'))));

  if (await page.$('#otp')) await page.type('#otp', '12ab3');
  ok('letters are dropped as you type', (await otpValue(page)) === '123', await otpValue(page));
  await page.keyboard.press('Enter'); await sleep(200);
  ok('a short code is refused locally, with no request', calls.verify.length === 0 &&
    (await page.evaluate(() => document.querySelector('#otp-err')?.textContent)) === 'Enter the 6-digit code from your email.');

  await page.evaluate(() => {
    const el = document.querySelector('#otp'); if (!el) return;
    el.select();
    const dt = new DataTransfer(); dt.setData('text/plain', 'Your code: 483-921');
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  await sleep(100);
  ok('pasting "Your code: 483-921" yields 483921', (await otpValue(page)) === OTP, await otpValue(page));

  await page.evaluate(() => { const f = document.querySelector('form'); f.requestSubmit(); f.requestSubmit(); });
  await page.click('button[type=submit]').catch(() => {});
  await sleep(150);
  ok('while verifying the button reads "Verifying..."', (await submitText(page)) === 'Verifying...', await submitText(page));
  await settle(page, '/admin/dashboard');
  ok('double submit + click sends ONE verify request', calls.verify.length === 1, calls.verify.length);
  ok('verify body is exactly { challengeToken, otp }',
    JSON.stringify(calls.verify[0]?.body) === JSON.stringify({ challengeToken: chal(1), otp: OTP }), calls.verify[0]?.raw);
  ok('OTP and challenge are in the body, not the URL', !calls.verify[0]?.url.includes('?'));
  ok('verify request carries no Authorization header', !calls.verify[0]?.headers.authorization);
  const st = await stored(page);
  ok('tokens stored only now: access, refresh, role, id, email',
    st.token === ACCESS && st.refreshToken === REFRESH && st.userRole === 'ADMIN' && st.userId === '7' && st.userEmail === 'owner@qtiservices.com', JSON.stringify(st));
  ok('ADMIN → /admin/dashboard', (await path(page)) === '/admin/dashboard', await path(page));

  await page.click('a.nav-item[href="/admin/orders"]'); await settle(page, '/admin/orders');
  await page.goBack(); await settle(page, '/admin/dashboard');
  ok('BACK from orders → dashboard', (await path(page)) === '/admin/dashboard', await path(page));
  await page.goBack(); await settle(page, '/');
  ok('BACK again → the page before sign-in, NOT the login form', (await path(page)) === '/', await path(page));

  const leaked = s.logs.filter((l) => [PASSWORD, OTP, ACCESS, REFRESH, chal(1)].some((v) => l.includes(v)));
  ok('console never shows password, OTP, challenge, access or refresh token', leaked.length === 0, leaked.join(' | '));
  ok('no uncaught page errors', s.errors.length === 0, s.errors.join(' | '));
  await s.ctx.close();
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Every role goes through the OTP step, then its own dashboard ──');
for (const [portal, role, want] of [
  ['admin', 'SUPER_ADMIN', '/admin/dashboard'],
  ['expert', 'EXPERT', '/expert/dashboard'],
  ['admin', 'EXPERT', '/expert/dashboard'],
  ['expert', 'ADMIN', '/admin/dashboard'],
  ['admin', 'MANAGER', '/admin/dashboard'],
]) {
  const s = await open({ login: challengeOk(role), verify: tokensOk(role) });
  await goLogin(s.page, portal);
  await submitPassword(s.page, 'person@qtiservices.com');
  const gated = (await onOtpStep(s.page)) && (await nothingStored(s.page));
  await submitCode(s.page);
  await settle(s.page, want);
  ok(`${role} via /${portal}/login: OTP required, nothing stored before it → ${want}`,
    gated && (await path(s.page)) === want && (await stored(s.page)).userRole === role, await path(s.page));
  await s.ctx.close();
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Back to Login, then a fresh challenge ──');
{
  const s = await open({ login: challengeOk('ADMIN'), verify: tokensOk('ADMIN') });
  const { page, calls } = s;
  await goLogin(page, 'admin');
  await submitPassword(page, 'owner@qtiservices.com');
  if (await page.$('#otp')) await page.type('#otp', '111');
  ok('"Back to Login" button present', await clickText(page, 'Back to Login'));
  await sleep(250);
  ok('back on step 1, OTP field gone', await onLoginStep(page));
  ok('email kept, password empty, no error shown',
    (await page.evaluate(() => document.querySelector('#email')?.value)) === 'owner@qtiservices.com' &&
    (await page.evaluate(() => document.querySelector('#password')?.value)) === '' && (await alertText(page)) === '');
  ok('focus returns to the password field', (await page.evaluate(() => document.activeElement?.id)) === 'password');
  ok('still nothing stored', await nothingStored(page));
  ok('no verify request was ever sent for the abandoned challenge', calls.verify.length === 0);
  await page.type('#password', PASSWORD); await page.keyboard.press('Enter');
  await waitAny(page, ['#otp']); await sleep(150);
  ok('logging in again asks for a NEW challenge, with an empty code field', calls.login.length === 2 && (await otpValue(page)) === '');
  await submitCode(page);
  await settle(page, '/admin/dashboard');
  ok('verification uses the new challenge, not the abandoned one', calls.verify[0]?.body?.challengeToken === chal(2), calls.verify[0]?.body?.challengeToken);
  await s.ctx.close();
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── OTP-step failures ──');
const stack = 'java.lang.RuntimeException: boom\n\tat com.mocp.myonlineclasspro.security.service.AuthService.verifyEmployeeOtp(AuthService.java:212)';
for (const c of [
  { name: '400 "Invalid OTP"', r: { status: 400, body: { message: 'Invalid OTP' } }, msg: MSG.invalidOtp, stay: true },
  { name: '400 "Invalid OTP. 2 attempts remaining" (not exhausted)', r: { status: 400, body: { message: 'Invalid OTP. 2 attempts remaining' } }, msg: MSG.invalidOtp, stay: true },
  { name: '500 {"message":"Invalid OTP"} (wording beats status)', r: { status: 500, body: { message: 'Invalid OTP' } }, msg: MSG.invalidOtp, stay: true },
  { name: '403 with an empty body', r: { status: 403, body: '' }, msg: MSG.invalidOtp, stay: true },
  { name: '400 "OTP has expired"', r: { status: 400, body: { message: 'OTP has expired' } }, msg: MSG.expired, stay: false },
  { name: '400 "OTP already used"', r: { status: 400, body: { message: 'OTP already used' } }, msg: MSG.used, stay: false },
  { name: '400 "Maximum OTP attempts exceeded"', r: { status: 400, body: { message: 'Maximum OTP attempts exceeded' } }, msg: MSG.attempts, stay: false },
  { name: '429 with no body', r: { status: 429, body: '' }, msg: MSG.attempts, stay: false },
  { name: '401 "Invalid or expired challenge token"', r: { status: 401, body: { message: 'Invalid or expired challenge token' } }, msg: MSG.session, stay: false },
  { name: '403 "Employee account is inactive"', r: { status: 403, body: { message: 'Employee account is inactive' } }, msg: MSG.inactive, stay: false },
  { name: '200 without an accessToken', r: { status: 200, body: { message: 'ok' } }, msg: MSG.bad, stay: false },
  { name: '500 stack trace as text/plain', r: { status: 500, body: stack, contentType: 'text/plain' }, msg: MSG.server, stay: true },
  { name: 'network failure', r: { abort: true }, msg: MSG.network, stay: true },
]) {
  const s = await open({ login: challengeOk('ADMIN'), verify: () => c.r });
  await goLogin(s.page, 'admin');
  await submitPassword(s.page, 'owner@qtiservices.com');
  await s.page.evaluate(() => { window.__noReload = 1; });
  await submitCode(s.page);
  await waitAny(s.page, ['.auth-alert.err']); await sleep(200);
  const text = await alertText(s.page);
  const where = c.stay ? await onOtpStep(s.page) : await onLoginStep(s.page);
  const intact = await s.page.evaluate(() => window.__noReload === 1 && location.pathname === '/admin/login');
  const raw = await s.page.evaluate(() => document.body.innerText);
  ok(`${c.name} → "${c.msg.slice(0, 38)}…" and ${c.stay ? 'stays on the code step' : 'back to email + password'}`,
    text === c.msg && where && intact && (await nothingStored(s.page)), `${text} | step ok: ${where} | no reload: ${intact}`);
  if (c.name.startsWith('500 stack')) ok('  …and no backend detail reaches the screen', !/Exception|com\.mocp|AuthService|java\./.test(raw));
  if (c.name === '400 "Invalid OTP"') {
    ok('  …the wrong code stays in the field, selected for retyping',
      await s.page.evaluate(() => { const e = document.querySelector('#otp'); return !!e && e.value === '483921' && e.selectionStart === 0 && e.selectionEnd === 6 && document.activeElement === e; }));
    s.handlers.verify = tokensOk('ADMIN');
    await submitCode(s.page);
    await settle(s.page, '/admin/dashboard');
    ok('  …and a retry with the SAME challenge then succeeds',
      (await path(s.page)) === '/admin/dashboard' && s.calls.verify.length === 2 && s.calls.verify[1].body.challengeToken === chal(1));
  }
  await s.ctx.close();
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Password-step failures ──');
for (const c of [
  { name: '401 "Bad credentials"', r: { status: 401, body: { message: 'Bad credentials' } }, msg: MSG.credentials },
  { name: '404 "Employee not found" (same answer as a wrong password)', r: { status: 404, body: { message: 'Employee not found' } }, msg: MSG.credentials },
  { name: '403 "Employee account is inactive"', r: { status: 403, body: { message: 'Employee account is inactive' } }, msg: MSG.inactive },
  { name: '500 stack trace as text/plain', r: { status: 500, body: stack, contentType: 'text/plain' }, msg: MSG.server },
  { name: 'network failure', r: { abort: true }, msg: MSG.network },
  { name: 'pre-2FA response: accessToken, no challenge (fail closed)', r: { status: 200, body: { accessToken: 'LEGACY.jwt', refreshToken: 'r', userId: 1, role: 'ADMIN' } }, msg: MSG.bad },
]) {
  const s = await open({ login: () => c.r });
  await goLogin(s.page, 'admin');
  await submitPassword(s.page, 'owner@qtiservices.com');
  const text = await alertText(s.page);
  ok(`${c.name} → "${c.msg.slice(0, 40)}…", no OTP step, nothing stored`,
    text === c.msg && (await onLoginStep(s.page)) && (await nothingStored(s.page)) && (await path(s.page)) === '/admin/login', text);
  await s.ctx.close();
}
{
  // Even if the backend ever sent a token alongside the challenge, step 1 must not store it.
  const s = await open({ login: (n) => ({ status: 200, body: { requiresTwoFactor: true, challengeToken: chal(n), accessToken: 'SHOULD_NOT_BE_STORED', role: 'ADMIN' } }) });
  await goLogin(s.page, 'admin');
  await submitPassword(s.page, 'owner@qtiservices.com');
  ok('a token sent WITH the challenge is ignored: OTP step shown, nothing stored',
    (await onOtpStep(s.page)) && (await nothingStored(s.page)) && !(await everywhere(s.page)).includes('SHOULD_NOT_BE_STORED'));
  await s.ctx.close();
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── A pending challenge is not a session ──');
{
  const s = await open({ login: challengeOk('ADMIN') });
  await goLogin(s.page, 'admin');
  await submitPassword(s.page, 'owner@qtiservices.com');
  await s.page.goto(`${BASE}/admin/dashboard`, { waitUntil: 'networkidle0' }); await settle(s.page, '/admin/login');
  ok('typing /admin/dashboard during the OTP step → back to /admin/login', (await path(s.page)) === '/admin/login', await path(s.page));
  ok('…showing step 1, not a resumed challenge', await onLoginStep(s.page));
  await s.ctx.close();
}
{
  const s = await open({ login: challengeOk('EXPERT') });
  await goLogin(s.page, 'expert');
  await submitPassword(s.page, 'writer@qtiservices.com');
  await s.page.goto(`${BASE}/expert/orders`, { waitUntil: 'networkidle0' }); await settle(s.page, '/expert/login');
  ok('typing /expert/orders during the OTP step → /expert/login', (await path(s.page)) === '/expert/login', await path(s.page));
  await s.ctx.close();
}
{
  const s = await open({ login: challengeOk('ADMIN') });
  await goLogin(s.page, 'admin');
  await submitPassword(s.page, 'owner@qtiservices.com');
  await s.page.reload({ waitUntil: 'networkidle0' });
  ok('refresh during the OTP step → step 1, challenge discarded, nothing stored',
    (await onLoginStep(s.page)) && (await nothingStored(s.page)));
  await submitPassword(s.page, 'owner@qtiservices.com');
  await s.page.evaluate(() => { window.__sameDocument = 1; });
  await s.page.goto(`${BASE}/`, { waitUntil: 'networkidle0' });
  await s.page.goBack({ waitUntil: 'networkidle0' }); await sleep(400);
  const restored = await s.page.evaluate(() => window.__sameDocument === 1);
  console.log(`  info  back/forward cache ${restored ? 'DID' : 'did not'} restore the page in this run`);
  ok('leave the page during the OTP step, come Back → step 1',
    (await path(s.page)) === '/admin/login' && (await onLoginStep(s.page)), await path(s.page));
  await s.ctx.close();
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Phone-sized OTP step ──');
{
  const s = await open({ login: challengeOk('EXPERT'), viewport: { width: 375, height: 667, isMobile: true, hasTouch: true } });
  await goLogin(s.page, 'expert');
  await submitPassword(s.page, 'writer@qtiservices.com');
  const m = await s.page.evaluate(() => {
    const i = document.querySelector('#otp').getBoundingClientRect();
    const b = document.querySelector('button[type=submit]').getBoundingClientRect();
    return {
      overflow: document.documentElement.scrollWidth > window.innerWidth,
      inputH: i.height,
      font: parseFloat(getComputedStyle(document.querySelector('#otp')).fontSize),
      btnVisible: b.top >= 0 && b.bottom <= window.innerHeight,
      btnH: b.height,
    };
  });
  ok('no horizontal overflow at 375px', !m.overflow);
  ok('code field ≥ 44px tall', m.inputH >= 44, m.inputH);
  ok('code text ≥ 16px (no iOS zoom on focus)', m.font >= 16, m.font);
  ok('"Verify & Continue" visible without scrolling, ≥ 40px tall', m.btnVisible && m.btnH >= 40, JSON.stringify(m));
  await s.ctx.close();
}

await browser.close();
console.log(`\n  ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
