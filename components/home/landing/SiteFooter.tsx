import Link from 'next/link';
import { Brand } from './Brand';
import { CONTACT, FOOTER_COMPANY, FOOTER_SERVICES, LEGAL_LINKS } from './content';

export function SiteFooter() {
  return (
    <footer className="lp-footer">
      <div className="lp-ft-grid">
        <div>
          <Brand inverted />
          <p className="lp-ft-desc">
            Enterprise IT solutions engineered for performance, security, and
            reliability. Your trusted technology partner — from start-up to enterprise
            and beyond.
          </p>
          <div className="lp-ft-portals">
            <Link href="/admin/login" className="lp-ft-portal lp-ft-admin">
              <span aria-hidden>🔑</span> Admin Portal
            </Link>
            <Link href="/expert/login" className="lp-ft-portal lp-ft-expert">
              <span aria-hidden>👤</span> Expert Portal
            </Link>
          </div>
        </div>

        <div className="lp-ft-col">
          <h4>Services</h4>
          <ul>
            {FOOTER_SERVICES.map((s) => (
              <li key={s}><a href="#services">{s}</a></li>
            ))}
          </ul>
        </div>

        <div className="lp-ft-col">
          <h4>Company</h4>
          <ul>
            {FOOTER_COMPANY.map((c) => (
              <li key={c}><a href="#about">{c}</a></li>
            ))}
          </ul>
        </div>

        <div className="lp-ft-col">
          <h4>Contact Us</h4>
          <ul>
            {/* Recovered from the old site's footer — this address never
                appeared on the current site at all. */}
            <li className="lp-ft-addr">
              {CONTACT.addressLines.map((line) => <span key={line}>{line}</span>)}
            </li>
            <li><a href={CONTACT.emailHref}>{CONTACT.email}</a></li>
            <li><a href={CONTACT.phoneHref}>{CONTACT.phone}</a></li>
            <li><a href="#cta">Support Centre</a></li>
          </ul>
        </div>
      </div>

      <div className="lp-ft-bottom">
        <p>
          © {new Date().getFullYear()} QTIServices. All rights reserved.
          &nbsp;|&nbsp; Quality Technology Integration
        </p>
        {/* Previously pointed at "#cta" — these are now real pages. Phone and
            email already appear in the Contact Us column above, so this row
            carries the legal links instead of repeating them. */}
        <p>
          {LEGAL_LINKS.map((l, i) => (
            <span key={l.href}>
              {i > 0 && <>&nbsp;|&nbsp;</>}
              <Link href={l.href}>{l.label}</Link>
            </span>
          ))}
        </p>
      </div>
    </footer>
  );
}
