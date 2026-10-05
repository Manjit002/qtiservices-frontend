'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Send, RotateCcw, CalendarClock } from 'lucide-react';
import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { useToast } from '@/hooks/useToast';
import { useAsync } from '@/hooks/useAsync';
import { expertsApi } from '@/lib/api/experts';
import { ordersApi } from '@/lib/api/orders';
import { ExpertSelector } from './ExpertSelector';
import {
  fmtOrderId, fmtStudentId, formatCurrency, formatDateTime,
  parseServerDate, toLocalInputValue, withSeconds,
} from '@/lib/utils/format';
import { deadlineState } from '@/components/ui/DeadlineMeter';
import type { OrderDTO } from '@/types';
import './assign.css';

/** The backend requires the expert deadline at least 12h before the student's. */
const BUFFER_HOURS = 12;

interface Props {
  order: OrderDTO | null;
  isReassign: boolean;
  /** Real workload counts keyed by expert name, derived by the caller. */
  workload?: Map<string, number>;
  workloadNote?: string;
  onClose: () => void;
  onAssigned: () => void;
}

export function AssignOrderDialog({
  order, isReassign, workload, workloadNote, onClose, onAssigned,
}: Props) {
  const { showToast } = useToast();
  const experts = useAsync(
    (s) => (order == null ? Promise.resolve([]) : expertsApi.listAvailable(s)),
    [order?.id]
  );

  const [expertId, setExpertId] = useState<number | null>(null);
  const [deadline, setDeadline] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setExpertId(null);
    setError('');
    // Default to the latest moment that still clears the buffer — the value an
    // admin almost always wants, and it can only be moved earlier.
    const student = parseServerDate(order?.deadline);
    setDeadline(
      student ? toLocalInputValue(new Date(student.getTime() - BUFFER_HOURS * 3_600_000)) : ''
    );
  }, [order]);

  const maxDeadline = useMemo(() => {
    const d = parseServerDate(order?.deadline);
    if (!d) return null;
    return toLocalInputValue(new Date(d.getTime() - BUFFER_HOURS * 3_600_000));
  }, [order]);

  const selected = useMemo(
    () => (experts.data ?? []).find((e) => e.id === expertId) ?? null,
    [experts.data, expertId]
  );

  const submit = useCallback(async () => {
    setError('');
    if (expertId == null) { setError('Choose an expert to assign this order to.'); return; }
    if (!deadline) { setError('Set a deadline for the expert.'); return; }
    if (maxDeadline && deadline > maxDeadline) {
      setError(`The expert deadline must be at least ${BUFFER_HOURS} hours before the student deadline.`);
      return;
    }
    if (!order) return;

    setBusy(true);
    // Contract unchanged: { expertId, expertDeadline } with seconds appended.
    const body = { expertId, expertDeadline: withSeconds(deadline) };
    try {
      if (isReassign) await ordersApi.reassign(order.id, body);
      else await ordersApi.assign(order.id, body);
      showToast(
        `${fmtOrderId(order.id)} ${isReassign ? 'reassigned' : 'assigned'} to ${selected?.name ?? 'the expert'}.`,
        'success'
      );
      onAssigned();
      onClose();
    } catch (e) {
      // The dialog stays open and keeps the selection so the admin can retry.
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [expertId, deadline, maxDeadline, order, isReassign, selected, showToast, onAssigned, onClose]);

  const urgency = order ? deadlineState(order.deadline) : null;

  return (
    <Modal
      isOpen={order != null}
      onClose={onClose}
      maxWidth="560px"
      closeOnOverlay={!busy}
      labelledBy="assign-dialog-title"
      title={
        <span id="assign-dialog-title">
          {isReassign ? 'Reassign order' : 'Assign order'}
        </span>
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="primary" onClick={submit} loading={busy} disabled={expertId == null}>
            {isReassign ? <RotateCcw size={14} /> : <Send size={14} />}
            {busy ? 'Assigning…' : isReassign ? 'Reassign order' : 'Assign order'}
          </Button>
        </>
      }
    >
      {/* ── The order being assigned ── */}
      <div className="as-picked">
        <span style={{ minWidth: 0, flex: 1 }}>
          <span className="as-id">{fmtOrderId(order?.id ?? null)}</span>
          <span className="t-sm truncate" style={{ display: 'block', marginTop: 1 }}>
            {order?.subject || 'Untitled order'}
          </span>
          <span className="t-xs text-dim">
            {order?.studentEmail || (order?.studentId ? fmtStudentId(order.studentId) : 'Student unknown')}
          </span>
        </span>
        <span style={{ textAlign: 'right', flexShrink: 0 }}>
          <StatusBadge status={order?.status} />
          {order?.price != null && (
            <span className="t-sm" style={{ display: 'block', fontWeight: 600, marginTop: 4 }}>
              {formatCurrency(order.price)}
            </span>
          )}
        </span>
      </div>

      {error && (
        <div className="alert error" role="alert">
          <AlertTriangle size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
          {error}
        </div>
      )}

      <div className="fl">
        <label>Select expert</label>
        <ExpertSelector
          experts={experts.data ?? []}
          loading={experts.loading}
          error={experts.error}
          onRetry={experts.reload}
          selectedId={expertId}
          onSelect={setExpertId}
          workload={workload ?? new Map()}
          workloadNote={workloadNote ?? ''}
          disabled={busy}
        />
      </div>

      <div className="fl">
        <label htmlFor="as-deadline">
          <CalendarClock size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
          Expert deadline
        </label>
        <input
          id="as-deadline"
          type="datetime-local"
          className="fi"
          value={deadline}
          max={maxDeadline ?? undefined}
          onChange={(e) => setDeadline(e.target.value)}
          disabled={busy}
        />
        {order?.deadline ? (
          <span className="t-xs text-faint">
            Student deadline is {formatDateTime(order.deadline)}
            {urgency ? ` (${urgency.label})` : ''} — the expert must finish at least{' '}
            {BUFFER_HOURS} hours before it.
          </span>
        ) : (
          <span className="t-xs text-faint">
            This order has no student deadline, so no buffer is enforced.
          </span>
        )}
      </div>
    </Modal>
  );
}
