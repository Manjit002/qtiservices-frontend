'use client';

import { useEffect, useMemo } from 'react';
import {
  ArrowLeft, RotateCcw, UserMinus, MessagesSquare, DollarSign, Link2,
  CalendarClock, FolderOpen, Printer, Trash2, Send, CheckCircle2, Receipt, PencilLine,
  CreditCard, FileText, Users2, GraduationCap, Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StatusBadge, Badge } from '@/components/ui/Badge';
import { DeadlineMeter, deadlineState } from '@/components/ui/DeadlineMeter';
import { Skeleton, EmptyState, ErrorState } from '@/components/ui/States';
import { useAsync } from '@/hooks/useAsync';
import { useLiveClock } from '@/hooks/useLiveDeadlines';
import { ordersApi } from '@/lib/api/orders';
import { paymentsApi, installmentsApi } from '@/lib/api/payments';
import { STEPPER_FLOWS, activeStepIndex, isAssigned } from '@/lib/utils/statusConfig';
import { trackRecentOrder } from '@/lib/utils/recentOrders';
import {
  enumValue, fmtOrderId, fmtStudentId, formatCurrency, formatDate, formatDateTime,
} from '@/lib/utils/format';
import { isInstallmentPaid } from '@/types/payment';
import type { OrderDTO, OrderDetailDTO } from '@/types';
import './order-detail.css';

interface Props {
  orderId: number;
  isSuperAdmin: boolean;
  onBack: () => void;
  onAssign: (order: OrderDTO, reassign: boolean) => void;
  onSetPrice: (order: OrderDTO) => void;
  onPayLink: (order: OrderDTO) => void;
  onOpenFiles: (order: OrderDTO) => void;
  onOpenChat: (order: OrderDTO) => void;
  onEditDeadlines: (order: OrderDTO) => void;
  /** Receives the full detail DTO — the form needs fields the list row lacks. */
  onEditOrder: (order: OrderDetailDTO) => void;
  onDelete: (order: OrderDTO) => void;
  onUnassign: (order: OrderDTO) => void;
  onComplete: (order: OrderDTO) => void;
  busy?: boolean;
}

/** Renders a value, or a stated absence — never a blank cell. */
function Field({ label, value }: { label: string; value?: unknown }) {
  const v = value === null || value === undefined || value === '' ? null : String(value);
  return (
    <div className="od-field">
      <div className="od-field-lbl">{label}</div>
      <div className={`od-field-val${v ? '' : ' empty'}`}>{v ?? 'Not provided'}</div>
    </div>
  );
}

