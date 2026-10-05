/**
 * Visual + structural audit of every portal page.
 *
 * Renders all 23 admin/expert pages against FIXTURE data (test-only; nothing
 * here ships), in three views — desktop dark, desktop light, phone — and
 * writes a full-page screenshot of each plus an automated report:
 *
 *   - horizontal overflow on the page, and which elements cause it
 *   - tap targets under 32px on the phone view
 *   - buttons / links with no accessible name, inputs with no label
 *   - any surface still rendering inside the legacy stylesheet
 *   - uncaught page errors
 *
 *   BASE=http://localhost:7600 OUT=/tmp/shots node visual-audit.mjs [filter]
 */
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const BASE = process.env.BASE;
const OUT = process.env.OUT ?? './audit';
const FILTER = process.argv[2] ?? '';
const VIEWS = (process.env.VIEWS ?? 'desk-dark,desk-light,phone').split(',');
fs.mkdirSync(OUT, { recursive: true });

// ── Fixtures ────────────────────────────────────────────────────────────────
const NOW = Date.now(), H = 36e5, D = 24 * H;
const ldt = (off) => new Date(NOW + off).toISOString().slice(0, 19);   // LocalDateTime, no zone

const students = [
  [501, 'Wade Morgan', 'wade.morgan@gmail.com', '+1 585 201 4471'],
  [502, 'Priya Raman', 'priya.raman@outlook.com', '+1 646 330 1192'],
  [503, 'Lucas Chen', 'lucas.chen@yahoo.com', null],
  [504, 'Amara Okafor', 'amara.okafor@gmail.com', '+44 7700 900123'],
  [505, 'Sofia Alvarez', 'sofia.alvarez@icloud.com', '+1 917 555 0145'],
  [506, 'Ethan Brooks', 'ethan.brooks@gmail.com', null],
  [507, 'Hana Suzuki', 'hana.suzuki@proton.me', '+1 213 555 0177'],
  [508, 'Omar Haddad', 'omar.haddad@gmail.com', '+971 50 123 4567'],
];
const experts = [
  { id: 21, name: 'Dr. Elena Petrova', email: 'elena.petrova@qtiservices.com', role: 'EXPERT', active: true, availabilityStatus: 'AVAILABLE', phone: '+1 585 410 2210' },
  { id: 22, name: 'Marcus Lee', email: 'marcus.lee@qtiservices.com', role: 'EXPERT', active: true, availabilityStatus: 'AVAILABLE' },
  { id: 23, name: 'Aisha Bello', email: 'aisha.bello@qtiservices.com', role: 'EXPERT', active: true, availabilityStatus: 'BUSY' },
  { id: 24, name: 'Daniel Kim', email: 'daniel.kim@qtiservices.com', role: 'EXPERT', active: true, availabilityStatus: 'AVAILABLE' },
  { id: 25, name: 'Grace Liu', email: 'grace.liu@qtiservices.com', role: 'EXPERT', active: false, availabilityStatus: 'OFFLINE' },
];
const admins = [
  { id: 3, name: 'Ravi Sharma', email: 'ravi.sharma@qtiservices.com', role: 'SUPER_ADMIN', active: true },
  { id: 4, name: 'Nina Patel', email: 'nina.patel@qtiservices.com', role: 'ADMIN', active: true },
  { id: 5, name: 'Tom Becker', email: 'tom.becker@qtiservices.com', role: 'ADMIN', active: false },
];
const O = (id, subject, type, level, s, status, pay, dl, exp, price, paid, extra = {}) => {
  const [studentId, studentName, studentEmail, studentPhone] = students[s];
  const e = exp == null ? null : experts[exp];
  return {
    id, subject, type, assignmentType: type, academicLevel: level, university: ['Arizona State University', 'University of Toronto', 'NYU', 'Penn State', 'UCLA'][id % 5],
    status, paymentStatus: pay, deadline: ldt(dl), clientDeadline: ldt(dl), expertDeadline: e ? ldt(dl - 12 * H) : null,
    price, finalPrice: price, totalPrice: price, paidAmount: paid, remainingAmount: price == null ? null : Math.max(0, price - paid),
    studentId, studentName, studentEmail, studentPhone,
    assignedEmployeeId: e?.id ?? null, assignedEmployeeName: e?.name ?? null, assignedEmployeeEmail: e?.email ?? null, assignedEmployeeRole: e ? 'EXPERT' : null,
    createdAt: ldt(-((id % 9) + 1) * D), ...extra,
  };
};
const orders = [
  O(1056, 'Organic Chemistry Lab Report: Acid–Base Titration', 'Lab Report', 'Undergraduate', 0, 'REVIEW_PENDING', 'PENDING', 2 * D, null, null, 0),
  O(1055, 'Hypothesis Testing Homework (t-tests, ANOVA)', 'Homework', 'Undergraduate', 1, 'UNDER_REVIEW', 'PENDING', 20 * H, null, null, 0),
  O(1054, 'Microeconomics Case Study: Price Elasticity', 'Case Study', 'Undergraduate', 2, 'PRICE_SET', 'PENDING', 4 * D, null, 145, 0),
  O(1053, 'Python Data Structures Assignment', 'Homework', 'Undergraduate', 3, 'AUTO_PRICED', 'PENDING', 6 * D, null, 90, 0, { autoPriced: true, autoPrice: 90, pricingSource: 'AUTO' }),
  O(1052, 'Nursing Care Plan for a Post-Operative Patient', 'Essay', 'Graduate', 4, 'ASSIGNED', 'PARTIAL', 30 * H, 0, 220, 110),
  O(1051, 'Calculus II Problem Set 7: Series Convergence', 'Homework', 'Undergraduate', 5, 'IN_PROGRESS', 'SUCCESS', 5 * H, 1, 75, 75),
  O(1050, 'Marketing Strategy Research Paper', 'Research Paper', 'Masters', 6, 'IN_PROGRESS', 'PARTIAL', -10 * H, 2, 380, 190),
  O(1049, 'Intro to Psychology Discussion Post', 'Discussion Post', 'Undergraduate', 7, 'SUBMITTED', 'SUCCESS', 1 * D, 0, 35, 35),
  O(1048, 'Database Design: ERD and SQL Queries', 'Homework', 'Undergraduate', 0, 'INSTALLMENT_ACTIVE', 'PARTIAL', 9 * D, 3, 260, 86.67),
  O(1047, 'Cellular Respiration Essay', 'Essay', 'High School', 1, 'COMPLETED', 'SUCCESS', -3 * D, 1, 60, 60),
  O(1046, 'Operations Management Case: Queueing', 'Case Study', 'Masters', 2, 'COMPLETED', 'SUCCESS', -6 * D, 0, 190, 190),
  O(1045, 'Java OOP Project: Library System', 'Other', 'Undergraduate', 3, 'UNASSIGNED', 'SUCCESS', 3 * D, null, 240, 240),
  O(1044, 'Sociology Research Paper: Urban Migration', 'Research Paper', 'Graduate', 4, 'CANCELLED', 'FAILED', -1 * D, null, 150, 0),
  O(1043, 'Projectile Motion Lab Report', 'Lab Report', 'Undergraduate', 5, 'ASSIGNED', 'SUCCESS', 2.5 * D, 0, 70, 70),
  O(1042, 'Business Ethics Essay', 'Essay', 'Undergraduate', 6, 'REASSIGNED', 'SUCCESS', 7 * D, 3, 85, 85),
  O(1041, 'Financial Accounting: Adjusting Entries', 'Homework', 'Undergraduate', 0, 'PRICE_SET', 'PENDING', 14 * D, null, 110, 0),
];
const byId = Object.fromEntries(orders.map((o) => [o.id, o]));
const detail = (o) => ({
  ...o, country: 'United States', instructionsWordCount: 142,
  instructions: 'Use APA 7th edition. At least five peer-reviewed sources from the last ten years. Include a title page and an abstract of no more than 150 words. The professor\'s rubric is attached; section 3 carries the most marks.',
  payments: payments(o.id),
});
const payments = (id) => {
  const o = byId[id]; if (!o || !o.price) return [];
  const out = [];
  if (o.paidAmount > 0) out.push({ id: id * 10 + 1, orderId: id, amount: o.paidAmount, status: 'SUCCESS', paymentIntentId: `pi_3Q${id}Kx2eZvKYlo2C1aBcD`, createdAt: ldt(-2 * D), method: 'card', isInstallment: o.paymentStatus === 'PARTIAL', installmentNumber: o.paymentStatus === 'PARTIAL' ? 1 : null });
  if (o.paymentStatus === 'FAILED') out.push({ id: id * 10 + 2, orderId: id, amount: o.price, status: 'FAILED', paymentIntentId: `pi_3Q${id}Lm9fFailXyZ`, createdAt: ldt(-1 * D), method: 'card', failureReason: 'Your card was declined.' });
  return out;
};
const files = (id) => [
  { id: id * 10 + 1, fileName: 'assignment-brief.pdf', contentType: 'application/pdf', size: 248_312, category: 'INSTRUCTIONS', uploadedAt: ldt(-3 * D), uploadedBy: 'STUDENT' },
  { id: id * 10 + 2, fileName: 'grading-rubric.docx', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 61_440, category: 'INSTRUCTIONS', uploadedAt: ldt(-3 * D), uploadedBy: 'STUDENT' },
  { id: id * 10 + 3, fileName: 'lecture-notes-week6.png', contentType: 'image/png', size: 1_204_224, category: 'REFERENCE', uploadedAt: ldt(-2 * D), uploadedBy: 'STUDENT' },
  { id: id * 10 + 4, fileName: 'draft-v1.docx', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 88_064, category: 'SOLUTION', uploadedAt: ldt(-6 * H), uploadedBy: 'EXPERT' },
];
const installmentsFor = (id) => [
  { id: id * 10 + 1, orderId: id, studentId: byId[id]?.studentId ?? 501, finalAmount: 86.67, dueDateTime: ldt(-20 * D), status: 'SUCCESS', paid: true, installmentNumber: 1 },
  { id: id * 10 + 2, orderId: id, studentId: byId[id]?.studentId ?? 501, finalAmount: 86.67, dueDateTime: ldt(10 * D), status: 'PENDING', paid: false, installmentNumber: 2 },
  { id: id * 10 + 3, orderId: id, studentId: byId[id]?.studentId ?? 501, finalAmount: 86.66, dueDateTime: ldt(40 * D), status: 'PENDING', paid: false, installmentNumber: 3, adminNotes: 'Student asked to move this after finals.' },
];
const due = [
  { id: 9001, orderId: 1048, studentId: 501, finalAmount: 86.67, dueDateTime: ldt(2 * D), status: 'PENDING', paid: false, installmentNumber: 2 },
  { id: 9002, orderId: 1052, studentId: 505, finalAmount: 110, dueDateTime: ldt(5 * D), status: 'PENDING', paid: false, installmentNumber: 2 },
  { id: 9003, orderId: 1050, studentId: 507, finalAmount: 95, dueDateTime: ldt(12 * H), status: 'PENDING', paid: false, installmentNumber: 3 },
];
const overdue = [
  { id: 9004, orderId: 1050, studentId: 507, finalAmount: 95, dueDateTime: ldt(-4 * D), status: 'PENDING', paid: false, installmentNumber: 2, adminNotes: 'Reminder sent twice.' },
];
const roles = [
  { id: 1, name: 'SUPER_ADMIN', permissions: ['CREATE_ORDER', 'VIEW_ORDER', 'VIEW_ALL_ORDERS', 'ASSIGN_ORDER', 'UPDATE_ORDER', 'DELETE_ORDER', 'MANAGE_USERS', 'VIEW_USERS', 'UPLOAD_FILE', 'DOWNLOAD_FILE', 'MAKE_PAYMENT', 'VIEW_PAYMENTS', 'CHAT_ACCESS', 'SUPER_ADMIN_ACCESS'] },
  { id: 2, name: 'ADMIN', permissions: ['CREATE_ORDER', 'VIEW_ORDER', 'VIEW_ALL_ORDERS', 'ASSIGN_ORDER', 'UPDATE_ORDER', 'VIEW_USERS', 'UPLOAD_FILE', 'DOWNLOAD_FILE', 'VIEW_PAYMENTS', 'CHAT_ACCESS'] },
  { id: 3, name: 'EXPERT', permissions: ['VIEW_ORDER', 'UPLOAD_FILE', 'DOWNLOAD_FILE', 'CHAT_ACCESS'] },
];
const coupons = [
  { id: 1, code: 'SAVE20', discountType: 'PERCENTAGE', discountValue: 20, expiryDate: ldt(60 * D), usageLimit: 100, active: true, usedCount: 14, createdAt: ldt(-30 * D), updatedAt: ldt(-2 * D) },
  { id: 2, code: 'WELCOME10', discountType: 'FIXED', discountValue: 10, expiryDate: null, usageLimit: null, active: true, usedCount: 52, createdAt: ldt(-90 * D), updatedAt: ldt(-90 * D) },
  { id: 3, code: 'SPRING15', discountType: 'PERCENTAGE', discountValue: 15, expiryDate: ldt(-20 * D), usageLimit: 50, active: true, usedCount: 50, createdAt: ldt(-200 * D), updatedAt: ldt(-20 * D) },
  { id: 4, code: 'TEST20', discountType: 'PERCENTAGE', discountValue: 20, expiryDate: ldt(10 * D), usageLimit: 5, active: false, usedCount: 1, createdAt: ldt(-5 * D), updatedAt: ldt(-1 * D) },
];
const deleted = [
  { id: 1, originalOrderId: 1031, studentName: 'Ethan Brooks', studentEmail: 'ethan.brooks@gmail.com', subject: 'Duplicate: Calculus Problem Set 5', assignmentType: 'Homework', orderStatus: 'CREATED', paymentStatus: 'PENDING', finalPrice: null, totalPrice: null, paidAmount: 0, deletedByAdminName: 'Nina Patel', deletedByAdminId: 4, deletedAt: ldt(-2 * D), deleteReason: 'Duplicate of OD-1029 — student submitted twice.', academicLevel: 'Undergraduate', university: 'Penn State', deadline: ldt(-1 * D), createdAt: ldt(-4 * D) },
  { id: 2, originalOrderId: 1027, studentName: 'Hana Suzuki', studentEmail: 'hana.suzuki@proton.me', subject: 'Test order', assignmentType: 'Other', orderStatus: 'REVIEW_PENDING', paymentStatus: 'PENDING', finalPrice: null, totalPrice: null, paidAmount: 0, deletedByAdminName: 'Ravi Sharma', deletedByAdminId: 3, deletedAt: ldt(-9 * D), deleteReason: 'Internal test order.', academicLevel: 'Undergraduate', university: 'UCLA', deadline: ldt(-8 * D), createdAt: ldt(-10 * D) },
  { id: 3, originalOrderId: 1019, studentName: 'Omar Haddad', studentEmail: 'omar.haddad@gmail.com', subject: 'Statistics Project (withdrawn by student)', assignmentType: 'Research Paper', orderStatus: 'PRICE_SET', paymentStatus: 'PENDING', finalPrice: 210, totalPrice: 210, paidAmount: 0, deletedByAdminName: 'Nina Patel', deletedByAdminId: 4, deletedAt: ldt(-21 * D), deleteReason: 'Student withdrew before payment.', academicLevel: 'Graduate', university: 'NYU', deadline: ldt(-15 * D), createdAt: ldt(-25 * D) },
];
const reviews = [
  { id: 71, reviewerName: 'Priya R.', country: 'United States', rating: 5, title: 'Clear explanations and on time', review: 'My tutor walked me through every step of the hypothesis testing and I finally understand when to use ANOVA. Delivered a day early.', verifiedPurchase: true, media: null, status: 'PENDING', createdAt: ldt(-5 * H), reviewType: 'INTERNAL', reviewSource: 'WEBSITE' },
  { id: 72, reviewerName: 'Lucas C.', country: 'Canada', rating: 3, title: 'Good, but slow to reply', review: 'The work itself was solid. Chat replies took a few hours, which was stressful close to the deadline.', verifiedPurchase: false, media: null, status: 'PENDING', createdAt: ldt(-1 * D), reviewType: 'INTERNAL', reviewSource: 'WEBSITE' },
  { id: 73, reviewerName: 'Amara O.', country: 'United Kingdom', rating: 4, title: null, review: 'Helpful with my care plan structure. Would use again.', verifiedPurchase: true, media: null, status: 'PENDING', createdAt: ldt(-3 * D), reviewType: 'INTERNAL', reviewSource: 'WEBSITE' },
];
const chat = (orderId) => [
  { messageId: 801, orderId, senderId: 501, senderRole: 'STUDENT', senderName: 'Wade Morgan', message: 'Hi! I uploaded the rubric. Section 3 is worth the most marks.', messageType: 'TEXT', createdAt: NOW - 26 * H, seen: true, delivered: true },
  { messageId: 802, orderId, senderId: 3, senderRole: 'ADMIN', senderName: 'Support', message: 'Thanks Wade — got it. We\'ll confirm the price within the hour.', messageType: 'TEXT', createdAt: NOW - 25.5 * H, seen: true, delivered: true },
  { messageId: 803, orderId, senderId: 501, senderRole: 'STUDENT', senderName: 'Wade Morgan', message: null, messageType: 'DOCUMENT', fileName: 'grading-rubric.docx', fileKey: 'k/1', contentType: 'application/pdf', fileSize: 61440, createdAt: NOW - 25 * H, seen: true, delivered: true },
  { messageId: 804, orderId, senderId: 501, senderRole: 'STUDENT', senderName: 'Wade Morgan', message: 'Can it be ready by Friday morning instead of Friday night?', messageType: 'TEXT', createdAt: NOW - 40 * 60e3, seen: false, delivered: true },
];
const page = (arr, url) => {
  const p = Number(url.searchParams.get('page') ?? 0), s = Number(url.searchParams.get('size') ?? 20);
  const kw = (url.searchParams.get('keyword') ?? '').toLowerCase();
  const list = kw ? arr.filter((o) => JSON.stringify(o).toLowerCase().includes(kw)) : arr;
  return { content: list.slice(p * s, p * s + s), totalElements: list.length, totalPages: Math.max(1, Math.ceil(list.length / s)), number: p, size: s, first: p === 0, last: (p + 1) * s >= list.length, empty: !list.length };
};
const expertOrders = orders.filter((o) => o.assignedEmployeeId === 21).map((o) => ({ ...o, deadline: o.expertDeadline }));

