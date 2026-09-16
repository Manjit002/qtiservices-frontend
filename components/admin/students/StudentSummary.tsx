'use client';

import { formatCurrency, formatDate } from '@/lib/utils/format';
import type { StudentProfile, StudentStats } from '@/types';

/** Renders a value or a stated absence — never a blank cell. */
function Field({ label, value, hint }: { label: string; value?: string | null; hint?: string }) {
  return (
    <div>
      <div className="od-field-lbl">{label}</div>
      <div className={`od-field-val${value ? '' : ' empty'}`}>{value || 'Not available'}</div>
      {hint && <div className="t-xs text-faint" style={{ marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

export function StudentSummary({ student, stats }: { student: StudentProfile; stats: StudentStats }) {
  const cards = [
    { label: 'Total orders', value: String(stats.totalOrders), tone: 'var(--accent)' },
    { label: 'Completed', value: String(stats.completed), tone: 'var(--success)' },
    { label: 'Pending', value: String(stats.pending), tone: 'var(--warning)' },
    { label: 'Total value', value: formatCurrency(stats.totalSpent), tone: 'var(--gold)' },
  ];

  return (
    <>
      <div className="stu-stats" style={{ marginBottom: 'var(--s5)' }}>
        {cards.map((c) => (
          <div className="stu-stat" key={c.label}>
            <span className="stu-stat-flag" style={{ background: c.tone }} aria-hidden />
            <div className="stu-stat-val">{c.value}</div>
            <div className="stu-stat-lbl">{c.label}</div>
          </div>
        ))}
      </div>

      <section className="card" style={{ marginBottom: 'var(--s5)' }}>
        <div className="card-head"><h3 className="t-h3">Student information</h3></div>
        <div className="stu-fields">
          <Field label="Phone" value={student.phone} />
          <Field label="Country" value={student.country} />
          {/* The label changes with provenance: if this date came from the
              earliest order rather than a profile record, saying "Joined" would
              claim a signup date the backend never gave us. */}
          <Field
            label={student.joinedFromOrders ? 'First order' : 'Joined'}
            value={student.createdAt ? formatDate(student.createdAt) : null}
            hint={student.joinedFromOrders ? 'Derived from earliest order' : undefined}
          />
          <Field label="Last seen" value={student.lastSeen ? formatDate(student.lastSeen) : null} />
          <Field label="Account status" value={student.active ? 'Active' : 'Inactive'} />
          <Field label="Email verified" value={student.verified ? 'Verified' : 'Not verified'} />
        </div>
      </section>
    </>
  );
}
