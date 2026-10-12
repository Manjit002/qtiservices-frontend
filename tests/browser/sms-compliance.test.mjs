import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
const BASE = process.env.BASE;
let pass = 0, fail = 0;
const ok = (n, c, x = '') => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  → ' + x : ''}`); };
const args = chromium.args.filter((a) => a !== '--single-process');
const browser = await puppeteer.launch({ args, executablePath: await chromium.executablePath(), headless: true });
const ctx = await browser.createBrowserContext();       // no session at all: a real public visitor
const page = await ctx.newPage();
await page.setViewport({ width: 1280, height: 900 });
const text = async (url) => {
  const res = await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 250));
  return { status: res.status(), path: await page.evaluate(() => location.pathname),
           body: await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ')) };
};

console.log('\n── Public pages load with NO session (never redirected to a login) ──');
for (const url of ['/', '/privacy-policy', '/terms-of-service', '/messaging-terms', '/blog', '/services']) {
  const r = await text(url);
  ok(`${url.padEnd(18)} HTTP ${r.status}, stays on ${r.path}`, r.status === 200 && r.path === url && !/login/.test(r.path));
}

console.log('\n── Privacy Policy: required wording, on the live page ──');
{
  const { body } = await text('/privacy-policy');
  const must = [
    ['section heading', 'SMS and Mobile Information'],
    ['permitted use of mobile info', 'we may use your mobile information to send messages related to your inquiries, appointments, tutoring services, project updates, payment links, and customer support'],
    ['NOT shared for third-party/affiliate marketing', 'will not be shared with third parties or affiliates for their own marketing purposes'],
    ['service-provider carve-out', 'service providers that help us operate our messaging program, subject to appropriate confidentiality obligations'],
    ['message frequency', 'Message frequency varies'],
    ['message & data rates', 'Message and data rates may apply'],
    ['STOP', 'replying STOP'],
    ['HELP', 'reply HELP'],
    ['consent optional / not a condition', 'not a condition of purchasing'],
    ['how to contact about your information', 'support@qtiservices.com'],
    ['how to request your data', 'ask what information we hold about you'],
    ['how to withdraw SMS consent', 'To withdraw SMS consent'],
    ['link to Messaging Terms', 'Messaging Terms'],
  ];
  for (const [label, needle] of must) ok(`  ${label}`, body.includes(needle), body.includes(needle) ? '' : `missing: "${needle.slice(0, 48)}…"`);
  ok('  does NOT claim mobile info is shared with third parties', !/We share your mobile information with third parties/i.test(body));
}

console.log('\n── Terms of Service: SMS Terms section ──');
{
  const { body } = await text('/terms-of-service');
  for (const [label, needle] of [
    ['section heading', 'SMS Terms'],
    ['message purpose', 'inquiries, appointments, tutoring services, project updates, payment links, and customer support'],
    ['frequency may vary', 'Message frequency may vary'],
    ['rates may apply', 'Message and data rates may apply'],
    ['STOP', 'Reply STOP to opt out at any time'],
    ['HELP', 'Reply HELP for assistance'],
    ['references the Privacy Policy', 'Privacy Policy'],
    ['relationship to Messaging Terms is stated', 'Messaging Terms'],
  ]) ok(`  ${label}`, body.includes(needle), body.includes(needle) ? '' : `missing: "${needle.slice(0, 48)}…"`);
}

console.log('\n── Messaging Terms: consistent, non-contradictory ──');
{
  const { body } = await text('/messaging-terms');
  for (const [label, needle] of [
    ['same six message categories', 'Inquiries Appointments Tutoring services Project updates Payment links Customer support'],
    ['no third-party/affiliate marketing sharing', 'will not be shared with third parties or affiliates for their own marketing purposes'],
    ['service-provider carve-out', 'service providers that help us operate this messaging program'],
    ['frequency varies', 'Message frequency varies'],
    ['rates may apply', 'Message and data rates may apply'],
    ['STOP', 'STOP'], ['HELP', 'HELP'],
    ['not a condition of purchase', 'not a condition of purchase'],
    ['opt-in required before messages', 'actively opt in'],
    ['relationship to the Terms is stated', 'Terms of Service'],
  ]) ok(`  ${label}`, body.includes(needle), body.includes(needle) ? '' : `missing: "${needle.slice(0, 48)}…"`);
}

