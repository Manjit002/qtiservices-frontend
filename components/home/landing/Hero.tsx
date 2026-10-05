import { HERO_STATS } from './content';

export function Hero() {
  return (
    <section className="lp-hero" id="hero">
      <div className="lp-hero-inner">
        <div className="lp-kicker">Enterprise IT Solutions Since 2008</div>

        <h1 className="lp-h1">
          Quality. Technology.<br /><em>Integration.</em>
        </h1>

        <p className="lp-hero-p">
          We engineer the digital backbone of modern enterprises — delivering cloud
          solutions, cybersecurity, custom software development, and managed IT services
          with over a decade of proven excellence.
        </p>

        <div className="lp-ctas">
          <a href="#cta" className="lp-btn-gold">Request a Consultation</a>
          <a href="#services" className="lp-btn-outline">View Our Services</a>
        </div>

        <div className="lp-strip">
          {HERO_STATS.map((s) => (
            <div className="lp-hs" key={s.label}>
              <span className="lp-hs-val">{s.value}</span>
              <span className="lp-hs-lbl">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
