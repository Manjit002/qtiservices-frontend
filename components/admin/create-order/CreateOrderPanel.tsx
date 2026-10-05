'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Package, CheckCircle2, AlertTriangle, Upload, X, FileText, DollarSign,
  Eye, Plus, Info,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/hooks/useToast';
import { ordersApi } from '@/lib/api/orders';
import {
  fmtOrderId, formatBytes, formatDateTime, toLocalInputValue, withSeconds,
} from '@/lib/utils/format';
import { ASSIGNMENT_TYPES, ACADEMIC_LEVELS } from '@/types';
import { StudentPicker, type StudentFields } from './StudentPicker';
import './create-order.css';
import '@/components/admin/payments/payments.css';
import '@/components/admin/orders.css';

interface Props {
  onViewOrder: (orderId: number) => void;
  onCreated: () => void;
  onSetPrice: (orderId: number) => void;
}

interface OrderFields {
  subject: string;
  assignmentType: string;
  academicLevel: string;
  university: string;
  deadline: string;
  instructions: string;
  wordCount: string;
}

const EMPTY_STUDENT: StudentFields = { studentName: '', studentEmail: '', phone: '', country: '' };
const EMPTY_ORDER: OrderFields = {
  subject: '', assignmentType: '', academicLevel: '', university: '',
  deadline: '', instructions: '', wordCount: '',
};

/** Per-file cap enforced by the source before upload. */
const MAX_FILE_BYTES = 104_857_600;

/** Deadline must be at least an hour out — the source sets this as the input min. */
function minDeadline(): string {
  return toLocalInputValue(new Date(Date.now() + 3_600_000));
}