console.log('\n── Footer legal links work from a public page, with no session ──');
{
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' });
  for (const [label, href] of [['Privacy Policy', '/privacy-policy'], ['Terms of Service', '/terms-of-service'], ['Messaging Terms', '/messaging-terms']]) {
    const found = await page.evaluate((h) => !!document.querySelector(`footer a[href="${h}"]`), href);
    ok(`  footer links to ${label}`, found);
  }
}

console.log('\n── Contact form: consent separation and the five submit cases ──');
{
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' });
  const boxes = await page.evaluate(() => [...document.querySelectorAll('.lp-form-check')].map((l) => ({
    checked: l.querySelector('input').checked,
    required: l.querySelector('input').required,
    hasPolicyLinks: !!l.querySelector('a[href="/privacy-policy"]') && !!l.querySelector('a[href="/messaging-terms"]'),
    mentionsSms: /text messages/i.test(l.innerText),
  })));
  ok('  exactly two consent checkboxes', boxes.length === 2, String(boxes.length));
  ok('  SMS box: optional, unchecked, no policy links inside', boxes[0] && !boxes[0].checked && !boxes[0].required && !boxes[0].hasPolicyLinks && boxes[0].mentionsSms);
  ok('  Legal box: required, unchecked, links both pages, no SMS language', boxes[1] && !boxes[1].checked && boxes[1].required && boxes[1].hasPolicyLinks && !boxes[1].mentionsSms);
  ok('  phone field is not required', await page.evaluate(() => !document.querySelector('#pf-phone').required));

  const fill = async (sms, legal, phone) => {
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' });
    await page.evaluate(() => { document.querySelector('#pf-first').scrollIntoView(); });
    await page.type('#pf-first', 'Ada'); await page.type('#pf-last', 'Lovelace');
    await page.type('#pf-email', 'ada@example.com');
    if (phone) await page.type('#pf-phone', '+1 585 522 2449');
    await page.type('#pf-message', 'Please get in touch about a cloud migration project.');
    const inputs = await page.$$('.lp-form-check input');
    if (sms) await inputs[0].click();
    if (legal) await inputs[1].click();
    await new Promise((r) => setTimeout(r, 150));
    return page.evaluate(() => document.querySelector('.lp-form-submit').disabled);
  };
  ok('  Case 1  SMS off, legal ON,  phone filled → can submit', (await fill(false, true, true)) === false);
  ok('  Case 2  SMS ON,  legal ON,  phone filled → can submit', (await fill(true, true, true)) === false);
  ok('  Case 3  SMS ON,  legal off → CANNOT submit', (await fill(true, false, true)) === true);
  ok('  Case 4  SMS off, legal off → CANNOT submit', (await fill(false, false, true)) === true);
  ok('  Case 5  phone EMPTY, legal ON → can submit', (await fill(false, true, false)) === false);
}

console.log('\n── Mobile (390px) ──');
{
  await page.setViewport({ width: 390, height: 844 });
  for (const url of ['/privacy-policy', '/terms-of-service', '/messaging-terms']) {
    await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle0' });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    ok(`  ${url} no horizontal overflow`, !overflow);
  }
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' });
  const tap = await page.evaluate(() => {
    const el = document.querySelector('.lp-form-check input');
    const r = el.getBoundingClientRect();
    const label = el.closest('label').getBoundingClientRect();
    return { box: Math.min(r.width, r.height), labelWide: label.width <= window.innerWidth };
  });
  ok('  consent checkbox is tappable (>=16px) and its label fits the screen', tap.box >= 16 && tap.labelWide, `${tap.box}px`);
}

await ctx.close(); await browser.close();
console.log(`\n  ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
