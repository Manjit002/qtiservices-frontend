/**
 * All landing-page copy, lifted verbatim from the source HTML.
 *
 * Kept in one place so the components stay structural and nothing can be
 * silently dropped — every item here maps 1:1 to an element in the original.
 */

/**
 * Phone is left as the site's existing current value — the old QTI source
 * (qtiservices-source-code.zip) consistently uses +1 (585) 522-2449 across its
 * own Footer and Contact page, which conflicts with this number. Neither
 * value carries a placeholder marker, so there is no way to determine which
 * is current without guessing; per instruction, the existing value is kept
 * and the conflict is reported rather than resolved silently.
 *
 * `address` is new: the current site never displayed one. The old source has
 * two different addresses in two places — its Footer says "485 Madison Ave,
 * Fl 13, New York, NY 10022" (site-wide, specific, matches this site's
 * existing "New York" city) while its Contact page says "123 Tech Street,
 * Suite 100, San Francisco, CA 94105" (a generic placeholder pattern — "123
 * [Type] Street" — that also contradicts the same source's own Footer). The
 * Footer's address is used as the more clearly authoritative of the two.
 */
export const CONTACT = {
  phone: '+1 (800) 578-4832',
  phoneHref: 'tel:+18005784832',
  email: 'support@qtiservices.com',
  emailHref: 'mailto:support@qtiservices.com',
  location: 'New York, NY',
  addressLines: ['485 Madison Ave, Fl 13', 'New York, NY 10022'] as readonly string[],
} as const;

/**
 * Consent-collection language for the project-request form, per the SMS
 * carrier-vetting (TCR / A2P 10DLC) fix: the SMS opt-in and the mandatory
 * legal acceptance must be two separate checkboxes, not one bundled
 * disclosure. Wording is reproduced exactly as specified — not paraphrased —
 * since exact text is what a carrier reviewer checks against.
 */
export const SMS_CONSENT_LABEL =
  'I agree to receive text messages from QTIServices (qtiservices.com) regarding my ' +
  'service request, requirement confirmation, pricing discussion, payment links, ' +
  'reminders, and support updates. Message frequency varies. Message & data rates ' +
  'may apply. Reply STOP to opt out, HELP for help. Consent is not a condition of purchase.';

export const LEGAL_CONSENT_PREFIX = 'I accept the ';
export const LEGAL_CONSENT_SUFFIX = ' of QTIServices.';

export const LEGAL_LINKS = [
  { label: 'Privacy Policy', href: '/privacy-policy' },
  { label: 'Terms of Service', href: '/terms-of-service' },
  { label: 'Messaging Terms', href: '/messaging-terms' },
] as const;

/**
 * Recovered from the old source's About page. Presented as qualitative
 * values rather than paired with its numeric stats (10+ years, 150+
 * projects, 50+ team, 98% satisfaction) — those figures conflict with the
 * ones already live in this site's hero and stats banner (500+ clients, 15+
 * years, 98% retention, 99.9% uptime), and importing a second, contradicting
 * set of numbers onto the same page would be worse than leaving them out.
 */
export const VALUES = [
  { icon: '❤️', title: 'Client-Centric', desc: 'Your success is our success. We build lasting partnerships based on trust and mutual growth.' },
  { icon: '💡', title: 'Innovation', desc: 'We embrace cutting-edge technologies and creative solutions to solve complex challenges.' },
  { icon: '🏆', title: 'Excellence', desc: 'We maintain the highest standards in everything we deliver, from code quality to client service.' },
  { icon: '🤝', title: 'Collaboration', desc: 'We work as an extension of your team, fostering open communication and shared goals.' },
] as const;

export const NAV = [
  { label: 'Services', href: '#services' },
  { label: 'About Us', href: '#about' },
  { label: 'Technologies', href: '#tech' },
  { label: 'Contact', href: '#cta' },
] as const;

export const HERO_STATS = [
  { value: '500+',  label: 'Enterprise Clients' },
  { value: '15+',   label: 'Years of Excellence' },
  { value: '98%',   label: 'Client Retention' },
  { value: '99.9%', label: 'Uptime SLA' },
] as const;

