import Link from 'next/link';
import { SERVICES } from './content';

export function Services() {
  return (
    <section className="lp-sec lp-white" id="services">
      <div className="lp-srv-head">
        <div>
          <div className="lp-eyebrow">Our Services</div>
          <h2 className="lp-h2">
            Comprehensive IT Solutions<br />for Every Business Need
          </h2>
        </div>
        <p className="lp-sub">
          From infrastructure to innovation — we cover every layer of your technology
          stack with precision-built solutions tailored to your objectives.
        </p>
      </div>

      <div className="lp-srv-grid">
        {SERVICES.map((s) => (
          <article className="lp-srv" key={s.num}>
            <div className="lp-srv-num" aria-hidden>{s.num}</div>
            <div className="lp-srv-icon" aria-hidden>{s.icon}</div>
            <h3 className="lp-srv-title">{s.title}</h3>
            <p className="lp-srv-desc">{s.desc}</p>
            {/* Previously pointed at the contact CTA, so "Learn More" led to a
                form rather than to information about the service. Now links to
                that service's detail page. */}
            <Link href={`/services/${s.slug}`} className="lp-srv-more">
              Learn More <span aria-hidden>→</span>
              <span className="visually-hidden"> about {s.title}</span>
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