function fixture(method, url) {
  const p = url.pathname;
  let m;
  if (method !== 'GET') return [200, { message: 'ok' }];
  if (p === '/admin/admin-dashboard') return [200, { reviewPending: 4, assignedOrders: 6, completedOrders: 38, availableExperts: 3, totalRevenue: 18450.5, pendingPayments: 7 }];
  if (p === '/orders/all') return [200, page(orders, url)];
  if ((m = p.match(/^\/admin\/orders\/(\d+)$/))) return byId[m[1]] ? [200, detail(byId[m[1]])] : [404, { message: 'Order not found' }];
  if ((m = p.match(/^\/admin\/orders\/(\d+)\/installments$/))) return [200, installmentsFor(+m[1])];
  if ((m = p.match(/^\/files\/(admin|student)\/order\/(\d+)$/))) return [200, page(files(+m[2]), url)];
  if ((m = p.match(/^\/payments\/order\/(\d+)$/))) return [200, payments(+m[1])];
  if (p === '/payments/summary') return [200, { totalPaid: 240, totalDue: 120 }];
  if (p === '/admin/employees') return [200, [...admins, ...experts]];
  if (p === '/admin/experts/available') return [200, experts.filter((e) => e.availabilityStatus === 'AVAILABLE' && e.active)];
  if (p === '/admin/roles') return [200, roles];
  if (p === '/admin/coupons/all') return [200, coupons];
  if (p === '/api/admin/orders/deleted') return [200, deleted];
  if (p === '/installments/due') return [200, due];
  if (p === '/installments/overdue') return [200, overdue];
  if (p === '/api/admin/reviews/pending') return [200, reviews];
  if (p === '/api/order-chat/conversations') return [200, [{ orderId: 1041, studentId: 501, studentName: 'Wade Morgan', lastMessage: 'Can it be ready by Friday morning instead of Friday night?', lastMessageTime: NOW - 40 * 60e3, unreadCount: 1, hasConversation: true }]];
  if (p === '/api/order-chat/history/all') return [200, chat(+url.searchParams.get('orderId'))];
  if (p === '/api/order-chat/history') { const c = chat(+url.searchParams.get('orderId')); return [200, { content: c, totalElements: c.length, totalPages: 1, number: 0, size: 50, last: true }]; }
  if (p === '/api/order-chat/unread-count') return [200, url.searchParams.get('orderId') === '1041' ? 1 : 0];
  if (p === '/expert/dashboard') return [200, { totalAssigned: 6, inProgress: 2, completed: 14 }];
  if (p === '/expert/stats') return [200, { assigned: 6, inProgress: 2, submitted: 1, completed: 14, overdue: 1 }];
  if (p === '/expert/orders') return [200, page(expertOrders, url)];
  if (p === '/expert/orders/due-today') return [200, expertOrders.filter((o) => o.id === 1052)];
  if (p === '/expert/orders/overdue') return [200, [{ ...byId[1050], deadline: byId[1050].expertDeadline }]];
  if ((m = p.match(/^\/expert\/orders\/(\d+)\/details$/))) return [200, { ...detail(byId[m[1]] ?? orders[4]), description: detail(orders[4]).instructions }];
  if (p === '/expert/profile') return [200, experts[0]];
  return [404, { message: 'Not found' }];
}

