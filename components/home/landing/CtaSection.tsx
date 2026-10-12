import { CONTACT } from './content';
import { ProjectRequestForm } from './ProjectRequestForm';

export function CtaSection() {
  return (
    <section className="lp-cta" id="cta">
      <div className="lp-eyebrow center" style={{ color: 'var(--gold)' }}>
        Get Started Today
      </div>
      <h2>Ready to Transform<br />Your IT Infrastructure?</h2>
      <p>
        Contact our team for a no-obligation consultation. We will deliver a tailored
        technology roadmap and detailed proposal within 48 business hours.
      </p>
      <div className="lp-cta-row">
        <a href={CONTACT.emailHref} className="lp-btn-gold">Request a Free Consultation</a>
        <a href={CONTACT.phoneHref} className="lp-btn-outline">Speak With an Expert</a>
      </div>

      {/* Real project-request form with the carrier-compliant, two-checkbox
          consent flow — see ProjectRequestForm.tsx. The two quick actions
          above are unchanged and still work for anyone who'd rather not fill
          out the form. */}
      <div className="lp-cta-or"><span>or fill out a project request</span></div>
      <ProjectRequestForm />
    </section>
  );
}
