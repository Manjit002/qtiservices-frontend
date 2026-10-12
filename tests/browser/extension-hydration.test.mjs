/**
 * Browser extensions vs hydration.
 *
 * Form-fill and password extensions add attributes such as `fdprocessedid` to
 * inputs and buttons before React hydrates. In development that produced
 * "A tree hydrated but some attributes of the server rendered HTML didn't
 * match" on every public form. This test simulates such an extension (tagging
 * each control as the parser creates it) and expects NO hydration warnings.
 *
 * Needs a DEV server — production React does not report attribute mismatches:
 *   npx next dev -p 7600
 *   BASE=http://localhost:7600 node extension-hydration.test.mjs
 * EXT=0 runs the same pages without the simulated extension.
 */
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
const BASE = process.env.BASE; const EXT = process.env.EXT !== '0';
const PAGES = (process.env.PAGES ?? '/,/contact,/sms,/admin/login,/expert/login,/admin/dashboard,/expert/dashboard,/admin/chat').split(',');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (role) => `${b64({ alg: 'HS256' })}.${b64({ sub: '3', role, exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
const browser = await puppeteer.launch({ args: chromium.args.filter((a) => a !== '--single-process'), executablePath: await chromium.executablePath(), headless: true });
let total = 0; let failed = 0;
for (const p of PAGES) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  const msgs = [];
  page.on('console', (m) => { const t = m.text(); if (/hydrat|did not match|didn't match/i.test(t)) msgs.push(t.split('\n')[0].slice(0, 120)); });
  if (EXT) await page.evaluateOnNewDocument(() => {
    // Mimic a form-fill extension: tag form controls as the parser creates them.
    let n = 0;
    const tag = (el) => { if (el.nodeType === 1 && /^(INPUT|BUTTON|SELECT|TEXTAREA)$/.test(el.tagName) && !el.hasAttribute('fdprocessedid')) el.setAttribute('fdprocessedid', 'x' + (++n)); };
    new MutationObserver((recs) => recs.forEach((r) => r.addedNodes.forEach((nd) => { tag(nd); nd.querySelectorAll?.('input,button,select,textarea').forEach(tag); }))).observe(document, { childList: true, subtree: true });
  });
  if (p.startsWith('/admin/d') || p.startsWith('/admin/c') || p.startsWith('/expert/d')) {
    const role = p.startsWith('/expert') ? 'EXPERT' : 'SUPER_ADMIN';
    await page.evaluateOnNewDocument((t, r) => { localStorage.setItem('token', t); localStorage.setItem('userRole', r); localStorage.setItem('userId', '3'); localStorage.setItem('userEmail', 'a@b.c'); }, jwt(role), role);
  }
  await page.setRequestInterception(true);
  page.on('request', (r) => {
    const u = new URL(r.url()); const h = r.headers();
    const rsc = h.rsc || h['next-router-prefetch'] || u.searchParams.has('_rsc');
    if (u.hostname.endsWith('googleapis.com') || u.hostname.endsWith('gstatic.com')) return r.respond({ status: 200, contentType: 'text/css', body: '' });
    if (!rsc && ['fetch', 'xhr'].includes(r.resourceType()) && !u.pathname.startsWith('/_next')) return r.respond({ status: 503, contentType: 'application/json', body: '{}' });
    r.continue();
  });
  await page.goto(BASE + p, { waitUntil: 'networkidle0', timeout: 120000 }).catch((e) => msgs.push('NAV ' + e.message));
  await new Promise((r) => setTimeout(r, 1500));
  const tagged = await page.evaluate(() => document.querySelectorAll('[fdprocessedid]').length);
  total += msgs.length;
  const ok = msgs.length === 0 && (!EXT || tagged > 0);
  if (!ok) failed += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ` + `${p.padEnd(20)} tagged:${String(tagged).padStart(3)}  hydration warnings: ${msgs.length}${msgs.length ? '  ← ' + msgs[0] : ''}`);
  await page.close();
}
await browser.close();
console.log(`
  ${PAGES.length - failed}/${PAGES.length} pages without hydration warnings (${total} warnings)`);
process.exit(failed ? 1 : 0);
