import { SERVICE_DETAILS } from './service-content';

/**
 * All 18 service content blocks, rendered inline on the page.
 *
 * 9 services × 2 blocks. Every block is output here — nothing is featured,
 * truncated, collapsed behind a toggle, or left in data without rendering.
 * The count is asserted by a build-time check below so it cannot silently
 * drift if the data file changes.
 */

// Fails the build rather than shipping a wrong count.
const EXPECTED_SERVICES = 9;
const EXPECTED_BLOCKS = 18;
if (SERVICE_DETAILS.length !== EXPECTED_SERVICES) {
  throw new Error(
    `ServiceDetails: expected ${EXPECTED_SERVICES} services, found ${SERVICE_DETAILS.length}`
  );
}
const TOTAL_BLOCKS = SERVICE_DETAILS.reduce((n, s) => n + s.blocks.length, 0);
if (TOTAL_BLOCKS !== EXPECTED_BLOCKS) {
  throw new Error(
    `ServiceDetails: expected ${EXPECTED_BLOCKS} blocks, found ${TOTAL_BLOCKS}`
  );
}

export function ServiceDetails() {
  return (
    <section className="lp-sec lp-white" id="service-details">
      <div className="lp-eyebrow center">Service Detail</div>
      <h2 className="lp-h2" style={{ textAlign: 'center', marginBottom: 14 }}>
        Capabilities in Depth
      </h2>
      <p className="lp-sub" style={{ margin: '0 auto 56px', textAlign: 'center' }}>
        Two detailed areas for each of our nine services — what we deliver, and how
        each engagement is run and sustained.
      </p>

      {SERVICE_DETAILS.map((service, i) => (
        <div className="lp-sd-group" key={service.slug} id={service.slug}>
          <div className="lp-sd-head">
            <span className="lp-sd-num" aria-hidden>
              {String(i + 1).padStart(2, '0')}
            </span>
            <h3 className="lp-sd-service">{service.title}</h3>
          </div>

          <div className="lp-sd-blocks">
            {service.blocks.map((block) => (
              <article className="lp-sd-block" key={block.title}>
                <h4 className="lp-sd-title">{block.title}</h4>
                <p className="lp-sd-desc">{block.description}</p>
                <h5 className="lp-sd-areas-label">Key Areas</h5>
                <ul className="lp-sd-areas">
                  {block.areas.map((a) => <li key={a}>{a}</li>)}
                </ul>
              </article>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
