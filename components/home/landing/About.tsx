import { KPIS, PROCESS, VALUES } from './content';

export function About() {
  return (
    <section className="lp-sec lp-cream" id="about">
      <div className="lp-2col">
        <div>
          <div className="lp-eyebrow">Why Choose QTIServices</div>
          <h2 className="lp-h2">
            Technology Engineered<br />Around Your Outcomes
          </h2>
          <p className="lp-sub">
            Founded on the principle that IT should accelerate business rather than
            impede it, QTIServices has been the trusted technology partner of
            enterprises across industries for over a decade.
          </p>

          <ul className="lp-process">
            {PROCESS.map((p) => (
              <li key={p.step}>
                <div className="lp-step" aria-hidden>{p.step}</div>
                <div className="lp-pb">
                  <strong>{p.title}</strong>
                  <span>{p.body}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <figure className="lp-quote">
            <blockquote>
              &ldquo;We don&rsquo;t merely deploy technology — we build lasting
              partnerships. Every engagement is measured against outcomes that matter
              to your business, not just to ours.&rdquo;
            </blockquote>
            <cite>— QTIServices Leadership Team</cite>
          </figure>

          <div className="lp-kpis">
            {KPIS.map((k) => (
              <div className="lp-kpi" key={k.value}>
                <div className="lp-kpi-val">{k.value}</div>
                <div className="lp-kpi-lbl">{k.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/*
        Recovered from the old QTI source's About page, which the current
        site never had. Presented as qualitative principles rather than
        alongside its numeric stats (10+ years, 150+ projects, 50+ team,
        98% satisfaction) — those figures conflict with what this page
        already publishes elsewhere (500+ clients, 15+ years, 98% retention,
        99.9% uptime), and a second, contradicting set of numbers would be
        worse than omitting them. See CONTENT-RESTORE.md for the full
        reasoning.
      */}
      <div className="lp-values">
        {VALUES.map((v) => (
          <div className="lp-value" key={v.title}>
            <span className="lp-value-icon" aria-hidden>{v.icon}</span>
            <h3 className="lp-value-title">{v.title}</h3>
            <p className="lp-value-desc">{v.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
