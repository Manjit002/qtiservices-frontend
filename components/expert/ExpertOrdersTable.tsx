'use client';

import { ArrowDown, ArrowUp, ArrowUpDown, Eye, FolderOpen, Play, Send } from 'lucide-react';
import { StatusBadge } from '@/components/ui/Badge';
import { DeadlineMeter, EXPERT_CLOSED_STATUSES } from '@/components/ui/DeadlineMeter';
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

/**
 * Row actions in the shared style (`.acts` / `.act`, as on admin Orders): the
 * one action that moves the order forward is labelled and carries the accent;
 * Files and View are compact icons with tooltips and real aria-labels.
 */
function RowActions({ o, busy, onStartWork, onSubmitWork, onOpenFiles, onOpenDetail }: {
  o: OrderDTO; busy: boolean;
  onStartWork: (id: number) => void; onSubmitWork: (order: OrderDTO) => void;
  onOpenFiles: (id: number) => void; onOpenDetail: (id: number) => void;
}) {
  const status = String(o.status ?? '');
  return (
    <div className="acts">
      {(status === 'ASSIGNED' || status === 'REASSIGNED') && (
        <button type="button" className="act act-primary" onClick={() => onStartWork(o.id)} disabled={busy}>
          <Play size={12} /> {busy ? 'Starting…' : 'Start'}
        </button>
      )}
      {status === 'IN_PROGRESS' && (
        <button type="button" className="act act-primary" onClick={() => onSubmitWork(o)}>
          <Send size={12} /> Submit
        </button>
      )}
      <button
        type="button" className="act act-icon tip" data-tip="Files"
        aria-label={`Files for ${fmtOrderId(o.id)}`} title="Files"
        onClick={() => onOpenFiles(o.id)}
      >
        <FolderOpen size={13} />
      </button>
      <button
        type="button" className="act act-icon tip" data-tip="Details"
        aria-label={`Details for ${fmtOrderId(o.id)}`} title="Details"
        onClick={() => onOpenDetail(o.id)}
      >
        <Eye size={13} />
      </button>
    </div>
  );
}

/** The expert's order list. `deadline` here is the EXPERT deadline. */
export function ExpertOrdersTable({
  orders, sortCol, sortDir, onSort, onOpenDetail, onStartWork, onSubmitWork, onOpenFiles, busyOrderId,
}: ExpertOrdersTableProps) {
  const head = (col: Exclude<SortCol, null>, label: string) => {
    const on = sortCol === col;
    const Icon = !on ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown;
    return (
      <th scope="col" aria-sort={on ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
        <button type="button" className="xp-sort" onClick={() => onSort(col)}>
          {label} <Icon size={11} style={{ opacity: on ? 1 : 0.4 }} aria-hidden />
        </button>
      </th>
    );
  };
  const actionProps = { onStartWork, onSubmitWork, onOpenFiles, onOpenDetail };

  return (
    <>
      <div className="table-wrap xp-table-wrap">
        <table className="xp-table">
          <thead>
            <tr>
              {head('id', 'Order')}
              {head('deadline', 'Your deadline')}
              {head('status', 'Status')}
              <th scope="col" style={{ textAlign: 'right' }}>Price</th>
              <th scope="col" style={{ textAlign: 'right' }}><span className="visually-hidden">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td>
                  <button type="button" className="xp-order-cell" onClick={() => onOpenDetail(o.id)}>
                    <span className="xp-id">{fmtOrderId(o.id)}</span>
                    <span className="xp-subject">{o.subject || 'Untitled order'}</span>
                  </button>
                </td>
                <td style={{ width: 150 }}><DeadlineMeter deadline={o.deadline} settled={EXPERT_CLOSED_STATUSES.includes(String(o.status ?? ''))} /></td>
                <td><StatusBadge status={o.status} /></td>
                <td className="num">{o.price != null ? formatCurrency(o.price) : <span className="text-faint">—</span>}</td>
                <td><RowActions o={o} busy={busyOrderId === o.id} {...actionProps} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="xp-cards">
        {orders.map((o) => (
          <article className="xp-card" key={o.id}>
            <div className="xp-card-top">
              <button type="button" className="xp-order-cell" onClick={() => onOpenDetail(o.id)}>
                <span className="xp-id">{fmtOrderId(o.id)}</span>
                <span className="t-sm" style={{ overflowWrap: 'anywhere' }}>{o.subject || 'Untitled order'}</span>
              </button>
              <StatusBadge status={o.status} />
            </div>
            <div className="xp-card-grid">
              <div>
                <div className="t-xs text-dim" style={{ marginBottom: 4 }}>Your deadline</div>
                <DeadlineMeter deadline={o.deadline} settled={EXPERT_CLOSED_STATUSES.includes(String(o.status ?? ''))} />
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="t-xs text-dim" style={{ marginBottom: 4 }}>Price</div>
                <div className="t-sm" style={{ fontWeight: 600 }}>{o.price != null ? formatCurrency(o.price) : '—'}</div>
              </div>
            </div>
            <RowActions o={o} busy={busyOrderId === o.id} {...actionProps} />
          </article>
        ))}
      </div>
    </>
  );
}