export const SERVICES = [
  {
    num: '01', icon: '☁️', title: 'Cloud Solutions',
    desc: 'Migration, architecture, and cost optimisation across AWS, Azure, and GCP. We design scalable cloud environments that grow with your business while reducing infrastructure overhead.',
  },
  {
    num: '02', icon: '🛡️', title: 'Cybersecurity',
    desc: 'Threat detection, penetration testing, compliance audits, and zero-trust architecture — delivering full-spectrum protection for your data, systems, and organisation.',
  },
  {
    num: '03', icon: '💻', title: 'Software Development',
    desc: 'Custom web applications, enterprise APIs, and scalable platforms built with modern technology stacks. Delivered on time, on budget, and to the precise specification.',
  },
  {
    num: '04', icon: '🔧', title: 'Managed IT Services',
    desc: 'Around-the-clock monitoring, proactive helpdesk support, and comprehensive patch management — keeping your systems running so your team stays focused on the business.',
  },
  {
    num: '05', icon: '📡', title: 'Network Infrastructure',
    desc: 'Secure, high-performance network design and deployment — LAN, WAN, SD-WAN, and enterprise wireless solutions engineered for maximum reliability and operational continuity.',
  },
  {
    num: '06', icon: '📊', title: 'IT Consulting',
    desc: 'Strategic technology roadmaps, digital transformation advisory, and vendor management that aligns every pound of IT investment to your long-term business strategy.',
  },
  /**
   * The remaining three cards restore or add real offerings. The first two
   * were in the old QTI source's own service list (which the current site
   * had dropped) and are reproduced in the same voice as the six above.
   */
  {
    num: '07', icon: '📱', title: 'Mobile App Development',
    desc: 'Native and cross-platform mobile applications — iOS, Android and React Native — engineered for exceptional user experience across every device.',
  },
  {
    num: '08', icon: '📈', title: 'Data & Analytics',
    desc: 'Data warehousing, business intelligence and real-time analytics that turn raw operational data into decisions your team can act on.',
  },
  /**
   * NEW. Sourced entirely from the supplied "Online Tutoring" material —
   * specifically the clean feature list (one-to-one/group sessions, named
   * subjects, pre-booking), not the accompanying "Edtech" material, which
   * describes competitive-exam preparation. That framing is exactly what the
   * compliance review flagged, so it is deliberately excluded: no exam,
   * test-prep or certification language appears anywhere below, and this
   * sits as the ninth of nine service cards — one part of a technology
   * company's portfolio, not a defining line of business.
   */
  {
    num: '09', icon: '🎓', title: 'Online Tutoring & Educational Support',
    desc: 'Alongside our technology practice, we help students and professionals across the USA connect with subject-matter tutors online — one-to-one or in small groups, across subjects including mathematics, science, psychology, medicine and software programming, with sessions bookable in advance.',
  },
] as const;

/** `decimals` drives the counter, mirroring the source's data-dec attribute. */
export const STATS = [
  { target: 500,  suffix: '+', decimals: 0, label: 'Enterprise Clients Served' },
  { target: 98,   suffix: '%', decimals: 0, label: 'Client Retention Rate' },
  { target: 15,   suffix: '+', decimals: 0, label: 'Years of Excellence' },
  { target: 99.9, suffix: '%', decimals: 1, label: 'Average Uptime Delivered' },
] as const;

export const PROCESS = [
  {
    step: '1', title: 'Discovery & Infrastructure Audit',
    body: 'We map your current systems, identify gaps and vulnerabilities, and understand your growth trajectory before recommending a single solution.',
  },
  {
    step: '2', title: 'Tailored Solution Architecture',
    body: 'Senior architects develop a technology blueprint precisely aligned to your timeline, budget, compliance requirements, and risk tolerance.',
  },
  {
    step: '3', title: 'Certified Implementation',
    body: 'Qualified engineers execute with zero-downtime deployment protocols, rigorous quality assurance, and full documentation at every milestone.',
  },
  {
    step: '4', title: 'Continuous Managed Support',
    body: 'A dedicated account team provides ongoing monitoring, proactive updates, and strategic quarterly reviews — long after the project goes live.',
  },
] as const;

export const KPIS = [
  { value: '2–4 Wks', label: 'Average kickoff to first delivery' },
  { value: '24 / 7',  label: 'Support availability for all clients' },
  { value: 'SOC 2',   label: 'Type II compliant infrastructure' },
  { value: 'ISO',     label: '27001 certified operations' },
] as const;

export const TECHNOLOGIES = [
  'Amazon Web Services', 'Microsoft Azure', 'Google Cloud Platform', 'Kubernetes',
  'Docker', 'Terraform', 'Cisco Systems', 'Fortinet', 'CrowdStrike', 'Splunk',
  'ServiceNow', 'Ansible', 'GitLab CI/CD', 'PostgreSQL', 'Redis', 'Grafana',
  'Datadog', 'Zero Trust VPN',
] as const;

export const FOOTER_SERVICES = [
  'Cloud Solutions', 'Cybersecurity', 'Software Development',
  'Managed IT Services', 'Network Infrastructure', 'IT Consulting',
] as const;

export const FOOTER_COMPANY = [
  'About Us', 'Case Studies', 'Our Blog', 'Careers', 'Partner Network',
] as const;
