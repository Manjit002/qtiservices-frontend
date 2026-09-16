'use client';

import { StatusBadge } from '@/components/shared/StatusBadge';
import { deadlineColor, deadlineLabel, urgencyRowClass } from '@/lib/utils/deadline';
import { fmtOrderId, formatCurrency } from '@/lib/utils/format';
import type { OrderDTO } from '@/types';

export type SortCol = 'id' | 'subject' | 'deadline' | 'status' | null;

interface ExpertOrdersTableProps {
  orders: OrderDTO[];
  sortCol: SortCol;
  sortDir: 'asc' | 'desc';
  onSort: (col: Exclude<SortCol, null>) => void;
  onOpenDetail: (id: number) => void;
  onStartWork: (id: number) => void;
  onSubmitWork: (order: OrderDTO) => void;
  onOpenFiles: (id: number) => void;
  busyOrderId: number | null;
}

/** The expert's order list. `deadline` here is the EXPERT deadline. */
export function ExpertOrdersTable({
  orders, sortCol, sortDir, onSort, onOpenDetail, onStartWork, onSubmitWork, onOpenFiles, busyOrderId,
}: ExpertOrdersTableProps) {
  const thClass = (col: Exclude<SortCol, null>) =>
    `sortable ${sortCol === col ? (sortDir === 'asc' ? 'sort-asc' : 'sort-desc') : ''}`;

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th className={thClass('id')} onClick={() => onSort('id')} scope="col">Order</th>
            <th className={thClass('subject')} onClick={() => onSort('subject')} scope="col">Subject</th>
            <th className={thClass('deadline')} onClick={() => onSort('deadline')} scope="col">Your Deadline</th>
            <th className={thClass('status')} onClick={() => onSort('status')} scope="col">Status</th>
            <th scope="col">Price</th>
            <th scope="col">Files</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => {
            const status = String(o.status ?? '');
            const busy = busyOrderId === o.id;
            return (
              <tr key={o.id} className={urgencyRowClass(o.deadline)}>
                <td>
                  <button
                    type="button"
                    className="td-id"
                    onClick={() => onOpenDetail(o.id)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                      textDecoration: 'underline', textUnderlineOffset: 3,
                      textDecorationColor: 'rgba(139,92,246,.35)',
                    }}
                    title="View full details"
                  >
                    {fmtOrderId(o.id)}
                  </button>
                </td>
                <td style={{ fontWeight: 600, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {o.subject || '—'}
                </td>
                <td style={{ fontSize: '.76rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                  <span style={{ color: deadlineColor(o.deadline) }}>{deadlineLabel(o.deadline)}</span>
                </td>
                <td><StatusBadge status={o.status} /></td>
                <td className="font-display" style={{ fontSize: '1rem', color: 'var(--green)' }}>
                  {o.price != null ? formatCurrency(o.price) : <span style={{ color: 'var(--muted)' }}>—</span>}
                </td>
                <td>
                  <button type="button" className="btn-primary" onClick={() => onOpenFiles(o.id)}>
                    📁 Files
                  </button>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'nowrap' }}>
                    {(status === 'ASSIGNED' || status === 'REASSIGNED') && (
                      <button type="button" className="btn-start" onClick={() => onStartWork(o.id)} disabled={busy}>
                        {busy ? '…' : '▶️ Start'}
                      </button>
                    )}
                    {status === 'IN_PROGRESS' && (
                      <button type="button" className="btn-submit-work" onClick={() => onSubmitWork(o)}>
                        🚀 Submit
                      </button>
                    )}
                    <button type="button" className="btn-primary" onClick={() => onOpenDetail(o.id)}>
                      👁 View
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
