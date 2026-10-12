import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '@/components/home/landing/SiteHeader';
import { SiteFooter } from '@/components/home/landing/SiteFooter';
import { ProjectRequestForm } from '@/components/home/landing/ProjectRequestForm';
import { CONTACT } from '@/components/home/landing/content';
import '@/components/home/landing.css';

export const metadata: Metadata = {
  title: 'SMS Program | QTIServices',
  description:
    'How text messages from QTIServices work: what we send, how often, how to opt in, and how to stop. Opting in is optional and never a condition of purchase.',
};

/**
 * Public SMS opt-in landing page.
 *
 * The reviewer asked that the opt-in flow explain the programme *before*
 * consent is submitted. On the homepage the full disclosure is inside the
 * consent checkbox itself; here it is set out in plain sight above the form,
 * on a page a reviewer can open directly with no session.
 *
 * Wording matches the Privacy Policy, Terms of Service and Messaging Terms —
 * same six message categories, same opt-out and cost language — so the four
 * pages describe one programme and cannot contradict each other.
 *
 * HELP is deliberately given as a reply keyword and an email address, not a
 * phone number: HELP is answered by replying to a message, and printing a
 * number here would invite calls to a line this page does not control.
 */
export default function SmsProgramPage() {
  return (
    <div className="lp">
      <SiteHeader />
      <main>
        <section className="lp-legal-hero">
          <div className="lp-eyebrow center">SMS Program</div>
          <h1 className="lp-legal-h1">Text messages from QTIServices</h1>
          <p className="lp-legal-sub" style={{ maxWidth: 640, margin: '0 auto' }}>
            What we send, how often, and how to stop at any time. Opting in is optional
            and is never a condition of purchasing anything.
          </p>
        </section>

        <section className="lp-sec lp-white">
          <div className="lp-legal">
            <section>
              <h2>Who sends the messages</h2>
              <p>
                Messages come from <strong>QTIServices</strong> (qtiservices.com). We do
                not send messages on behalf of anyone else, and we do not send marketing
                or promotional texts.
              </p>
            </section>

            <section>
              <h2>What you will receive</h2>
              <p>If you opt in, we may text you about:</p>
              <ul>
                <li>Inquiries</li>
                <li>Appointments</li>
                <li>Tutoring services</li>
                <li>Project updates</li>
                <li>Payment links</li>
                <li>Customer support</li>
              </ul>
              <p style={{ marginBottom: 0 }}>
                In practice that means confirming your requirements, discussing pricing,
                sending secure payment links and reminders, and answering your support
                questions.
              </p>
            </section>

            <div className="lp-legal-callout">
              <h2>Before you opt in</h2>
              <ul>
                <li><strong>Opting in is optional.</strong> Consent is not a condition of purchasing any goods or services.</li>
                <li><strong>Message frequency varies</strong> with your service needs and how often you contact us.</li>
                <li><strong>Message and data rates may apply.</strong> Check your plan with your mobile carrier.</li>
                <li><strong>Reply STOP</strong> to any message to opt out at any time.</li>
                <li><strong>Reply HELP</strong> for assistance, or email <a href={CONTACT.emailHref}>{CONTACT.email}</a>.</li>
              </ul>
              <p style={{ marginBottom: 0 }}>
                We only text a number after someone submits the form below and actively
                checks the SMS consent box. We never add a number without that step, and
                accepting our Privacy Policy and Messaging Terms is a separate action
                that does not opt you in.
              </p>
            </div>

            <section>
              <h2>How your mobile information is handled</h2>
              <p>
                <strong>
                  Your mobile information and SMS opt-in data will not be shared with
                  third parties or affiliates for their own marketing purposes.
                </strong>{' '}
                We may share information with service providers that help us operate our
                messaging program, subject to appropriate confidentiality obligations.
              </p>
              <p style={{ marginBottom: 0 }}>
                Full details are in our <Link href="/privacy-policy">Privacy Policy</Link>,
                the <Link href="/terms-of-service">SMS Terms</Link> section of our Terms of
                Service, and our <Link href="/messaging-terms">Messaging Terms</Link>.
              </p>
            </section>

            <section>
              <h2>How to stop, or ask a question</h2>
              <p>
                Reply <strong>STOP</strong> to any message and we will stop texting that
                number. Reply <strong>HELP</strong> for assistance. You can also email{' '}
                <a href={CONTACT.emailHref}>{CONTACT.email}</a> and ask us to remove your
                number, or ask what information we hold about you.
              </p>
              <p style={{ marginBottom: 0 }}>
                Opting out of text messages does not cancel a service request — where a
                reply is needed, we will continue by email.
              </p>
            </section>

            <div className="lp-legal-related">
              <Link href="/privacy-policy">Privacy Policy</Link>
              <Link href="/terms-of-service">Terms of Service</Link>
              <Link href="/messaging-terms">Messaging Terms</Link>
            </div>
          </div>
        </section>

        {/* The opt-in itself. Same form as the homepage — two separate
            checkboxes, SMS optional and unchecked, legal acceptance required. */}
        <section className="lp-cta" id="opt-in">
          <div className="lp-eyebrow center" style={{ color: 'var(--gold)' }}>Opt In</div>
          <h2>Send us your request</h2>
          <p>
            Tick the SMS box only if you want text updates. Leave it unticked and the form
            still submits — we will reply by email instead.
          </p>
          <ProjectRequestForm />
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
