import type { Metadata } from 'next';
import Link from 'next/link';
import { Mail, Phone, MapPin } from 'lucide-react';
import { SiteHeader } from '@/components/home/landing/SiteHeader';
import { SiteFooter } from '@/components/home/landing/SiteFooter';
import { ProjectRequestForm } from '@/components/home/landing/ProjectRequestForm';
import { CONTACT } from '@/components/home/landing/content';
import '@/components/home/landing.css';

export const metadata: Metadata = {
  title: 'Contact | QTIServices',
  description:
    'Contact QTIServices about technology services, online tutoring and educational support, or a project request.',
};

/**
 * Public contact page.
 *
 * Contact has only ever been an anchor on the homepage (#cta), so /contact —
 * the URL a reviewer or a campaign is most likely to try — returned a 404.
 * This gives it a real, linkable page with no session required.
 *
 * Contact details come from the shared CONTACT constant, so this page can
 * never drift from the footer and the rest of the site.
 */
export default function ContactPage() {
  return (
    <div className="lp">
      <SiteHeader />
      <main>
        <section className="lp-legal-hero">
          <div className="lp-eyebrow center">Contact</div>
          <h1 className="lp-legal-h1">Talk to our team</h1>
          <p className="lp-legal-sub" style={{ maxWidth: 620, margin: '0 auto' }}>
            Tell us what you need and we will reply with a tailored proposal. No
            obligation, and no phone number required.
          </p>
        </section>

        <section className="lp-sec lp-white">
          <div className="lp-contact-grid">
            <a className="lp-contact-card" href={CONTACT.emailHref}>
              <span className="lp-contact-icon" aria-hidden><Mail size={18} /></span>
              <span className="lp-contact-label">Email</span>
              <span className="lp-contact-value">{CONTACT.email}</span>
            </a>
            <a className="lp-contact-card" href={CONTACT.phoneHref}>
              <span className="lp-contact-icon" aria-hidden><Phone size={18} /></span>
              <span className="lp-contact-label">Phone</span>
              <span className="lp-contact-value">{CONTACT.phone}</span>
            </a>
            <div className="lp-contact-card">
              <span className="lp-contact-icon" aria-hidden><MapPin size={18} /></span>
              <span className="lp-contact-label">Office</span>
              <span className="lp-contact-value">
                {CONTACT.addressLines.map((l) => <span key={l} style={{ display: 'block' }}>{l}</span>)}
              </span>
            </div>
          </div>
        </section>

        <section className="lp-cta" id="request">
          <div className="lp-eyebrow center" style={{ color: 'var(--gold)' }}>Project Request</div>
          <h2>Send us your request</h2>
          <p>
            A phone number is optional, and text updates are opt-in only — see our{' '}
            <Link href="/sms" style={{ color: 'var(--gold)' }}>SMS program</Link> for what
            we send and how to stop.
          </p>
          <ProjectRequestForm />
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
