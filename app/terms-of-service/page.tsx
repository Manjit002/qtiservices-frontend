import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalLayout } from '@/components/home/landing/LegalLayout';

export const metadata: Metadata = {
  title: 'Terms of Service | QTIServices',
  description: 'The terms governing use of the QTIServices website and services.',
};

/**
 * Restored from the old QTI source (src/pages/TermsOfService.tsx).
 *
 * The Services list is the one place this document's content genuinely
 * changes rather than just being re-presented: the old list only covered the
 * six original IT services, and now correctly includes online tutoring,
 * which this restoration adds as a real, currently-offered service. Every
 * other clause is preserved as written, including "Governing Law:
 * California" — that is an existing legal term, not something invented here,
 * and is left untouched even though it sits oddly next to a New York office
 * address (see CONTENT-RESTORE.md; this is a legal question for QTIServices
 * to confirm, not one this restoration can resolve).
 */
export default function TermsOfServicePage() {
  return (
    <LegalLayout title="Terms of Service" updated="September 16, 2026">
      <section>
        <h2>Agreement to Terms</h2>
        <p>
          By accessing or using the QTIServices website and our services, you agree to
          be bound by these Terms of Service. If you disagree with any part of these
          terms, you may not access our website or use our services.
        </p>
      </section>

      <section>
        <h2>Services</h2>
        <p>QTIServices provides technology consulting and development services, including but not limited to:</p>
        <ul>
          <li>Custom software development</li>
          <li>Cloud solutions and migration</li>
          <li>Mobile application development</li>
          <li>Data analytics and business intelligence</li>
          <li>Cybersecurity services</li>
          <li>IT consulting and strategy</li>
          <li>Online tutoring and educational support, connecting students and professionals in the United States with subject-matter tutors</li>
        </ul>
      </section>

      <section>
        <h2>Use of Website</h2>
        <p>You agree to use our website only for lawful purposes and in a way that does not:</p>
        <ul>
          <li>Infringe upon the rights of others</li>
          <li>Restrict or inhibit anyone&rsquo;s use of the website</li>
          <li>Attempt to gain unauthorized access to our systems</li>
          <li>Transmit malicious software or harmful code</li>
          <li>Engage in any activity that violates applicable laws</li>
        </ul>
      </section>

      <section>
        <h2>Intellectual Property</h2>
        <p>
          All content on this website, including text, graphics, logos, images and
          software, is the property of QTIServices or its content suppliers and is
          protected by intellectual property laws. You may not reproduce, distribute,
          modify or create derivative works from any content without our express
          written permission.
        </p>
      </section>

      <section>
        <h2>Project Engagements</h2>
        <p>
          Specific terms for project engagements, including scope, deliverables,
          timelines, payment terms and warranties, will be outlined in a separate
          service agreement or statement of work provided upon project initiation.
          These Terms of Service are supplemented by any such project-specific
          agreements.
        </p>
      </section>

      <section>
        <h2>Payment Terms</h2>
        <p>
          Payment terms for services will be specified in individual project
          agreements. All fees are non-refundable unless otherwise stated in the
          project agreement.
        </p>
      </section>

      <section>
        <h2>Confidentiality</h2>
        <p>
          Both parties agree to maintain the confidentiality of proprietary information
          disclosed during any engagement. This obligation survives the termination of
          any agreement between the parties.
        </p>
      </section>

      <section>
        <h2>Limitation of Liability</h2>
        <p>
          To the fullest extent permitted by law, QTIServices shall not be liable for
          any indirect, incidental, special, consequential or punitive damages, or any
          loss of profits or revenues, whether incurred directly or indirectly. Our
          total liability for any claims arising from our services shall not exceed the
          amount paid by you for the specific services giving rise to the claim.
        </p>
      </section>

      <section>
        <h2>Disclaimer of Warranties</h2>
        <p>
          Our website and services are provided &ldquo;as is&rdquo; and &ldquo;as
          available&rdquo; without warranties of any kind, either express or implied. We
          do not warrant that our website will be uninterrupted, error-free, or free of
          viruses or other harmful components.
        </p>
      </section>

      <section>
        <h2>Indemnification</h2>
        <p>
          You agree to indemnify and hold harmless QTIServices, its officers, directors,
          employees and agents from any claims, damages, losses or expenses arising
          from your use of our website or services or your violation of these Terms of
          Service.
        </p>
      </section>

      <section>
        <h2>Governing Law</h2>
        <p>
          These Terms of Service shall be governed by and construed in accordance with
          the laws of the State of California, without regard to its conflict of law
          provisions.
        </p>
      </section>

      <section>
        <h2>Changes to Terms</h2>
        <p>
          We reserve the right to modify these Terms of Service at any time. We will
          notify you of any changes by posting the new Terms of Service on this page
          and updating the &ldquo;Last updated&rdquo; date. Your continued use of the
          website after any changes constitutes acceptance of the new terms.
        </p>
      </section>

      <section>
        <h2>Contact Us</h2>
        <p>If you have any questions about these Terms of Service, please contact us at:</p>
        <p><strong>Email:</strong> <a href="mailto:support@qtiservices.com">support@qtiservices.com</a></p>
        <p>For information about our SMS messaging program, please see our{' '}
          <Link href="/messaging-terms">Messaging Terms</Link>.
        </p>
      </section>

      <div className="lp-legal-related">
        <Link href="/privacy-policy">Privacy Policy</Link>
        <Link href="/messaging-terms">Messaging Terms</Link>
        <Link href="/#cta">Contact Us</Link>
      </div>
    </LegalLayout>
  );
}
