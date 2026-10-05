import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
const BASE = process.env.BASE;
let pass = 0, fail = 0;
const ok = (n, c, x = '') => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  → ' + x : ''}`); };
const args = chromium.args.filter((a) => a !== '--single-process');
const browser = await puppeteer.launch({ args, executablePath: await chromium.executablePath(), headless: true });
const ctx = await browser.createBrowserContext();           // no session: a public visitor
const page = await ctx.newPage();
await page.setViewport({ width: 1280, height: 900 });
const load = async (url) => {
  const res = await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 250));
  return { status: res.status(), path: await page.evaluate(() => location.pathname),
           body: await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ')) };
};

console.log('\n── New pages load publicly, no login ──');
for (const url of ['/sms', '/contact']) {
  const r = await load(url);
  ok(`${url} HTTP ${r.status}, stays on ${r.path}`, r.status === 200 && r.path === url);
}

console.log('\n── /sms explains the programme BEFORE consent ──');
{
  const { body } = await load('/sms');
  for (const [label, needle] of [
    ['sender identified', 'QTIServices (qtiservices.com)'],
    ['no marketing texts claimed', 'we do not send marketing or promotional texts'],
    ['six message categories', 'Inquiries Appointments Tutoring services Project updates Payment links Customer support'],
    ['opt-in is optional', 'Consent is not a condition of purchasing'],
    ['frequency varies', 'Message frequency varies'],
    ['rates may apply', 'Message and data rates may apply'],
    ['STOP', 'Reply STOP'],
    ['HELP', 'Reply HELP'],
    ['consent never assumed', 'actively checks the SMS consent box'],
    ['legal acceptance ≠ opt-in', 'separate action that does not opt you in'],
    ['no third-party/affiliate marketing sharing', 'will not be shared with third parties or affiliates for their own marketing purposes'],
    ['service-provider carve-out', 'service providers that help us operate our messaging program'],
    ['opting out does not cancel the request', 'does not cancel a service request'],
  ]) ok(`  ${label}`, body.includes(needle), body.includes(needle) ? '' : `missing "${needle.slice(0,46)}…"`);

  const order = await page.evaluate(() => {
    const t = document.body.innerText;
    return t.indexOf('Message frequency varies') < t.indexOf('I agree to receive text messages');
  });
  ok('  disclosure appears ABOVE the consent checkbox', order);

  for (const href of ['/privacy-policy', '/terms-of-service', '/messaging-terms']) {
    ok(`  links to ${href}`, await page.evaluate((h) => !!document.querySelector(`main a[href="${h}"]`), href));
  }
}

console.log('\n── The opt-in form on /sms behaves like the homepage one ──');
{
  const boxes = await page.evaluate(() => [...document.querySelectorAll('.lp-form-check')].map((l) => ({
    checked: l.querySelector('input').checked, required: l.querySelector('input').required,
    links: !!l.querySelector('a[href="/privacy-policy"]') && !!l.querySelector('a[href="/messaging-terms"]'),
    sms: /text messages/i.test(l.innerText),
  })));
  ok('  two checkboxes, SMS optional+unchecked, legal required+unchecked',
     boxes.length === 2 && !boxes[0].checked && !boxes[0].required && boxes[0].sms && !boxes[0].links
     && !boxes[1].checked && boxes[1].required && boxes[1].links && !boxes[1].sms);
  const fill = async (sms, legal, phone) => {
    await page.goto(`${BASE}/sms`, { waitUntil: 'networkidle0' });
    await page.type('#pf-first', 'Ada'); await page.type('#pf-last', 'Lovelace');
    await page.type('#pf-email', 'ada@example.com');
    if (phone) await page.type('#pf-phone', '+1 585 522 2449');
    await page.type('#pf-message', 'Please contact me about a cloud project.');
    const i = await page.$$('.lp-form-check input');
    if (sms) await i[0].click();
    if (legal) await i[1].click();
    await new Promise((r) => setTimeout(r, 150));
    return page.evaluate(() => document.querySelector('.lp-form-submit').disabled);
  };
  ok('  SMS off, legal ON → can submit', (await fill(false, true, true)) === false);
  ok('  SMS ON,  legal off → CANNOT submit', (await fill(true, false, true)) === true);
  ok('  phone empty, legal ON → can submit', (await fill(false, true, false)) === false);
}

console.log('\n── /contact ──');
{
  const { body } = await load('/contact');
  ok('  shows the email address', body.includes('support@qtiservices.com'));
  ok('  shows the office address', body.includes('485 Madison Ave'));
  ok('  says a phone number is optional', /no phone number required|phone number is optional/i.test(body));
  ok('  links to the SMS program', await page.evaluate(() => !!document.querySelector('main a[href="/sms"]')));
  ok('  carries the same opt-in form', await page.evaluate(() => document.querySelectorAll('.lp-form-check').length === 2));
}

console.log('\n── Reachable from the rest of the site, and nothing broken ──');
{
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' });
  for (const href of ['/contact', '/sms', '/privacy-policy', '/terms-of-service', '/messaging-terms']) {
    ok(`  footer links to ${href}`, await page.evaluate((h) => !!document.querySelector(`footer a[href="${h}"]`), href));
  }
  // the old Support Centre link pointed at #cta, which does not exist on legal pages
  await page.goto(`${BASE}/privacy-policy`, { waitUntil: 'networkidle0' });
  const dead = await page.evaluate(() => [...document.querySelectorAll('footer a[href^="#"]')].map((a) => a.getAttribute('href')));
  ok('  no footer anchor links that go nowhere on a legal page', dead.length === 0, dead.join(','));
}

console.log('\n── Headings and mobile ──');
{
  for (const url of ['/sms', '/contact']) {
    await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle0' });
    const { h1, skips } = await page.evaluate(() => {
      const lv = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((e) => +e.tagName[1]);
      const s = []; for (let i = 1; i < lv.length; i++) if (lv[i] - lv[i-1] > 1) s.push(`h${lv[i-1]}→h${lv[i]}`);
      return { h1: lv.filter((l) => l === 1).length, skips: [...new Set(s)] };
    });
    ok(`  ${url} one h1, no skipped levels`, h1 === 1 && skips.length === 0, `h1=${h1} ${skips.join(',')}`);
  }
  await page.setViewport({ width: 390, height: 844 });
  for (const url of ['/sms', '/contact']) {
    await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle0' });
    const over = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    ok(`  ${url} no horizontal overflow at 390px`, !over);
  }
}

await ctx.close(); await browser.close();
console.log(`\n  ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
