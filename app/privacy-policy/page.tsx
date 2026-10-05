import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalLayout } from '@/components/home/landing/LegalLayout';

export const metadata: Metadata = {
  title: 'Privacy Policy | QTIServices',
  description:
    'How QTIServices collects, uses and protects your information, including our SMS communications program.',
};

/**
 * Restored from the old QTI source (src/pages/PrivacyPolicy.tsx). This is the
 * document the compliance review found missing during verification. Content
 * and meaning are preserved; only the presentation is rebuilt to match this
 * site's own design tokens.
 *
 * "Last updated" is set to today rather than the source's original date,
 * since the content is being materially re-published now (contact details
 * aligned to this site's canonical values, presentation rebuilt). See
 * CONTENT-RESTORE.md.
 */
export default function PrivacyPolicyPage() {
  return (
    <LegalLayout title="Privacy Policy" updated="September 16, 2026">
      <section>
        <h2>Introduction</h2>
        <p>
          QTIServices (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) respects your
          privacy and is committed to protecting your personal data. This Privacy Policy
          explains how we collect, use, disclose and safeguard your information when you
          visit our website or use our services.
        </p>
      </section>

      <section>
        <h2>Information We Collect</h2>
        <p>We may collect information about you in various ways, including:</p>
        <ul>
          <li><strong>Personal data:</strong> name, email address, phone number, company name and other information you provide when filling out forms or contacting us.</li>
          <li><strong>Usage data:</strong> information about how you interact with our website, including pages visited, time spent and navigation patterns.</li>
          <li><strong>Device data:</strong> information about your device, browser type, IP address and operating system.</li>
        </ul>
      </section>

      <section>
        <h2>How We Use Your Information</h2>
        <p>We use the information we collect to:</p>
        <ul>
          <li>Respond to your inquiries and provide requested services</li>
          <li>Send you service-related communications</li>
          <li>Improve our website and services</li>
          <li>Comply with legal obligations</li>
          <li>Protect against fraudulent or unauthorized activity</li>
        </ul>
      </section>

      {/* Required SMS/mobile disclosures for the US messaging provider. The
          three statements below are the carrier-required base content; the
          operational disclosures under them match the Messaging Terms page so
          the two cannot contradict each other. */}
      <div className="lp-legal-callout">
        <h2>SMS and Mobile Information</h2>
        <p>
          When you provide your mobile number and consent to receive text messages from
          QTIServices, we may use your mobile information to send messages related to
          your inquiries, appointments, tutoring services, project updates, payment
          links, and customer support.
        </p>
        <p>
          <strong>
            Your mobile information and SMS opt-in data will not be shared with third
            parties or affiliates for their own marketing purposes.
          </strong>
        </p>
        <p>
          We may share information with service providers that help us operate our
          messaging program, subject to appropriate confidentiality obligations.
        </p>
        <ul>
          <li><strong>Message frequency varies</strong> based on your service needs and interactions with us.</li>
          <li><strong>Message and data rates may apply.</strong> Check with your mobile carrier for details of your plan.</li>
          <li><strong>You can opt out at any time</strong> by replying STOP to any message.</li>
          <li><strong>For help with SMS</strong>, reply HELP or contact <a href="mailto:support@qtiservices.com">support@qtiservices.com</a>.</li>
          <li><strong>Your mobile data is stored securely</strong> and is only accessible to authorized personnel who need it to provide you with services.</li>
        </ul>
        <p style={{ marginBottom: 0 }}>
          Your SMS consent is optional and is not a condition of purchasing any goods or
          services from QTIServices. For the full SMS program disclosures, see our{' '}
          <Link href="/messaging-terms">Messaging Terms</Link>.
        </p>
      </div>

      <section>
        <h2>Information Sharing</h2>
        <p>We may share your information in the following situations:</p>
        <ul>
          <li><strong>Service providers:</strong> with trusted third-party vendors who assist us in operating our business (e.g. hosting, analytics).</li>
          <li><strong>Legal requirements:</strong> when required by law or to respond to legal process.</li>
          <li><strong>Business transfers:</strong> in connection with a merger, acquisition or sale of assets.</li>
        </ul>
      </section>

      <section>
        <h2>Data Security</h2>
        <p>
          We implement appropriate technical and organizational measures to protect your
          personal data against unauthorized access, alteration, disclosure or
          destruction. However, no method of transmission over the internet or
          electronic storage is 100% secure.
        </p>
      </section>

      <section>
        <h2>Your Rights and Choices</h2>
        <p>Depending on your location, you may have certain rights regarding your personal data, including:</p>
        <ul>
          <li>Right to access your personal data</li>
          <li>Right to correct inaccurate data</li>
          <li>Right to request deletion of your data</li>
          <li>Right to opt out of marketing communications</li>
          <li>Right to data portability</li>
        </ul>
        <p>
          <strong>To exercise any of these rights</strong>, or to ask what information we
          hold about you, email us at{' '}
          <a href="mailto:support@qtiservices.com">support@qtiservices.com</a>. We will
          confirm your request and respond using the contact details you provide.
        </p>
        <p style={{ marginBottom: 0 }}>
          <strong>To withdraw SMS consent</strong>, reply <strong>STOP</strong> to any
          text message from us, or email the address above and ask us to remove your
          number. Reply <strong>HELP</strong> for assistance at any time. Withdrawing SMS
          consent does not cancel a service request — where a reply is needed we will
          continue to respond by email.
        </p>
      </section>

      <section>
        <h2>Cookies</h2>
        <p>
          We use cookies and similar tracking technologies to enhance your experience on
          our website. You can control cookie settings through your browser preferences.
        </p>
      </section>

      <section>
        <h2>Children&rsquo;s Privacy</h2>
        <p>
          Our website is not intended for children under 13 years of age. We do not
          knowingly collect personal information from children under 13.
        </p>
      </section>

      <section>
        <h2>Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. We will notify you of any
          changes by posting the new Privacy Policy on this page and updating the
          &ldquo;Last updated&rdquo; date.
        </p>
      </section>

      <section>
        <h2>Contact Us</h2>
        <p>If you have any questions about this Privacy Policy, please contact us at:</p>
        <p><strong>Email:</strong> <a href="mailto:support@qtiservices.com">support@qtiservices.com</a></p>
      </section>

      <div className="lp-legal-related">
        <Link href="/terms-of-service">Terms of Service</Link>
        <Link href="/messaging-terms">Messaging Terms</Link>
        <Link href="/#cta">Contact Us</Link>
      </div>
    </LegalLayout>
  );
}