export function CreateOrderPanel({ onViewOrder, onCreated, onSetPrice }: Props) {
  const { showToast } = useToast();

  const [student, setStudent] = useState<StudentFields>(EMPTY_STUDENT);
  const [picked, setPicked] = useState(false);
  const [order, setOrder] = useState<OrderFields>(EMPTY_ORDER);
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);

  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [created, setCreated] = useState<{ id: number; subject: string; email: string } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<(() => void) | null>(null);

  const set = <K extends keyof OrderFields>(k: K, v: OrderFields[K]) => {
    setOrder((o) => ({ ...o, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
    setFormError('');
  };

  const addFiles = useCallback(
    (list: FileList | null) => {
      if (!list) return;
      const ok: File[] = [];
      Array.from(list).forEach((f) => {
        if (f.size > MAX_FILE_BYTES) showToast(`${f.name} exceeds the 100 MB limit.`, 'error');
        else ok.push(f);
      });
      if (ok.length) setFiles((prev) => [...prev, ...ok]);
    },
    [showToast]
  );

  /** Auto-counted from instructions when left blank, as the source does. */
  const autoWordCount = useMemo(
    () => order.instructions.trim().split(/\s+/).filter(Boolean).length,
    [order.instructions]
  );

  const validate = useCallback((): boolean => {
    const next: Partial<Record<string, string>> = {};
    if (!student.studentEmail.trim()) next.studentEmail = 'Student email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(student.studentEmail.trim())) {
      next.studentEmail = 'Enter a valid email address.';
    }
    if (!order.subject.trim()) next.subject = 'Subject is required.';
    if (!order.assignmentType) next.assignmentType = 'Assignment type is required.';
    if (!order.deadline) next.deadline = 'Deadline is required.';
    else if (new Date(order.deadline).getTime() < Date.now()) {
      next.deadline = 'Deadline must be in the future.';
    }
    setErrors(next);
    if (Object.keys(next).length) {
      setFormError('Fix the highlighted fields before creating the order.');
      return false;
    }
    return true;
  }, [student.studentEmail, order]);

  const submit = useCallback(async () => {
    if (busy) return;               // duplicate-submit guard
    if (!validate()) return;

    setBusy(true);
    setFormError('');
    setProgress(0);

    /**
     * multipart/form-data — the endpoint binds @ModelAttribute, so this must be
     * FormData and NOT JSON. Field names are copied verbatim from the source.
     */
    const fd = new FormData();
    fd.append('studentName', student.studentName.trim());
    fd.append('studentEmail', student.studentEmail.trim());
    fd.append('phone', student.phone.trim());
    fd.append('country', student.country.trim());
    fd.append('subject', order.subject.trim());
    fd.append('assignmentType', order.assignmentType);
    fd.append('academicLevel', order.academicLevel);
    fd.append('university', order.university.trim());
    fd.append('instructions', order.instructions.trim());
    fd.append('instructionsWordCount', order.wordCount || String(autoWordCount));
    fd.append('deadline', withSeconds(order.deadline));
    files.forEach((f) => fd.append('files', f, f.name));

    try {
      const { promise, abort } = ordersApi.create(fd, setProgress);
      abortRef.current = abort;
      const res = (await promise) as { id?: number };
      if (res?.id == null) throw new Error('The server did not return an order ID.');

      setCreated({ id: res.id, subject: order.subject.trim(), email: student.studentEmail.trim() });
      showToast(`Order ${fmtOrderId(res.id)} created.`, 'success', 5000);
      onCreated();
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      const msg = (e as Error).message;
      setFormError(msg);
      showToast(msg, 'error');
    } finally {
      setBusy(false);
      setProgress(0);
      abortRef.current = null;
    }
  }, [busy, validate, student, order, files, autoWordCount, showToast, onCreated]);

  const reset = useCallback(() => {
    setStudent(EMPTY_STUDENT);
    setPicked(false);
    setOrder(EMPTY_ORDER);
    setFiles([]);
    setErrors({});
    setFormError('');
    setCreated(null);
  }, []);

  // ── Success ──
  if (created) {
    return (
      <div className="rise">
        <section className="card" style={{ maxWidth: 560, margin: '0 auto' }}>
          <div className="co-done">
            <div className="co-done-icon"><CheckCircle2 size={26} /></div>
            <h1 className="t-h2">Order created</h1>
            <p className="t-sm text-dim" style={{ marginTop: 4 }}>
              The backend generated this ID and the order is now in the orders list.
            </p>
            <div className="co-done-id">{fmtOrderId(created.id)}</div>

            <div style={{ marginTop: 'var(--s5)', textAlign: 'left' }}>
              <div className="co-review-row">
                <span className="co-review-lbl">Student</span>
                <span className="co-review-val truncate">{created.email}</span>
              </div>
              <div className="co-review-row">
                <span className="co-review-lbl">Subject</span>
                <span className="co-review-val truncate">{created.subject}</span>
              </div>
              <div className="co-review-row">
                <span className="co-review-lbl">Pricing</span>
                <span className="co-review-val">Not set yet</span>
              </div>
            </div>

            {/* Price is NOT part of the create payload — the order arrives
                unpriced. Offering it here uses the real set-price endpoint
                rather than pretending create accepted a price. */}
            <div className="co-newacct" style={{ margin: 'var(--s5) 0 0', textAlign: 'left' }}>
              <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                This order has no price yet — the create endpoint doesn&rsquo;t take one.
                Set it now, or leave it for the automatic pricing step.
              </span>
            </div>

            <div style={{ display: 'grid', gap: 'var(--s2)', marginTop: 'var(--s5)' }}>
              <Button variant="primary" onClick={() => onSetPrice(created.id)}>
                <DollarSign size={14} /> Set price
              </Button>
              <div style={{ display: 'flex', gap: 'var(--s2)' }}>
                <Button style={{ flex: 1 }} onClick={() => onViewOrder(created.id)}>
                  <Eye size={14} /> View order
                </Button>
                <Button style={{ flex: 1 }} onClick={reset}>
                  <Plus size={14} /> Create another
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  // ── Form ──
  const reviewRows = [
    { label: 'Student', value: student.studentEmail },
    { label: 'Subject', value: order.subject },
    { label: 'Type', value: order.assignmentType },
    { label: 'Level', value: order.academicLevel },
    { label: 'University', value: order.university },
    { label: 'Deadline', value: order.deadline ? formatDateTime(order.deadline) : '' },
    { label: 'Word count', value: order.wordCount || (autoWordCount ? `${autoWordCount} (auto)` : '') },
    { label: 'Attachments', value: files.length ? `${files.length} file${files.length > 1 ? 's' : ''}` : '' },
  ];

  return (
    <div className="rise">
      <div style={{ marginBottom: 'var(--s5)' }}>
        <h1 className="t-h1">Create order</h1>
        <p className="t-sm text-dim" style={{ marginTop: 4 }}>
          Raise an order on behalf of a student. Pricing is set after creation.
        </p>
      </div>

      <div className="co-cols">
        <div className="co-form">
          <StudentPicker
            value={student}
            onChange={(v) => { setStudent(v); setErrors((e) => ({ ...e, studentEmail: undefined })); }}
            selected={picked}
            onSelectedChange={setPicked}
            disabled={busy}
          />
          {errors.studentEmail && (
            <div className="field-error" style={{ marginTop: -12 }}>{errors.studentEmail}</div>
          )}

          <section className="card">
            <div className="card-head"><h2 className="t-h3">Order information</h2></div>
            <div className="co-grid">
              <div className="fl full">
                <label htmlFor="co-subject">Subject<span className="co-req">*</span></label>
                <input id="co-subject" className="fi" value={order.subject} disabled={busy}
                       onChange={(e) => set('subject', e.target.value)}
                       placeholder="e.g. Organic chemistry problem set"
                       aria-invalid={Boolean(errors.subject)} />
                {errors.subject && <span className="field-error">{errors.subject}</span>}
              </div>

              <div className="fl">
                <label htmlFor="co-type">Assignment type<span className="co-req">*</span></label>
                <select id="co-type" className="fi" value={order.assignmentType} disabled={busy}
                        onChange={(e) => set('assignmentType', e.target.value)}
                        aria-invalid={Boolean(errors.assignmentType)}>
                  <option value="">— Select type —</option>
                  {ASSIGNMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                {errors.assignmentType && <span className="field-error">{errors.assignmentType}</span>}
              </div>

              <div className="fl">
                <label htmlFor="co-level">Academic level</label>
                <select id="co-level" className="fi" value={order.academicLevel} disabled={busy}
                        onChange={(e) => set('academicLevel', e.target.value)}>
                  <option value="">— Select level —</option>
                  {ACADEMIC_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>

              <div className="fl">
                <label htmlFor="co-uni">University</label>
                <input id="co-uni" className="fi" value={order.university} disabled={busy}
                       onChange={(e) => set('university', e.target.value)} placeholder="Optional" />
              </div>

              <div className="fl">
                <label htmlFor="co-deadline">Student deadline<span className="co-req">*</span></label>
                <input id="co-deadline" type="datetime-local" className="fi" value={order.deadline}
                       min={minDeadline()} disabled={busy}
                       onChange={(e) => set('deadline', e.target.value)}
                       aria-invalid={Boolean(errors.deadline)} />
                {errors.deadline
                  ? <span className="field-error">{errors.deadline}</span>
                  : <span className="t-xs text-faint">At least one hour from now.</span>}
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <h2 className="t-h3">Instructions</h2>
              <span className="t-xs text-dim">
                {autoWordCount} word{autoWordCount === 1 ? '' : 's'}
              </span>
            </div>
            <div className="co-grid">
              <div className="fl full">
                <label htmlFor="co-instructions">Description / instructions</label>
                <textarea id="co-instructions" className="fi" rows={6} disabled={busy}
                          style={{ height: 'auto', padding: '10px 12px', lineHeight: 1.6 }}
                          value={order.instructions}
                          onChange={(e) => set('instructions', e.target.value)}
                          placeholder="What does the student need? Include any rubric, formatting or source requirements." />
              </div>
              <div className="fl">
                <label htmlFor="co-wc">Word count</label>
                <input id="co-wc" type="number" min="0" className="fi" value={order.wordCount}
                       disabled={busy} onChange={(e) => set('wordCount', e.target.value)}
                       placeholder={`auto — ${autoWordCount}`} />
                <span className="t-xs text-faint">Leave blank to use the counted value.</span>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-head"><h2 className="t-h3">Attachments</h2></div>
            <div className="co-files">
              <button
                type="button"
                className={`co-drop${dragging ? ' over' : ''}`}
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
                disabled={busy}
              >
                <Upload size={18} />
                <span>Drop files here, or click to browse</span>
                <span className="t-xs text-faint">Up to 100 MB per file</span>
              </button>
              <input ref={inputRef} type="file" multiple className="visually-hidden"
                     aria-label="Attach files"
                     onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />

              {files.map((f, i) => (
                <div className="co-file" key={`${f.name}-${i}`}>
                  <FileText size={14} style={{ color: 'var(--accent-text)', flexShrink: 0 }} />
                  <span className="truncate" style={{ flex: 1 }}>{f.name}</span>
                  <span className="text-dim" style={{ flexShrink: 0 }}>{formatBytes(f.size)}</span>
                  <button type="button" aria-label={`Remove ${f.name}`} disabled={busy}
                          onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}>
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* ── Review rail ── */}
        <div className="co-rail">
          <section className="card">
            <div className="card-head"><h2 className="t-h3">Review</h2></div>
            <div style={{ padding: 'var(--s5)' }}>
              {reviewRows.map((r) => (
                <div className="co-review-row" key={r.label}>
                  <span className="co-review-lbl">{r.label}</span>
                  <span className={`co-review-val truncate${r.value ? '' : ' empty'}`}>
                    {r.value || 'Not set'}
                  </span>
                </div>
              ))}

              <div className="co-newacct" style={{ margin: 'var(--s4) 0 0' }}>
                <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>
                  The create endpoint takes no price — the order is raised unpriced and you
                  set the price straight afterwards.
                </span>
              </div>

              {formError && (
                <div className="alert error" style={{ marginTop: 'var(--s4)' }} role="alert">
                  <AlertTriangle size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
                  {formError}
                </div>
              )}

              {busy && files.length > 0 && (
                <div className="upload-prog-wrap" style={{ marginTop: 'var(--s4)' }}>
                  <div className="upload-prog-bar" style={{ width: `${progress}%` }} />
                </div>
              )}

              <Button variant="primary" size="lg" loading={busy} onClick={submit}
                      style={{ width: '100%', marginTop: 'var(--s4)' }}>
                <Package size={15} /> {busy ? 'Creating order…' : 'Create order'}
              </Button>
              <Button variant="ghost" size="sm" onClick={reset} disabled={busy}
                      style={{ width: '100%', marginTop: 'var(--s2)' }}>
                Clear form
              </Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