export function OrderDetail({
  orderId, isSuperAdmin, onBack, onAssign, onSetPrice, onPayLink, onOpenFiles,
  onOpenChat, onEditDeadlines, onEditOrder, onDelete, onUnassign, onComplete, busy = false,
}: Props) {
  useLiveClock();

  const detail = useAsync((signal) => ordersApi.detail(orderId, signal), [orderId]);

  /**
   * Payments and installments are separate endpoints from the order itself.
   * They load independently so a failure in either does not blank the page —
   * the order record still renders and only that section shows its own error.
   */
  const payments = useAsync((signal) => paymentsApi.byOrder(orderId, signal), [orderId]);
  const installments = useAsync((signal) => installmentsApi.forOrder(orderId, signal), [orderId]);

  const d = detail.data;

  useEffect(() => { if (d) trackRecentOrder(d.id, d.subject ?? ''); }, [d]);

  const steps = STEPPER_FLOWS.admin;
  const activeIdx = useMemo(() => activeStepIndex(enumValue(d?.status), steps), [d?.status, steps]);

  if (detail.loading) {
    return (
      <div className="od-cols">
        <div className="od-main">
          <Skeleton h={90} r={12} /><Skeleton h={220} r={12} /><Skeleton h={180} r={12} />
        </div>
        <div className="od-rail"><Skeleton h={260} r={12} /><Skeleton h={160} r={12} /></div>
      </div>
    );
  }
  if (detail.error) return <ErrorState message={detail.error} onRetry={detail.reload} />;
  if (!d) return null;

  const status = enumValue(d.status);
  const payStatus = enumValue(d.paymentStatus);
  const assigned = Boolean(d.assignedEmployeeId) || isAssigned(status);
  const cancelled = status === 'CANCELLED';

  // Source of truth for price, in the order the legacy detail resolved it.
  const total = d.finalPrice ?? d.totalPrice ?? d.autoPrice ?? d.price ?? null;
  const paid = d.paidAmount ?? 0;
  const due = d.remainingAmount ?? (total != null ? Math.max(0, total - paid) : null);

  const order = d as unknown as OrderDTO;
  const payRows = payments.data ?? [];
  const instRows = installments.data ?? [];

  return (
    <div className="rise">
      {/* ── Header ── */}
      <div className="od-head">
        <div>
          <Button variant="ghost" size="sm" onClick={onBack} style={{ marginBottom: 'var(--s3)' }}>
            <ArrowLeft size={14} /> Back to orders
          </Button>
          <div className="od-title">
            <span className="od-id">{fmtOrderId(d.id)}</span>
            <StatusBadge status={status} />
            {payStatus && <Badge tone={payStatus === 'SUCCESS' ? 'success' : 'warning'}>{payStatus.replace(/_/g, ' ').toLowerCase()}</Badge>}
          </div>
          <p className="t-sm text-dim" style={{ marginTop: 5 }}>
            {d.subject || 'Untitled order'} · created {formatDate(d.createdAt)}
          </p>
        </div>
        <Button size="sm" onClick={() => window.print()}>
          <Printer size={14} /> Print
        </Button>
      </div>

      {/* ── Timeline ── */}
      <div className="card" style={{ marginBottom: 'var(--s5)' }}>
        {cancelled ? (
          <div style={{ padding: 'var(--s5)', textAlign: 'center', color: 'var(--danger)' }}>
            This order was cancelled.
          </div>
        ) : (
          <div className="od-steps">
            {steps.map((st, i) => {
              const state = activeIdx >= 0 && i < activeIdx ? 'done' : i === activeIdx ? 'now' : '';
              return (
                <div key={st.k} style={{ display: 'contents' }}>
                  <div className={`od-step ${state}`}>
                    <div className="od-step-dot">{state === 'done' ? '✓' : i + 1}</div>
                    <div className="od-step-label">{st.l}</div>
                  </div>
                  {i < steps.length - 1 && (
                    <div className={`od-step-line${activeIdx > i ? ' done' : ''}`} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="od-cols">
        {/* ══ LEFT: the record ══ */}
        <div className="od-main">
          <section className="card">
            <div className="card-head"><h2 className="t-h3">Assignment</h2></div>
            <div className="od-fields">
              <Field label="Subject" value={d.subject} />
              <Field label="Type" value={d.assignmentType ?? d.type} />
              <Field label="Academic level" value={d.academicLevel} />
              <Field label="University" value={d.university} />
              <Field label="Country" value={d.country} />
              <Field label="Word count" value={d.instructionsWordCount} />
            </div>
          </section>

          {/* ── Payment summary ── */}
          <section className="card">
            <div className="card-head">
              <h2 className="t-h3">Payment summary</h2>
              {d.pricingSource ? <span className="t-xs text-dim">Source: {d.pricingSource}</span> : null}
            </div>
            <div className="od-money">
              <div className="od-money-cell">
                <div className="od-money-lbl">Total</div>
                <div className="od-money-val">{total != null ? formatCurrency(total) : '—'}</div>
              </div>
              <div className="od-money-cell">
                <div className="od-money-lbl">Paid</div>
                <div className="od-money-val" style={{ color: paid > 0 ? 'var(--success)' : undefined }}>
                  {formatCurrency(paid)}
                </div>
              </div>
              <div className="od-money-cell">
                <div className="od-money-lbl">Due</div>
                <div className="od-money-val" style={{ color: (due ?? 0) > 0 ? 'var(--danger)' : undefined }}>
                  {due != null ? formatCurrency(due) : '—'}
                </div>
              </div>
            </div>
            {(d.autoPriced || d.adjustmentRequired) && (
              <div style={{ padding: '0 var(--s5) var(--s5)' }}>
                <div className={`alert ${d.adjustmentRequired ? 'error' : ''}`}
                     style={d.adjustmentRequired ? undefined : { background: 'var(--warning-bg)', color: 'var(--warning)' }}>
                  {d.adjustmentRequired
                    ? `Additional payment of ${formatCurrency(d.adjustmentAmount ?? 0)} required after price adjustment.`
                    : `Auto-priced at ${formatCurrency(d.autoPrice ?? 0)}${d.adminPrice != null ? ` · admin set ${formatCurrency(d.adminPrice)}` : ''}${d.pricingNote ? ` — ${d.pricingNote}` : ''}`}
                </div>
              </div>
            )}
          </section>

          {/* ── Payment history (was entirely missing) ── */}
          <section className="card">
            <div className="card-head">
              <h2 className="t-h3">Payment history</h2>
              <span className="t-xs text-dim">
                {payments.loading ? '' : `${payRows.length} record${payRows.length === 1 ? '' : 's'}`}
              </span>
            </div>
            {payments.loading && <div style={{ padding: 'var(--s5)' }}><Skeleton h={70} /></div>}
            {payments.error && <ErrorState message={payments.error} onRetry={payments.reload} />}
            {!payments.loading && !payments.error && payRows.length === 0 && (
              <EmptyState icon={<Receipt size={18} />} title="No payments recorded"
                          hint="Individual transactions against this order will appear here once a payment is attempted." />
            )}
            {payRows.length > 0 && (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>#</th>
                      <th>Amount</th><th>Status</th><th>Method</th><th>Date</th><th>Reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payRows.map((p, i) => (
                      <tr key={p.id ?? i}>
                        <td className="text-dim">{i + 1}</td>
                        <td style={{ fontWeight: 600 }}>{p.amount != null ? formatCurrency(p.amount) : '—'}</td>
                        <td><StatusBadge status={p.status} /></td>
                        <td className="t-sm">{p.method ?? <span className="text-faint">—</span>}</td>
                        <td className="t-sm text-dim">{p.createdAt ? formatDate(p.createdAt) : '—'}</td>
                        <td className="t-xs text-faint truncate" style={{ maxWidth: 150 }}
                            title={p.paymentIntentId ?? ''}>
                          {p.paymentIntentId ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ── Installments ── */}
          <section className="card">
            <div className="card-head">
              <h2 className="t-h3">Installments</h2>
              <span className="t-xs text-dim">
                {installments.loading ? '' : `${instRows.length} scheduled`}
              </span>
            </div>
            {installments.loading && <div style={{ padding: 'var(--s5)' }}><Skeleton h={56} /></div>}
            {installments.error && <ErrorState message={installments.error} onRetry={installments.reload} />}
            {!installments.loading && !installments.error && instRows.length === 0 && (
              <EmptyState icon={<CreditCard size={18} />} title="No installment plan"
                          hint="This order is set up for payment in full." />
            )}
            {instRows.length > 0 && (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr><th style={{ width: 40 }}>#</th><th>Amount</th><th>Due</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {instRows.map((it, i) => (
                      <tr key={it.id ?? i}>
                        <td className="text-dim">{it.installmentNumber ?? i + 1}</td>
                        {/* finalAmount is the backend's field — `amount` is
                            always undefined here and rendered as an em dash. */}
                        <td style={{ fontWeight: 600 }}>
                          {it.finalAmount != null ? formatCurrency(it.finalAmount) : '—'}
                        </td>
                        <td className="t-sm text-dim">
                          {it.dueDateTime ?? it.dueDate
                            ? formatDate((it.dueDateTime ?? it.dueDate) as never)
                            : '—'}
                        </td>
                        <td><StatusBadge status={isInstallmentPaid(it) ? 'PAID' : (it.status ?? null)} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ── Instructions ── */}
          <section className="card">
            <div className="card-head"><h2 className="t-h3">Instructions</h2></div>
            <div className="od-instructions">
              {d.instructions || (typeof d.description === 'string' ? d.description : '') || (
                <span className="text-faint" style={{ fontStyle: 'italic' }}>No instructions provided.</span>
              )}
            </div>
          </section>
        </div>

        {/* ══ RIGHT: the controls ══ */}
        <div className="od-rail">
          {/* ── Action Center ── */}
          <section className="card">
            <div className="card-head"><h2 className="t-h3">Actions</h2></div>
            <div className="od-acts">
              <div className="od-act-group">
                <div className="od-act-title">Record</div>
                <div className="od-act-row single">
                  <button className="od-act primary" onClick={() => onEditOrder(d)}>
                    <PencilLine size={13} /> Edit order details
                  </button>
                </div>
              </div>

              <div className="od-act-group">
                <div className="od-act-title">Workflow</div>
                <div className="od-act-row">
                  {assigned ? (
                    <>
                      <button className="od-act" onClick={() => onAssign(order, true)}>
                        <RotateCcw size={13} /> Reassign
                      </button>
                      <button className="od-act" disabled={busy} onClick={() => onUnassign(order)}>
                        <UserMinus size={13} /> Unassign
                      </button>
                    </>
                  ) : (
                    <button className="od-act" style={{ gridColumn: '1 / -1' }}
                            onClick={() => onAssign(order, false)}>
                      <Send size={13} /> Assign expert
                    </button>
                  )}
                </div>
                {status !== 'COMPLETED' && !cancelled && (
                  <div className="od-act-row single">
                    <button className="od-act" disabled={busy} onClick={() => onComplete(order)}>
                      <CheckCircle2 size={13} /> Mark completed
                    </button>
                  </div>
                )}
              </div>

              <div className="od-act-group">
                <div className="od-act-title">Financial</div>
                <div className="od-act-row">
                  <button className="od-act" onClick={() => onSetPrice(order)}>
                    <DollarSign size={13} /> Set price
                  </button>
                  <button className="od-act" onClick={() => onPayLink(order)}>
                    <Link2 size={13} /> Pay link
                  </button>
                </div>
              </div>

              <div className="od-act-group">
                <div className="od-act-title">Schedule &amp; content</div>
                <div className="od-act-row">
                  <button className="od-act" onClick={() => onEditDeadlines(order)}>
                    <CalendarClock size={13} /> Deadlines
                  </button>
                  <button className="od-act" onClick={() => onOpenFiles(order)}>
                    <FolderOpen size={13} /> Files
                  </button>
                </div>
              </div>

              <div className="od-act-group">
                <div className="od-act-title">Communication</div>
                <div className="od-act-row single">
                  <button className="od-act" onClick={() => onOpenChat(order)}>
                    <MessagesSquare size={13} /> Open chat with student
                  </button>
                </div>
              </div>

              {isSuperAdmin && (
                <div className="od-act-group od-danger-zone">
                  <div className="od-act-title" style={{ color: 'var(--danger)' }}>Danger zone</div>
                  <div className="od-act-row single">
                    <button className="od-act danger" onClick={() => onDelete(order)}>
                      <Trash2 size={13} /> Delete order
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* ── Deadlines ── */}
          <section className="card">
            <div className="card-head"><h2 className="t-h3">Deadlines</h2></div>
            <div style={{ padding: 'var(--s5)', display: 'grid', gap: 'var(--s4)' }}>
              <div>
                <div className="od-field-lbl" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <GraduationCap size={11} /> Student deadline
                </div>
                <div className="t-sm" style={{ marginBottom: 6 }}>{formatDateTime(d.deadline)}</div>
                <DeadlineMeter deadline={d.deadline} />
              </div>
              {d.expertDeadline ? (
                <div>
                  <div className="od-field-lbl" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Clock size={11} /> Expert deadline
                  </div>
                  <div className="t-sm" style={{ marginBottom: 6 }}>{formatDateTime(d.expertDeadline)}</div>
                  <DeadlineMeter deadline={d.expertDeadline} />
                </div>
              ) : (
                <div className="t-sm text-faint" style={{ fontStyle: 'italic' }}>
                  No expert deadline set.
                </div>
              )}
            </div>
          </section>

          {/* ── Student ── */}
          <section className="card">
            <div className="card-head"><h2 className="t-h3">Student</h2></div>
            <div className="od-person">
              <span className="avatar avatar-lg" aria-hidden>
                {(d.studentName ?? d.studentEmail ?? '?').charAt(0).toUpperCase()}
              </span>
              <span style={{ minWidth: 0 }}>
                <span className="t-h3 truncate" style={{ display: 'block' }}>
                  {d.studentName ?? 'Unknown student'}
                </span>
                <span className="t-xs text-dim">{d.studentId ? fmtStudentId(d.studentId) : '—'}</span>
              </span>
            </div>
            <div className="od-fields" style={{ gridTemplateColumns: '1fr', paddingTop: 0 }}>
              <Field label="Email" value={d.studentEmail} />
              <Field label="Phone" value={d.studentPhone} />
            </div>
          </section>

          {/* ── Expert ── */}
          <section className="card">
            <div className="card-head"><h2 className="t-h3">Assigned expert</h2></div>
            {assigned && d.assignedEmployeeName ? (
              <>
                <div className="od-person">
                  <span className="avatar avatar-lg" aria-hidden>
                    {d.assignedEmployeeName.charAt(0).toUpperCase()}
                  </span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span className="t-h3 truncate" style={{ display: 'block' }}>{d.assignedEmployeeName}</span>
                    <span className="t-xs text-dim truncate" style={{ display: 'block' }}>
                      {d.assignedEmployeeEmail ?? ''}
                    </span>
                  </span>
                  <Badge tone="accent">{d.assignedEmployeeRole ?? 'EXPERT'}</Badge>
                </div>
                {d.expertDeadline && (
                  <div style={{ padding: '0 var(--s5) var(--s5)' }}>
                    <div className="t-xs text-dim">
                      Due {deadlineState(d.expertDeadline).label}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <EmptyState
                icon={<Users2 size={18} />}
                title="No expert assigned"
                hint="Assign an expert to start work on this order."
                action={<Button size="sm" variant="primary" onClick={() => onAssign(order, false)}>Assign expert</Button>}
              />
            )}
          </section>

          {/* ── Files shortcut ── */}
          <section className="card">
            <div className="card-head"><h2 className="t-h3">Files</h2></div>
            <div style={{ padding: 'var(--s5)' }}>
              <Button size="sm" style={{ width: '100%' }} onClick={() => onOpenFiles(order)}>
                <FileText size={13} /> Open file gallery
              </Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
