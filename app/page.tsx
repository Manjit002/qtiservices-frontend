import type { Metadata } from 'next';
import { SiteHeader } from '@/components/home/landing/SiteHeader';
import { Hero } from '@/components/home/landing/Hero';
import { Services } from '@/components/home/landing/Services';
import { StatsBanner } from '@/components/home/landing/StatsBanner';
import { About } from '@/components/home/landing/About';
import { Technologies } from '@/components/home/landing/Technologies';
import { ServiceDetails } from '@/components/home/landing/ServiceDetails';
import { Blog } from '@/components/home/landing/Blog';
import { CtaSection } from '@/components/home/landing/CtaSection';
import { SiteFooter } from '@/components/home/landing/SiteFooter';
import '@/components/home/landing.css';

/** Title and description taken from the source page's <head>. */
export const metadata: Metadata = {
  title: 'QTIServices – Quality Technology Integration',
  description:
    'QTIServices – Enterprise IT Solutions. Cloud, Cybersecurity, Software Development & Managed Services since 2008.',
};

/**
 * Server component — only the header (mobile menu) and stats banner (counter)
 * need the client, so the bulk of the page ships as static HTML.
 */
export default function HomePage() {
  return (
    <div className="lp">
      <SiteHeader />
      <main>
        <Hero />
        <Services />
        <ServiceDetails />
        <StatsBanner />
        <About />
        <Technologies />
        <Blog />
        <CtaSection />
      </main>
      <SiteFooter />
    </div>
  );
}
