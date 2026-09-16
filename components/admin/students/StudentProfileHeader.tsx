'use client';

import { BadgeCheck, Power, PowerOff } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { fmtStudentId, formatCurrency } from '@/lib/utils/format';
import type { StudentProfile } from '@/types';

interface Props {
  student: StudentProfile;
  busy: boolean;
  onToggleActive: (active: boolean) => void;
}

export function StudentProfileHeader({ student, busy, onToggleActive }: Props) {
  const initial = (student.name || student.email || 'S').charAt(0).toUpperCase();

  return (
    <section className="card" style={{ marginBottom: 'var(--s5)' }}>
      <div className="stu-hero">
        <div className="stu-avatar" aria-hidden>{initial}</div>

        <div className="stu-ident">
          <h2 className="t-h2 truncate">{student.name || 'Unknown student'}</h2>
          <div className="t-sm text-mid truncate">{student.email || 'No email on record'}</div>
          <div className="stu-chips">
            <Badge tone="accent">{fmtStudentId(student.id)}</Badge>
            <Badge tone={student.active ? 'success' : 'danger'} dot>
              {student.active ? 'Active' : 'Inactive'}
            </Badge>
            {student.verified && (
              <Badge tone="info"><BadgeCheck size={11} /> Verified</Badge>
            )}
          </div>
        </div>

        <div className="stu-wallet">
          <div className="t-eyebrow">Wallet balance</div>
          <div className="stu-wallet-val">{formatCurrency(student.walletBalance)}</div>
          {student.id != null && (
            <div style={{ marginTop: 'var(--s3)' }}>
              {student.active ? (
                <Button size="sm" variant="danger" disabled={busy}
                        onClick={() => onToggleActive(false)} style={{ width: '100%' }}>
                  <PowerOff size={13} /> Deactivate
                </Button>
              ) : (
                <Button size="sm" variant="primary" disabled={busy}
                        onClick={() => onToggleActive(true)} style={{ width: '100%' }}>
                  <Power size={13} /> Activate
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
