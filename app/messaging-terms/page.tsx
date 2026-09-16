import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalLayout } from '@/components/home/landing/LegalLayout';

export const metadata: Metadata = {
  title: 'Messaging Terms | QTIServices',
  description: 'SMS/MMS program terms and conditions for QTIServices text communications.',
};

/**
 * Restored from the old QTI source (src/pages/MessagingTerms.tsx) — the
 * A2P 10DLC-style SMS program disclosure the compliance review specifically
 * asked to have back in place: program description, message frequency,
 * fees, STOP/HELP opt-out, the "not a condition of purchase" disclaimer, and
 * supported carriers. All preserved as written.
 */
export default function MessagingTermsPage() {
  return (
    <LegalLayout
      title="Messaging Terms"
      subtitle="SMS/MMS Program Terms and Conditions"
      updated="September 16, 2026"
    >
      <dl className="lp-legal-dl">
        <div>
          <dt>Program name</dt>
          <dd>QTIServices SMS</dd>
        </div>
        <div>
          <dt>Brand</dt>
          <dd>QTIServices</dd>
        </div>
      </dl>

      <section>
        <h2>Program Description</h2>
        <p>By opting in, you agree to receive SMS/MMS messages from QTIServices related to:</p>
        <ul>
          <li>Service and project requirement confirmation</li>
          <li>Pricing and quotation discussions</li>
          <li>Secure payment link sharing</li>
          <li>Payment reminders</li>
          <li>Customer support and service updates</li>
        </ul>
        <p style={{ marginBottom: 0 }}>
          Messages are sent only after the user submits a request or shows interest on
          the website.
        </p>
      </section>

      <div className="lp-legal-callout">
        <h2>Message Frequency</h2>
        <p style={{ marginBottom: 0 }}>
          Message frequency varies based on your interaction with QTIServices and the
          stage of your service engagement. You will only receive messages relevant to
          your service requests and ongoing projects.
        </p>
      </div>

      <section>
        <h2>Fees</h2>
        <p>
          Message and data rates may apply. Check with your mobile carrier for details
          regarding your text messaging plan. QTIServices does not charge any
          additional fees for SMS messages beyond standard carrier rates.
        </p>
      </section>

      <section>
        <h2>Opt-Out Instructions</h2>
        <p>You can opt out of receiving SMS messages at any time by:</p>
        <p><span className="lp-legal-stop">Reply STOP to any message to unsubscribe</span></p>
        <p style={{ fontSize: '.85rem' }}>
          After opting out, you will receive a confirmation message and will no longer
          receive SMS messages from QTIServices unless you opt in again.
        </p>
      </section>

      <section>
        <h2>Help</h2>
        <p>If you need assistance with our SMS program:</p>
        <ul>
          <li>Reply <strong>HELP</strong> to any message for assistance</li>
          <li>Email us at <a href="mailto:support@qtiservices.com">support@qtiservices.com</a></li>
        </ul>
      </section>

      <div className="lp-legal-callout">
        <h2>Consent Disclaimer</h2>
        <p><strong>SMS consent is not a condition of purchase.</strong></p>
        <p style={{ marginBottom: 0, fontSize: '.85rem' }}>
          You are not required to consent to receive SMS messages in order to purchase
          any goods or services from QTIServices. Your decision to opt in or out of SMS
          communications will not affect your ability to work with us.
        </p>
      </div>

      <section>
        <h2>Privacy</h2>
        <p>
          Your privacy is important to us. Your mobile phone number and any information
          you provide will be handled in accordance with our{' '}
          <Link href="/privacy-policy">Privacy Policy</Link>. We do not sell, rent or
          share your mobile number with third parties for marketing purposes.
        </p>
      </section>

      <section>
        <h2>Supported Carriers</h2>
        <p>
          Our SMS program is compatible with most major U.S. carriers including AT&amp;T,
          Verizon, T-Mobile, Sprint and others. Carrier charges may apply. Contact your
          carrier for more information.
        </p>
      </section>

      <section>
        <h2>Questions</h2>
        <p>If you have any questions about these Messaging Terms, please contact us:</p>
        <p><strong>Email:</strong> <a href="mailto:support@qtiservices.com">support@qtiservices.com</a></p>
      </section>

      <div className="lp-legal-related">
        <Link href="/privacy-policy">Privacy Policy</Link>
        <Link href="/terms-of-service">Terms of Service</Link>
        <Link href="/#cta">Contact Us</Link>
      </div>
    </LegalLayout>
  );
}
