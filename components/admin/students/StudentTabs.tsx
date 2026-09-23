'use client';

import { useEffect, useState } from 'react';
import {
  Eye, FolderOpen, MessagesSquare, Receipt, Inbox, FileText, Wallet, Link2, Download,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StatusBadge, Badge } from '@/components/ui/Badge';
import { DeadlineMeter } from '@/components/ui/DeadlineMeter';
import { Skeleton, EmptyState, ErrorState } from '@/components/ui/States';
import { useAsync } from '@/hooks/useAsync';
import { useToast } from '@/hooks/useToast';
import { filesApi } from '@/lib/api/files';
import { studentsApi, PAYMENT_ORDER_SCAN_LIMIT } from '@/lib/api/students';
import { downloadFileById, getPreviewUrl } from '@/lib/utils/download';
import {
  fmtOrderId, formatCurrency, formatDate, formatBytes, extensionOf, enumValue,
} from '@/lib/utils/format';
import type { OrderDTO, StudentProfile, StudentPayment } from '@/types';

type Tab = 'orders' | 'payments' | 'files' | 'actions';

interface Props {
  student: StudentProfile;
  orders: OrderDTO[];
  busy: boolean;
  onOpenOrder: (id: number, subject?: string) => void;
  onOpenFiles: (order: OrderDTO) => void;
  onOpenChat: (order: OrderDTO) => void;
  onPayLink: (order: OrderDTO) => void;
  onAdjustWallet: (amount: number, reason: string) => Promise<void>;
}

