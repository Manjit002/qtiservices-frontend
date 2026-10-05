import type { Metadata } from 'next';
import { SiteHeader } from '@/components/home/landing/SiteHeader';
import { SiteFooter } from '@/components/home/landing/SiteFooter';
import { ServiceDetails } from '@/components/home/landing/ServiceDetails';
import '@/components/home/landing.css';

export const metadata: Metadata = {
  title: 'Services | QTIServices',
  description:
    'Detailed capabilities across cloud, cybersecurity, software development, managed IT, network infrastructure, consulting, mobile, data and educational support.',
};

/**
 * Renders the same complete set of 18 blocks as the homepage section, so this
 * route is never a thinner version of what is already on the page.
 */
export default function ServicesIndexPage() {
  return (
    <div className="lp">
      <SiteHeader />
      <main>
        {/* The page needs its own h1. ServiceDetails starts at h2 because on the
            homepage it sits under the hero's h1 — rendered alone here, it left
            this route with no primary heading at all. Same hero pattern as
            /blog and the legal pages. */}
        <section className="lp-legal-hero">
          <div className="lp-eyebrow center">Services</div>
          <h1 className="lp-legal-h1">Our Services</h1>
          <p className="lp-legal-sub" style={{ maxWidth: 640, margin: '0 auto' }}>
            Nine service areas, each described in two parts: what we deliver, and
            how each engagement is run and sustained.
          </p>
        </section>
        <ServiceDetails />
      </main>
      <SiteFooter />
    </div>
  );
}
