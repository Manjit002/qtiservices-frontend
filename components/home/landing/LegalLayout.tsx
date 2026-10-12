import type { ReactNode } from 'react';
import { SiteHeader } from './SiteHeader';
import { SiteFooter } from './SiteFooter';
import '../landing.css';

interface Props {
  title: string;
  subtitle?: string;
  updated: string;
  children: ReactNode;
}

/**
 * Shell shared by the three restored legal pages. Reuses the exact same
 * SiteHeader/SiteFooter as the homepage and the same `.lp` design tokens, so
 * these pages read as part of the same site rather than a bolted-on
 * boilerplate page — none of this existed before; the old source's own
 * legal pages used a completely different (shadcn/teal) design system that
 * is deliberately not reproduced here.
 */
export function LegalLayout({ title, subtitle, updated, children }: Props) {
  return (
    <div className="lp">
      <SiteHeader />
      <main>
        <section className="lp-legal-hero">
          <h1 className="lp-legal-h1">{title}</h1>
          {subtitle && <p className="lp-legal-sub">{subtitle}</p>}
          <p className="lp-legal-updated">Last updated: {updated}</p>
        </section>

        <section className="lp-sec lp-white">
          <div className="lp-legal">{children}</div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
