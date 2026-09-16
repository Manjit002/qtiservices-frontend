'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Brand } from './Brand';
import { CONTACT, NAV } from './content';

/**
 * Top utility bar + sticky header.
 *
 * The source hides both the nav and the contact links below 960px and offers
 * nothing in their place, so a phone gets no navigation at all. A mobile menu
 * is added here carrying the same links plus the contact details the utility
 * bar drops.
 *
 * Portal links point at this app's own /admin/login and /expert/login rather
 * than the source's absolute admin.qtiservices.com URLs — those routes exist
 * here and are verified; the external hosts are not.
 */
export function SiteHeader() {
  const [open, setOpen] = useState(false);

  // Close on Escape, and lock scroll while the sheet is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <div className="lp-topbar">
        <div className="lp-tc">
          <a href={CONTACT.phoneHref}><span aria-hidden>📞</span> {CONTACT.phone}</a>
          <a href={CONTACT.emailHref}><span aria-hidden>✉</span> {CONTACT.email}</a>
          <a href="#cta"><span aria-hidden>📍</span> {CONTACT.location}</a>
        </div>

        <div className="lp-logins">
          <ThemeToggle compact />
          <Link href="/admin/login" className="lp-lb lp-lb-admin">
            <span aria-hidden>🔑</span> Admin Login
          </Link>
          <span className="lp-div" aria-hidden>|</span>
          <Link href="/expert/login" className="lp-lb lp-lb-expert">
            <span aria-hidden>👤</span> Expert Login
          </Link>
        </div>
      </div>

      <header className="lp-header">
        <Brand />

        <nav className="lp-nav" aria-label="Main">
          <ul>
            {NAV.map((n) => (
              <li key={n.href}><a href={n.href}>{n.label}</a></li>
            ))}
          </ul>
        </nav>

        <button
          type="button"
          className="lp-burger"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="lp-mobile-menu"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      <div id="lp-mobile-menu" className={`lp-mobile${open ? ' open' : ''}`}>
        {NAV.map((n) => (
          <a key={n.href} href={n.href} onClick={() => setOpen(false)}>{n.label}</a>
        ))}
        <div className="lp-mobile-contact">
          <a href={CONTACT.phoneHref}>📞 {CONTACT.phone}</a>
          <a href={CONTACT.emailHref}>✉ {CONTACT.email}</a>
          <a href="#cta">📍 {CONTACT.location}</a>
        </div>
      </div>
    </>
  );
}
