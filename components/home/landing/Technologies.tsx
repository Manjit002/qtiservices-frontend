import { TECHNOLOGIES } from './content';

export function Technologies() {
  return (
    <section className="lp-sec lp-white" id="tech" style={{ textAlign: 'center' }}>
      <div className="lp-eyebrow center">Technologies</div>
      <h2 className="lp-h2" style={{ marginBottom: 48 }}>
        Built on Industry-Trusted Platforms
      </h2>
      <ul className="lp-pills">
        {TECHNOLOGIES.map((t) => (
          <li className="lp-pill" key={t}>{t}</li>
        ))}
      </ul>
    </section>
  );
}
