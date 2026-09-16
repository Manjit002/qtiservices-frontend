'use client';

import { useCallback, useEffect, useState } from 'react';
import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/hooks/useToast';
import { ordersApi } from '@/lib/api/orders';
import { fmtOrderId, parseServerDate, toLocalInputValue, withSeconds } from '@/lib/utils/format';
import type { OrderDTO } from '@/types';

interface Props {
  order: OrderDTO | null;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * The 12-hour gap is a CONVENTION here, not a rule.
 *
 * Unlike assignment, this endpoint applies no validation at all — no gap check,
 * no status gate. It is a deliberate override tool, so a short gap warns and
 * still saves. Blocking it would remove the only way to correct a deadline
 * that legitimately needs a tighter turnaround.
 */
const BUFFER_HOURS = 12;

export function EditDeadlinesModal({ order, onClose, onSaved }: Props) {
  const { showToast } = useToast();
  const [student, setStudent] = useState('');
  const [expert, setExpert] = useState('');
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const s = parseServerDate(order?.deadline);
    const e = parseServerDate((order as { expertDeadline?: unknown })?.expertDeadline as never);
    setStudent(s ? toLocalInputValue(s) : '');
    setExpert(e ? toLocalInputValue(e) : '');
    setError('');
    setWarning('');
  }, [order]);

  const submit = useCallback(async () => {
    if (!order) return;
    setError('');

    // At least one field, matching the source — sending two nulls is a no-op.
    if (!student && !expert) {
      setError('Set at least one deadline.');
      return;
    }

    // Warn on a short gap, then let a second click through. The backend does
    // not enforce it, and this dialog exists precisely to override.
    if (student && expert && !warning) {
      const gap = new Date(student).getTime() - new Date(expert).getTime();
      if (gap < BUFFER_HOURS * 3_600_000) {
        setWarning(
          `The expert deadline is not ${BUFFER_HOURS} hours before the student deadline. ` +
          'This will still save — click again to confirm it is intentional.'
        );
        return;
      }
    }

    setBusy(true);
    try {
      /**
       * `clientDeadline` is the student-facing field. Sending `deadline`
       * silently changes nothing — the server ignores the unknown key.
       * null means "leave unchanged"; an empty input is never sent as "".
       */
      await ordersApi.updateDeadlines(order.id, {
        clientDeadline: student ? withSeconds(student) : null,
        expertDeadline: expert ? withSeconds(expert) : null,
      });
      showToast(`Deadlines updated for ${fmtOrderId(order.id)}.`, 'success');
      onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [order, student, expert, warning, showToast, onSaved, onClose]);

  return (
    <Modal
      isOpen={order != null}
      onClose={onClose}
      title={<>Edit deadlines — {fmtOrderId(order?.id ?? null)}</>}
      maxWidth="440px"
      closeOnOverlay={!busy}
      labelledBy="deadlines-title"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="primary" onClick={submit} loading={busy}>
            {warning ? 'Save anyway' : 'Save deadlines'}
          </Button>
        </>
      }
    >
      {error && <div className="alert error" role="alert">{error}</div>}
      {warning && (
        <div className="alert" role="status"
             style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>
          {warning}
        </div>
      )}

      <div className="fl">
        <label htmlFor="dl-student">Student deadline</label>
        <input id="dl-student" type="datetime-local" className="fi" value={student}
               onChange={(e) => { setStudent(e.target.value); setWarning(''); }} disabled={busy} />
      </div>

      <div className="fl">
        <label htmlFor="dl-expert">Expert deadline</label>
        <input id="dl-expert" type="datetime-local" className="fi" value={expert}
               onChange={(e) => { setExpert(e.target.value); setWarning(''); }} disabled={busy} />
        <span className="t-xs text-dim">
          Conventionally {BUFFER_HOURS} hours before the student deadline. Leaving a field
          empty leaves that deadline unchanged — it does not clear it.
        </span>
      </div>
    </Modal>
  );
}
