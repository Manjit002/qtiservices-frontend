'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, UserPen } from 'lucide-react';
import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/hooks/useToast';
import { studentsApi } from '@/lib/api/students';
import { fmtStudentId } from '@/lib/utils/format';
import {
  buildProfilePayload, describeSaveError, emailChanged, hasChanges, mergeSaved,
  toFields, validateProfile,
  type FieldErrors, type ProfileFields,
} from '@/lib/utils/studentProfile';

interface Props {
  open: boolean;
  studentId: number;
  /** The values currently shown on the card — the form opens pre-filled with these. */
  current: { name?: string | null; email?: string | null; phone?: string | null };
  onClose: () => void;
  /** Receives what the database now holds, so the card can update without a refetch. */
  onSaved: (saved: ProfileFields) => void;
}

const FORM_ID = 'edit-student-profile-form';

/**
 * Admin / Super Admin correction of a student's name, email and phone, via the
 * existing PUT /admin/students/{id}/profile. Used from the Order Detail student
 * card and the Students panel.
 *
 * Only rendered for ADMIN and SUPER_ADMIN (the caller checks the role). That is
 * a courtesy to avoid showing a button the backend would refuse — the actual
 * enforcement is the endpoint's @PreAuthorize, which this does not replace.
 */
export function EditStudentProfileDialog({ open, studentId, current, onClose, onSaved }: Props) {
  const { showToast } = useToast();

  const original = useMemo(() => toFields(current), [current]);
  const [fields, setFields] = useState<ProfileFields>(original);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  /**
   * Guards against double submission. `saving` is state, so two clicks landing
   * in the same tick both read it as false before React re-renders; a ref is
   * read synchronously and closes that window.
   */
  const inFlight = useRef(false);

  // Every open starts from the values on the card — a cancelled edit leaves nothing behind.
  useEffect(() => {
    if (!open) return;
    setFields(original);
    setErrors({});
    setFormError('');
  }, [open, original]);

  const set = (k: keyof ProfileFields, v: string) => {
    setFields((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
    setFormError('');
  };

  const dirty = hasChanges(original, fields);

  const submit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (inFlight.current) return;

      const v = validateProfile(fields);
      if (Object.keys(v).length) {
        setErrors(v);
        return;
      }
      if (!hasChanges(original, fields)) return;

      inFlight.current = true;
      setSaving(true);
      setFormError('');

      const payload = buildProfilePayload(original, fields);
      try {
        const res = await studentsApi.updateProfile(studentId, payload);
        onSaved(mergeSaved(payload, original, res));
        showToast('Student profile updated.', 'success');
        onClose();
      } catch (err) {
        const f = describeSaveError(err, emailChanged(original, fields));
        if (f.field) setErrors((x) => ({ ...x, [f.field!]: f.message }));
        else setFormError(f.message);
      } finally {
        inFlight.current = false;
        setSaving(false);
      }
    },
    [fields, original, studentId, onSaved, onClose, showToast]
  );

  // A request in flight must finish; closing mid-save would drop its result.
  const requestClose = () => { if (!inFlight.current) onClose(); };

  return (
    <Modal
      isOpen={open}
      onClose={requestClose}
      maxWidth="460px"
      closeOnOverlay={!saving}
      labelledBy="edit-student-title"
      title={
        <span id="edit-student-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <UserPen size={16} /> Edit student profile
          <span className="t-xs text-dim" style={{ fontWeight: 500 }}>{fmtStudentId(studentId)}</span>
        </span>
      }
      footer={
        <>
          <Button variant="ghost" onClick={requestClose} disabled={saving}>Cancel</Button>
          <Button
            variant="primary"
            type="submit"
            form={FORM_ID}
            loading={saving}
            disabled={saving || !dirty}
          >
            Save Changes
          </Button>
        </>
      }
    >
      {formError && (
        <div className="alert error" role="alert">
          <AlertTriangle size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
          {formError}
        </div>
      )}

      <form id={FORM_ID} onSubmit={submit} noValidate>
        <div className="fl">
          <label htmlFor="esp-name">Name</label>
          <input
            id="esp-name" className="fi" value={fields.name} disabled={saving}
            autoComplete="off" maxLength={120}
            onChange={(e) => set('name', e.target.value)}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? 'esp-name-err' : undefined}
          />
          {errors.name && <span className="field-error" id="esp-name-err">{errors.name}</span>}
        </div>

        <div className="fl">
          <label htmlFor="esp-email">Email</label>
          <input
            id="esp-email" type="email" className="fi" value={fields.email} disabled={saving}
            autoComplete="off" maxLength={254}
            onChange={(e) => set('email', e.target.value)}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'esp-email-err' : 'esp-email-hint'}
          />
          {errors.email
            ? <span className="field-error" id="esp-email-err">{errors.email}</span>
            : <span className="t-xs text-faint" id="esp-email-hint">Saved in lowercase. Must not belong to another student.</span>}
        </div>

        <div className="fl" style={{ marginBottom: 0 }}>
          <label htmlFor="esp-phone">Phone</label>
          <input
            id="esp-phone" type="tel" className="fi" value={fields.phone} disabled={saving}
            autoComplete="off" maxLength={32} placeholder="+1 585 522 2449"
            onChange={(e) => set('phone', e.target.value)}
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={errors.phone ? 'esp-phone-err' : 'esp-phone-hint'}
          />
          {errors.phone
            ? <span className="field-error" id="esp-phone-err">{errors.phone}</span>
            : <span className="t-xs text-faint" id="esp-phone-hint">Include the country code. Leave empty to remove the number.</span>}
        </div>
      </form>
    </Modal>
  );
}
