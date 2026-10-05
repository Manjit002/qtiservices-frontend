import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SiteHeader } from '@/components/home/landing/SiteHeader';
import { SiteFooter } from '@/components/home/landing/SiteFooter';
import { SERVICE_DETAILS, getServiceDetail } from '@/components/home/landing/service-content';
import { SERVICES } from '@/components/home/landing/content';
import '@/components/home/landing.css';

interface Props {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return SERVICE_DETAILS.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const detail = getServiceDetail(slug);
  if (!detail) return { title: 'Service not found | QTIServices' };
  const card = SERVICES.find((s) => s.title === detail.title);
  return {
    title: `${detail.title} | QTIServices`,
    // Reuses the existing card description as the meta description rather than
    // writing a second summary that could drift out of sync with it.
    description: card?.desc ?? detail.blocks[0].description,
  };
}

export default async function ServiceDetailPage({ params }: Props) {
  const { slug } = await params;
  const detail = getServiceDetail(slug);
  if (!detail) notFound();

  const card = SERVICES.find((s) => s.title === detail.title);
  const others = SERVICE_DETAILS.filter((s) => s.slug !== detail.slug);

  return (
    <div className="lp">
      <SiteHeader />
      <main>
        <section className="lp-legal-hero">
          <div className="lp-eyebrow center">Services</div>
          <h1 className="lp-legal-h1">{detail.title}</h1>
          {card && (
            <p className="lp-legal-sub" style={{ maxWidth: 660, margin: '0 auto' }}>
              {card.desc}
            </p>
          )}
        </section>

        <section className="lp-sec lp-white">
          <div className="lp-svc-blocks">
            {detail.blocks.map((block) => (
              <article className="lp-svc-block" key={block.title}>
                <h2 className="lp-svc-block-title">{block.title}</h2>
                <p className="lp-svc-block-desc">{block.description}</p>
                <h3 className="lp-svc-areas-label">Key Areas</h3>
                <ul className="lp-svc-areas">
                  {block.areas.map((a) => <li key={a}>{a}</li>)}
                </ul>
              </article>
            ))}
          </div>

          <div className="lp-svc-cta">
            <p>Discuss how this applies to your environment.</p>
            <Link href="/#cta" className="lp-btn-outline-dark">Contact our team</Link>
          </div>
        </section>

        <section className="lp-sec lp-cream">
          <div className="lp-eyebrow center">More Services</div>
          <h2 className="lp-h2" style={{ textAlign: 'center', marginBottom: 36 }}>
            Related Capabilities
          </h2>
          <ul className="lp-svc-other">
            {others.map((o) => (
              <li key={o.slug}>
                <Link href={`/services/${o.slug}`}>{o.title}</Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
