'use client';

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import './auth.css';

interface AuthLayoutProps {
  portal: 'admin' | 'expert';
  eyebrow: string;
  claim: ReactNode;
  sub: string;
  points: { icon: LucideIcon; title: string; body: string }[];
  children: ReactNode;
}

export function AuthLayout({ portal, eyebrow, claim, sub, points, children }: AuthLayoutProps) {
  return (
    <div className="auth" data-portal={portal}>
      <section className="auth-brand">
        <div className="auth-grid" aria-hidden />
        <span className="wordmark" style={{ fontSize: '1.5rem' }}>QTI<em>Services</em></span>

        <div className="auth-claim">
          <div className="t-eyebrow" style={{ color: 'var(--accent-text)' }}>{eyebrow}</div>
          <h1 className="t-h1" style={{ marginTop: 'var(--s3)' }}>{claim}</h1>
          <p className="t-body text-mid" style={{ marginTop: 'var(--s3)', maxWidth: 420 }}>{sub}</p>

          <div className="auth-points">
            {points.map((p) => {
              const Icon = p.icon;
              return (
                <div className="auth-point" key={p.title}>
                  <span className="auth-point-icon"><Icon size={15} /></span>
                  <span>
                    <span className="t-sm" style={{ fontWeight: 600, display: 'block' }}>{p.title}</span>
                    <span className="t-sm text-dim">{p.body}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="t-xs text-faint" style={{ marginTop: 'var(--s10)' }}>
          © {new Date().getFullYear()} QTIServices
        </div>
      </section>

      <section className="auth-form">
        <div style={{ position: 'absolute', top: 'var(--s5)', right: 'var(--s5)' }}>
          <ThemeToggle compact />
        </div>
        <div className="auth-card rise">{children}</div>
      </section>
    </div>
  );
}
