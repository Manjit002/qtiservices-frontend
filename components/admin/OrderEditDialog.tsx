'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Info, Save } from 'lucide-react';
import { Modal } from '@/components/shared/Modal';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/Button';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { useToast } from '@/hooks/useToast';
import { ordersApi } from '@/lib/api/orders';
import { buildUpdatePayload, describeChanges, checkPrice } from '@/lib/utils/orderEdit';
import { enumValue, fmtOrderId, parseServerDate, toLocalInputValue } from '@/lib/utils/format';
import {
  ACADEMIC_LEVELS, ASSIGNMENT_TYPES, EDITABLE_ORDER_STATUSES,
  type OrderDetailDTO, type OrderEditFields,
} from '@/types';
import './order-edit.css';

interface Props {
  order: OrderDetailDTO | null;
  onClose: () => void;
  onSaved: () => void;
}

const EMPTY: OrderEditFields = {
  subject: '', assignmentType: '', academicLevel: '', university: '',
  deadline: '', totalPrice: '', instructions: '', status: '',
};

/**
 * A select that always keeps the order's CURRENT value selectable, even when it
 * is not one of our standard options — orders created elsewhere carry types
 * like "Full Online Class". Without this the dialog would silently rewrite the
 * field to the first option on open.
 */
function PreservingSelect({
  id, label, value, options, onChange, disabled, allowEmpty = true,
}: {
  id: string; label: string; value: string;
  options: readonly string[]; onChange: (v: string) => void; disabled?: boolean;
  /** False for enum-backed fields, where "" is not a valid server value. */
  allowEmpty?: boolean;
}) {
  const list = useMemo(() => {
    const all = [...options];
    if (value && !all.includes(value)) all.unshift(value);
    return all;
  }, [options, value]);

  return (
    <div className="fl">
      <label htmlFor={id}>{label}</label>
      <select id={id} className="fi" value={value} disabled={disabled}
              onChange={(e) => onChange(e.target.value)}>
        {allowEmpty && <option value="">— None —</option>}
        {list.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

export function OrderEditDialog({ order, onClose, onSaved }: Props) {
  const { showToast } = useToast();
  const [fields, setFields] = useState<OrderEditFields>(EMPTY);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  /** Snapshot taken when the dialog opened — the basis for the diff. */
  const original = useRef<OrderEditFields>(EMPTY);

  const paidAmount = order?.paidAmount ?? 0;

  useEffect(() => {
    if (!order) return;
    const d = parseServerDate(order.deadline);
    /**
     * Prefill from `totalPrice` — that is the field UpdateOrderRequestDTO
     * writes. Showing finalPrice here would mean the admin reads one number
     * and edits a different one: leave it untouched and the DB keeps a value
     * that was never on screen; touch it and they overwrite totalPrice with a
     * figure they believed was already stored.
     */
    const price = order.totalPrice ?? order.finalPrice ?? order.price;
    const snapshot: OrderEditFields = {
      subject: order.subject ?? '',
      assignmentType: (order.assignmentType ?? order.type ?? '') as string,
      academicLevel: order.academicLevel ?? '',
      university: order.university ?? '',
      deadline: d ? toLocalInputValue(d) : '',
      totalPrice: price != null ? String(price) : '',
      instructions: order.instructions ?? '',
      status: enumValue(order.status),
    };
    original.current = snapshot;
    setFields(snapshot);
    setError('');
  }, [order]);

  const set = useCallback(<K extends keyof OrderEditFields>(k: K, v: OrderEditFields[K]) => {
    setFields((f) => ({ ...f, [k]: v }));
    setError('');
  }, []);

  const payload = useMemo(
    () => buildUpdatePayload(original.current, fields),
    [fields]
  );
  const dirty = Object.keys(payload).length > 0;
  const priceIssue = useMemo(
    () => checkPrice(fields.totalPrice, paidAmount, original.current.totalPrice),
    [fields.totalPrice, paidAmount]
  );

  const requestClose = useCallback(() => {
    if (dirty) setConfirmDiscard(true);
    else onClose();
  }, [dirty, onClose]);

  const save = useCallback(async () => {
    if (!order) return;
    setConfirmSave(false);
    setSaving(true);
    setError('');
    try {
      await ordersApi.update(order.id, payload);
      showToast(`${fmtOrderId(order.id)} updated.`, 'success');
      onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }, [order, payload, showToast, onSaved, onClose]);

  const attemptSave = useCallback(() => {
    if (!dirty) { setError('Nothing has changed.'); return; }
    if (priceIssue?.level === 'error') { setError(priceIssue.message); return; }
    setConfirmSave(true);
  }, [dirty, priceIssue]);

  const statusChanged = payload.status !== undefined;

  return (
    <>
      <Modal
        isOpen={order != null}
        onClose={requestClose}
        maxWidth="720px"
        closeOnOverlay={false}
        labelledBy="edit-order-title"
        title={
          <span className="oe-title">
            <span id="edit-order-title">Edit order</span>
            <span className="oe-title-sub">
              {fmtOrderId(order?.id ?? null)}
              {order?.subject ? ` · ${order.subject}` : ''}
            </span>
          </span>
        }
        footer={
          <>
            <span className="oe-foot-state">
              {dirty
                ? `${Object.keys(payload).length} field${Object.keys(payload).length > 1 ? 's' : ''} changed`
                : 'No changes'}
            </span>
            <Button variant="ghost" onClick={requestClose} disabled={saving}>Cancel</Button>
            <Button variant="primary" onClick={attemptSave} loading={saving}
                    disabled={!dirty || priceIssue?.level === 'error'}>
              <Save size={14} /> {saving ? 'Saving changes' : 'Save changes'}
            </Button>
          </>
        }
      >
        <div className="oe-meta">
          <span className="t-xs text-dim">Current status</span>
          <StatusBadge status={enumValue(order?.status)} />
          {paidAmount > 0 && (
            <Badge tone="warning">Already paid ${paidAmount.toFixed(2)}</Badge>
          )}
        </div>

        {error && (
          <div className="alert error" role="alert">
            <AlertTriangle size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
            {error}
          </div>
        )}

        <div className="oe-section">
          <h3 className="oe-section-title">Order information</h3>
          <div className="oe-grid">
            <div className="fl" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="oe-subject">Subject</label>
              <input id="oe-subject" className="fi" value={fields.subject} disabled={saving}
                     onChange={(e) => set('subject', e.target.value)} autoFocus />
            </div>

            <PreservingSelect id="oe-type" label="Assignment type" value={fields.assignmentType}
                              options={ASSIGNMENT_TYPES} disabled={saving}
                              onChange={(v) => set('assignmentType', v)} />

            <PreservingSelect id="oe-level" label="Academic level" value={fields.academicLevel}
                              options={ACADEMIC_LEVELS} disabled={saving}
                              onChange={(v) => set('academicLevel', v)} />

            <div className="fl">
              <label htmlFor="oe-uni">University</label>
              <input id="oe-uni" className="fi" value={fields.university} disabled={saving}
                     onChange={(e) => set('university', e.target.value)} placeholder="— None —" />
            </div>

            <div className="fl">
              <label htmlFor="oe-deadline">Student deadline</label>
              <input id="oe-deadline" type="datetime-local" className="fi" value={fields.deadline}
                     disabled={saving} onChange={(e) => set('deadline', e.target.value)} />
              {original.current.deadline && !fields.deadline && (
                <span className="t-xs text-faint">
                  Clearing this won&rsquo;t remove the deadline — the server reads an empty value as
                  &ldquo;unchanged&rdquo;.
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="oe-section">
          <h3 className="oe-section-title">Pricing</h3>
          <div className="oe-grid">
            <div className="fl">
              <label htmlFor="oe-price">
                Total price
                {paidAmount > 0 && (
                  <span className="text-faint"> · min ${paidAmount.toFixed(2)}</span>
                )}
              </label>
              <input id="oe-price" type="number" step="0.01" min="0" className="fi"
                     value={fields.totalPrice} disabled={saving}
                     onChange={(e) => set('totalPrice', e.target.value)} placeholder="0.00" />
            </div>
          </div>

          {priceIssue && (
            <div className="alert error" style={{ marginTop: 'var(--s3)' }} role="alert">
              <AlertTriangle size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
              {priceIssue.message}
            </div>
          )}

          {/* Backend behaviour, stated because it is not obvious and not reversible. */}
          <div className="oe-note">
            <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              Updating <strong>total price</strong> also syncs the final price, recalculates the
              balance and flips the payment status. It does <em>not</em> redistribute unpaid
              installments — use Installments → Recreate plan for that.
            </span>
          </div>
        </div>

        <div className="oe-section">
          <h3 className="oe-section-title">Instructions</h3>
          <div className="fl">
            <label htmlFor="oe-instructions" className="visually-hidden">Instructions</label>
            <textarea id="oe-instructions" className="fi oe-textarea" rows={5}
                      value={fields.instructions} disabled={saving}
                      placeholder="— None —"
                      onChange={(e) => set('instructions', e.target.value)} />
          </div>
        </div>

        <div className="oe-section">
          <h3 className="oe-section-title">Workflow status</h3>
          {/* No empty option: `status` maps to a Java enum, and "" is not a
              valid constant — Jackson throws InvalidFormatException and the
              entire request 400s, losing every other field the admin edited.
              An order always has a status, so there is nothing to represent. */}
          <PreservingSelect id="oe-status" label="Status" value={fields.status}
                            options={EDITABLE_ORDER_STATUSES} disabled={saving}
                            allowEmpty={false}
                            onChange={(v) => set('status', v)} />
          {/* Editing other fields never moves the status: it is only sent when
              this control is changed, so nothing here can mutate it by accident. */}
          <div className={`oe-note${statusChanged ? ' warn' : ''}`}>
            <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              {statusChanged
                ? `This will move the order from ${original.current.status.replace(/_/g, ' ').toLowerCase() || 'its current status'} to ${fields.status.replace(/_/g, ' ').toLowerCase()}. Change it back to leave the workflow untouched.`
                : 'Status is only sent when you change it here. Editing any other field leaves the workflow status exactly as it is.'}
            </span>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={confirmSave}
        title="Save changes"
        message={`Update ${describeChanges(payload)} for ${fmtOrderId(order?.id ?? null)}?`}
        confirmLabel="Save changes"
        busy={saving}
        onConfirm={save}
        onCancel={() => setConfirmSave(false)}
      />

      <ConfirmDialog
        isOpen={confirmDiscard}
        title="Discard changes?"
        message="You have unsaved changes. Closing now will lose them."
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        danger
        onConfirm={() => { setConfirmDiscard(false); onClose(); }}
        onCancel={() => setConfirmDiscard(false)}
      />
    </>
  );
}