// ── Pages ───────────────────────────────────────────────────────────────────
const ADMIN = ['dashboard', 'orders', 'orders/1052', 'assign-orders', 'deleted-orders', 'analytics', 'students', 'experts', 'chat?order=1041', 'installments', 'verify-payments', 'coupons', 'create-order', 'reviews', 'external-reviews', 'system-overview', 'roles-access', 'add-expert'].map((p) => ['admin', p]);
const EXPERT = ['dashboard', 'orders', 'deadlines', 'files?order=1052', 'profile'].map((p) => ['expert', p]);
const PAGES = [...ADMIN, ...EXPERT].filter(([portal, p]) => `${portal}/${p}`.includes(FILTER));

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (sub, role) => `${b64({ alg: 'HS256' })}.${b64({ sub: String(sub), role, exp: Math.floor(NOW / 1000) + 3600 })}.sig`;
const VIEWDEF = {
  'desk-dark': { viewport: { width: 1440, height: 900 }, theme: 'dark' },
  'desk-light': { viewport: { width: 1440, height: 900 }, theme: 'light' },
  laptop: { viewport: { width: 1280, height: 800 }, theme: 'dark' },
  phone: { viewport: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 }, theme: 'dark' },
};

const browser = await puppeteer.launch({ args: chromium.args.filter((a) => a !== '--single-process'), executablePath: await chromium.executablePath(), headless: true });
const report = [];