export function StudentTabs({
  student, orders, busy, onOpenOrder, onOpenFiles, onOpenChat, onPayLink, onAdjustWallet,
}: Props) {
  const [tab, setTab] = useState<Tab>('orders');

  const payments = useAsync<StudentPayment[]>(
    (signal) => studentsApi.payments(orders, signal),
    [orders]
  );

  const [fileOrderId, setFileOrderId] = useState<number | null>(null);
  const files = useAsync(
    (signal) =>
      fileOrderId == null
        ? Promise.resolve(null)
        : filesApi.listForOrder(fileOrderId, 0, 50, signal),
    [fileOrderId]
  );

  const payRows = payments.data ?? [];
  const totalPaid = payRows.filter((p) => enumValue(p.status) === 'SUCCESS')
    .reduce((s, p) => s + (p.amount ?? 0), 0);
  const totalPending = payRows.filter((p) => enumValue(p.status) === 'PENDING')
    .reduce((s, p) => s + (p.amount ?? 0), 0);

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: 'orders', label: 'Orders', count: orders.length },
    { key: 'payments', label: 'Payments', count: payments.loading ? undefined : payRows.length },
    { key: 'files', label: 'Files' },
    { key: 'actions', label: 'Actions' },
  ];

  return (
    <>
      <div className="stu-tabs" role="tablist" aria-label="Student sections">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`stu-tab${tab === t.key ? ' on' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.count != null && <span className="stu-tab-count">{t.count}</span>}
          </button>
        ))}
      </div>

      {/* ── Orders ── */}
      {tab === 'orders' && (
        <section className="card" role="tabpanel">
          {orders.length === 0 ? (
            <EmptyState icon={<Inbox size={18} />} title="No orders"
                        hint="This student has not placed any orders yet." />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Order</th><th>Subject</th><th>Status</th>
                    <th style={{ textAlign: 'right' }}>Price</th>
                    <th>Payment</th><th>Deadline</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <button type="button" className="ord-id"
                                onClick={() => onOpenOrder(o.id, o.subject ?? '')}>
                          {fmtOrderId(o.id)}
                        </button>
                      </td>
                      <td>
                        <div className="truncate" style={{ maxWidth: 200 }} title={o.subject ?? ''}>
                          {o.subject || <span className="text-faint">Untitled</span>}
                        </div>
                      </td>
                      <td><StatusBadge status={o.status} /></td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        {o.price != null ? formatCurrency(o.price) : <span className="text-faint">—</span>}
                      </td>
                      <td>
                        {o.paymentStatus
                          ? <StatusBadge status={o.paymentStatus} />
                          : <span className="text-faint">—</span>}
                      </td>
                      <td><DeadlineMeter deadline={o.deadline} /></td>
                      <td>
                        <div className="acts">
                          <button className="act" onClick={() => onOpenOrder(o.id, o.subject ?? '')}>
                            <Eye size={12} /> View
                          </button>
                          <button className="act act-icon tip" data-tip="Files"
                                  aria-label={`Files for ${fmtOrderId(o.id)}`}
                                  onClick={() => onOpenFiles(o)}>
                            <FolderOpen size={13} />
                          </button>
                          <button className="act act-icon tip" data-tip="Chat"
                                  aria-label={`Chat for ${fmtOrderId(o.id)}`}
                                  onClick={() => onOpenChat(o)}>
                            <MessagesSquare size={13} />
                          </button>
                          <button className="act act-icon tip" data-tip="Payment link"
                                  aria-label={`Payment link for ${fmtOrderId(o.id)}`}
                                  onClick={() => onPayLink(o)}>
                            <Link2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ── Payments ── */}
      {tab === 'payments' && (
        <section className="card" role="tabpanel">
          <div className="card-head">
            <h3 className="t-h3">Payment history</h3>
            {orders.length > PAYMENT_ORDER_SCAN_LIMIT && (
              <span className="t-xs text-dim">
                Covering the {PAYMENT_ORDER_SCAN_LIMIT} most recent orders
              </span>
            )}
          </div>

          {payments.loading && <div style={{ padding: 'var(--s5)' }}><Skeleton h={80} /></div>}
          {payments.error && <ErrorState message={payments.error} onRetry={payments.reload} />}

          {!payments.loading && !payments.error && payRows.length === 0 && (
            <EmptyState icon={<Receipt size={18} />} title="No payments recorded"
                        hint="Transactions against this student's orders will appear here." />
          )}

          {payRows.length > 0 && (
            <>
              <div className="stu-pay-sum">
                <div className="stu-pay-cell">
                  <div className="stu-pay-val" style={{ color: 'var(--success)' }}>{formatCurrency(totalPaid)}</div>
                  <div className="stu-pay-lbl">Total paid</div>
                </div>
                <div className="stu-pay-cell">
                  <div className="stu-pay-val" style={{ color: 'var(--warning)' }}>{formatCurrency(totalPending)}</div>
                  <div className="stu-pay-lbl">Pending</div>
                </div>
                <div className="stu-pay-cell">
                  <div className="stu-pay-val">{payRows.length}</div>
                  <div className="stu-pay-lbl">Transactions</div>
                </div>
              </div>

              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Order</th><th>Type</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                      <th>Status</th><th>Date</th><th>Reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payRows.map((p, i) => (
                      <tr key={`${p.id ?? 'p'}-${i}`}>
                        <td className="ord-id">{p.orderId ? fmtOrderId(p.orderId) : '—'}</td>
                        <td className="t-sm">
                          {p.typeLabel ?? p.method ?? 'Payment'}
                          {p.isInstallment && <Badge tone="info">Installment</Badge>}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {formatCurrency(p.amount ?? 0)}
                        </td>
                        <td><StatusBadge status={p.statusLabel ?? p.status} /></td>
                        <td className="t-sm text-dim">{p.createdAt ? formatDate(p.createdAt) : '—'}</td>
                        <td className="t-xs text-faint truncate" style={{ maxWidth: 140 }}
                            title={p.paymentIntentId ?? ''}>
                          {p.paymentIntentId ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}

      {/* ── Files ── */}
      {tab === 'files' && (
        <section className="card" role="tabpanel">
          <div className="card-head">
            <h3 className="t-h3">Files</h3>
            {/* Files are stored per order, not per student, so an order must be
                picked — the same constraint the source works under. */}
            <select
              className="input" style={{ width: 260 }}
              value={fileOrderId ?? ''}
              onChange={(e) => setFileOrderId(e.target.value ? Number(e.target.value) : null)}
              aria-label="Choose an order to view its files"
            >
              <option value="">Select an order…</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {fmtOrderId(o.id)} — {(o.subject ?? 'Untitled').slice(0, 34)}
                </option>
              ))}
            </select>
          </div>

          {fileOrderId == null && (
            <EmptyState icon={<FileText size={18} />} title="Choose an order"
                        hint="Files are attached to individual orders. Pick one above to see what was uploaded." />
          )}
          {files.loading && <div style={{ padding: 'var(--s5)' }}><Skeleton h={80} /></div>}
          {files.error && <ErrorState message={files.error} onRetry={files.reload} />}
          {fileOrderId != null && !files.loading && !files.error && (files.data?.content?.length ?? 0) === 0 && (
            <EmptyState icon={<FolderOpen size={18} />} title="No files on this order" />
          )}

          {(files.data?.content?.length ?? 0) > 0 && (
            <div className="files-grid" style={{ padding: 'var(--s5)' }}>
              {files.data?.content.map((f) => {
                const name = f.fileName ?? f.name ?? `File ${f.id}`;
                return <FileCard key={f.id} id={f.id} name={name} size={f.size ?? null} uploadedAt={f.uploadedAt ?? null} />;
              })}
            </div>
          )}
        </section>
      )}

      {/* ── Actions ── */}
      {tab === 'actions' && (
        <div className="stu-actions" role="tabpanel">
          <WalletPanel student={student} busy={busy} onAdjust={onAdjustWallet} />

          <section className="card">
            <div className="card-head"><h3 className="t-h3">Payment link</h3></div>
            <div style={{ padding: 'var(--s5)' }}>
              <p className="t-sm text-dim" style={{ marginBottom: 'var(--s3)' }}>
                Generate a checkout link for one of this student&rsquo;s orders.
              </p>
              <select
                className="input"
                defaultValue=""
                onChange={(e) => {
                  const o = orders.find((x) => x.id === Number(e.target.value));
                  if (o) onPayLink(o);
                  e.target.value = '';
                }}
                aria-label="Choose an order to generate a payment link"
              >
                <option value="">Select an order…</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {fmtOrderId(o.id)} — {(o.subject ?? 'Untitled').slice(0, 30)}
                    {o.price != null ? ` (${formatCurrency(o.price)})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

/** Download/preview resolve short-lived pre-signed URLs at click time. */
function FileCard({
  id, name, size, uploadedAt,
}: { id: number; name: string; size: number | null; uploadedAt: string | null }) {
  const { showToast } = useToast();
  return (
    <div className="file-card">
      <div className="fc-icon"><FileText size={18} /></div>
      <div className="fc-name" title={name}>{name}</div>
      <div className="fc-meta">
        {formatBytes(size)}{uploadedAt ? ` · ${formatDate(uploadedAt)}` : ''}
      </div>
      <div className="fc-actions">
        <button className="fc-btn" onClick={async () => {
          try { window.open(await getPreviewUrl(id), '_blank', 'noopener'); }
          catch (e) { showToast((e as Error).message, 'error'); }
        }}>
          Preview
        </button>
        <button className="fc-btn" onClick={async () => {
          try { await downloadFileById(id, name); }
          catch (e) { showToast((e as Error).message, 'error'); }
        }}>
          <Download size={11} /> Get
        </button>
      </div>
      <span className="visually-hidden">{extensionOf(name)}</span>
    </div>
  );
}

function WalletPanel({
  student, busy, onAdjust,
}: { student: StudentProfile; busy: boolean; onAdjust: (a: number, r: string) => Promise<void> }) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { setAmount(''); setReason(''); setError(''); }, [student.id]);

  const submit = async () => {
    const a = parseFloat(amount);
    if (Number.isNaN(a) || a === 0) { setError('Enter a non-zero amount.'); return; }
    if (!reason.trim()) { setError('Enter a reason — it is stored with the adjustment.'); return; }
    setError('');
    await onAdjust(a, reason.trim());
    setAmount(''); setReason('');
  };

  return (
    <section className="card">
      <div className="card-head">
        <h3 className="t-h3">Wallet</h3>
        <span className="t-sm" style={{ fontWeight: 600 }}>{formatCurrency(student.walletBalance)}</span>
      </div>
      <div style={{ padding: 'var(--s5)' }}>
        {error && <div className="alert error" role="alert">{error}</div>}
        <p className="t-sm text-dim" style={{ marginBottom: 'var(--s3)' }}>
          Use a negative amount to deduct. The reason is recorded against the adjustment.
        </p>
        <div className="fl">
          <label htmlFor="wallet-amt">Amount</label>
          <input id="wallet-amt" type="number" step="0.01" className="fi" value={amount}
                 onChange={(e) => setAmount(e.target.value)} placeholder="0.00" disabled={busy || student.id == null} />
        </div>
        <div className="fl">
          <label htmlFor="wallet-why">Reason</label>
          <input id="wallet-why" className="fi" value={reason}
                 onChange={(e) => setReason(e.target.value)} placeholder="Refund for OD-1234" disabled={busy || student.id == null} />
        </div>
        <Button variant="primary" size="sm" loading={busy} disabled={student.id == null}
                onClick={submit} style={{ width: '100%' }}>
          <Wallet size={13} /> Apply adjustment
        </Button>
        {student.id == null && (
          <p className="t-xs text-faint" style={{ marginTop: 'var(--s2)' }}>
            Wallet actions need a resolved student ID, which this record does not have.
          </p>
        )}
      </div>
    </section>
  );
}