for (const view of VIEWS) {
  const { viewport, theme } = VIEWDEF[view];
  for (const [portal, p] of PAGES) {
    const ctx = await browser.createBrowserContext();
    const pg = await ctx.newPage();
    await pg.setViewport(viewport);
    const role = portal === 'expert' ? 'EXPERT' : 'SUPER_ADMIN';
    const uid = portal === 'expert' ? 21 : 3;
    await pg.evaluateOnNewDocument((t, r, u, th) => {
      localStorage.setItem('token', t); localStorage.setItem('refreshToken', 'r'); localStorage.setItem('userId', String(u));
      localStorage.setItem('userRole', r); localStorage.setItem('userEmail', r === 'EXPERT' ? 'elena.petrova@qtiservices.com' : 'ravi.sharma@qtiservices.com');
      localStorage.setItem('qti_theme', th);
    }, jwt(uid, role), role, uid, theme);
    const errors = [];
    pg.on('pageerror', (e) => errors.push(e.message));
    await pg.setRequestInterception(true);
    pg.on('request', (r) => {
      const u = new URL(r.url());
      const h = r.headers();
      const isRsc = h['rsc'] || h['next-router-prefetch'] || h['next-router-state-tree'] || u.searchParams.has('_rsc');
      if (u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com') return r.respond({ status: 200, contentType: 'text/css', body: '' });
      if (!isRsc && ['fetch', 'xhr', 'eventsource'].includes(r.resourceType())) {
        if (u.pathname.startsWith('/ws/')) return r.respond({ status: 503, contentType: 'application/json', body: '{}' });
        const [status, body] = fixture(r.method(), u);
        return r.respond({ status, contentType: 'application/json', body: JSON.stringify(body) });
      }
      r.continue();
    });
    const url = `${BASE}/${portal}/${p}`;
    await pg.goto(url, { waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});
    if (p === 'students') {
      const input = await pg.$('input[type="search"], input[placeholder]');
      if (input) { await input.type('wade'); await pg.keyboard.press('Enter'); await new Promise((r) => setTimeout(r, 900)); }
    }
    await new Promise((r) => setTimeout(r, 1400));

    const checks = await pg.evaluate((isPhone, deviceW) => {
      // Compare with the DEVICE width, not innerWidth: on a phone, content
      // wider than the screen makes Chrome zoom the page out and widens
      // innerWidth to match — so innerWidth would hide the very overflow
      // we are looking for.
      const vw = deviceW;
      const name = (el) => (el.getAttribute('aria-label') || el.getAttribute('title') || el.innerText || el.getAttribute('alt') || '').trim();
      const desc = (el) => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : ''}`;
      const visible = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
      const overflowers = [...document.querySelectorAll('body *')].filter((el) => {
        if (!visible(el)) return false;
        const r = el.getBoundingClientRect();
        if (r.right <= vw + 1) return false;
        // ignore content inside an element that scrolls horizontally by design
        for (let a = el.parentElement; a; a = a.parentElement) { const ox = getComputedStyle(a).overflowX; if (ox === 'auto' || ox === 'scroll' || ox === 'hidden') return false; }
        return true;
      }).slice(0, 6).map(desc);
      // Desktop only: scroll containers (table wraps) whose content is wider
      // than they are. Not a page overflow, but a row whose actions sit
      // off-screen behind a sideways scroll is just as hidden.
      const clipped = isPhone ? [] : [...document.querySelectorAll('body *')].filter((el) => {
        if (!visible(el)) return false;
        const ox = getComputedStyle(el).overflowX;
        return (ox === 'auto' || ox === 'scroll') && el.scrollWidth > el.clientWidth + 2 && !el.closest('[role="dialog"], .modal, .toast');
      }).slice(0, 4).map((el) => `${desc(el)}(${el.scrollWidth}>${el.clientWidth})`);
      const controls = [...document.querySelectorAll('button, a[href], [role="button"], select, input:not([type=hidden]), textarea')].filter(visible);
      const unnamed = controls.filter((el) => ['BUTTON', 'A'].includes(el.tagName) || el.getAttribute('role') === 'button').filter((el) => !name(el)).slice(0, 6).map(desc);
      const unlabeled = controls.filter((el) => ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)).filter((el) => {
        if (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.closest('label')) return false;
        return !(el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`));
      }).slice(0, 6).map((el) => desc(el) + (el.placeholder ? `[ph="${el.placeholder}"]` : ''));
      const small = isPhone ? controls.filter((el) => {
        const r = el.getBoundingClientRect();
        if (el.tagName === 'A' && getComputedStyle(el).display === 'inline') return false;
        return r.height < 32 || r.width < 32;
      }).map((el) => `${desc(el)} ${Math.round(el.getBoundingClientRect().width)}×${Math.round(el.getBoundingClientRect().height)} "${name(el).slice(0, 18)}"`) : [];
      // Classes on the page that no loaded stylesheet mentions. Catches a page
      // borrowing styles from another route's CSS (it only looks right if that
      // route was visited first) and components whose stylesheet was dropped.
      const known = new Set();
      const walk = (rules) => { for (const r of rules) {
        if (r.selectorText) for (const m of r.selectorText.matchAll(/\.([A-Za-z_][\w-]*)/g)) known.add(m[1]);
        if (r.cssRules) walk(r.cssRules);
      } };
      for (const sh of document.styleSheets) { try { walk(sh.cssRules); } catch { /* cross-origin */ } }
      const HOOKS = /^(lucide|lucide-.*|visually-hidden|on|open|over|done|now|active|urgent|danger|primary|compact|available|offline|busy|invalid|t-[a-z0-9]+|text-[a-z]+)$/;
      const unstyled = [...new Set([...document.querySelectorAll('[class]')].flatMap((el) =>
        typeof el.className === 'string' ? el.className.split(/\s+/) : []))]
        .filter((c) => c && !known.has(c) && !HOOKS.test(c)).slice(0, 15);
      return {
        unstyled,
        title: document.querySelector('h1')?.textContent?.trim(),
        hscroll: document.documentElement.scrollWidth > vw + 1 || window.innerWidth > vw + 1,
        layoutWidth: Math.max(document.documentElement.scrollWidth, window.innerWidth),
        overflowers, clipped, unnamed, unlabeled, small: small.slice(0, 12), smallCount: small.length,
        legacy: !!document.querySelector('.legacy'),
        height: document.documentElement.scrollHeight,
      };
    }, view === 'phone', viewport.width);
    const file = `${view}__${portal}-${p.replace(/[/?=]/g, '_')}.png`;
    await pg.screenshot({ path: `${OUT}/${file}`, fullPage: true });
    report.push({ view, page: `${portal}/${p}`, file, errors: errors.slice(0, 3), ...checks });
    await ctx.close();
  }
}
await browser.close();
fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
for (const r of report) {
  const flags = [
    r.hscroll && `H-SCROLL(${r.layoutWidth}px)`, r.overflowers.length && `overflow:${r.overflowers.join(',')}`, r.legacy && 'LEGACY', r.clipped?.length && `clipped:${r.clipped.join(',')}`,
    r.unnamed.length && `unnamed:${r.unnamed.join(',')}`, r.unlabeled.length && `unlabeled:${r.unlabeled.join(',')}`,
    r.smallCount && `small×${r.smallCount}`, r.errors.length && `ERR:${r.errors.join('|')}`,
    r.unstyled?.length && `no-css:${r.unstyled.join(',')}`,
  ].filter(Boolean);
  console.log(`${r.view.padEnd(10)} ${r.page.padEnd(24)} ${flags.length ? flags.join('  ') : 'ok'}`);
}
