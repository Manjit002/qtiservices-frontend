import { ApiError } from '@/lib/api/client';
import type { StudentProfileResponse, UpdateStudentProfileRequest } from '@/types';

/**
 * Admin edit of a student's name, email and phone.
 *
 * Everything here mirrors StudentService.updateStudentProfileByAdmin exactly,
 * because the service's rules are asymmetric and a UI that ignores that
 * asymmetry silently does the wrong thing:
 *
 *   name   blank  → IGNORED by the service (old name kept)
 *   email  blank  → IGNORED by the service (old email kept); otherwise
 *                   trimmed + lowercased, and rejected if another student
 *                   already has it
 *   phone  ""     → SAVED as "" — this is the only field an empty value
 *                   actually clears
 *   phone  null   → IGNORED (left as it is)
 *
 * So a blank name or email must be blocked here: submitting one would look
 * like it succeeded while nothing changed.
 */

export interface ProfileFields {
  name: string;
  email: string;
  phone: string;
}

export type FieldErrors = Partial<Record<keyof ProfileFields, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function toFields(src: {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
}): ProfileFields {
  return { name: src.name ?? '', email: src.email ?? '', phone: src.phone ?? '' };
}

/**
 * Client-side checks. Deliberately lenient on phone: international numbers
 * vary too much for a strict pattern, so this only asks for a plausible digit
 * count (7–15, the E.164 maximum) and accepts any spacing, "+", dashes,
 * brackets or dots around them.
 */
export function validateProfile(f: ProfileFields): FieldErrors {
  const e: FieldErrors = {};

  if (!f.name.trim()) {
    // The service would keep the old name and report success.
    e.name = 'Name is required.';
  }

  const email = f.email.trim();
  if (!email) {
    e.email = 'Email is required.';
  } else if (!EMAIL_RE.test(email)) {
    e.email = 'Enter a valid email address.';
  }

  const phone = f.phone.trim();
  if (phone) {
    const digits = phone.replace(/\D/g, '').length;
    if (digits < 7 || digits > 15) {
      e.phone = 'Enter a phone number with 7 to 15 digits, including the country code.';
    }
  }

  return e;
}

/** True when the form differs from what is stored. Email compares as the service does. */
export function hasChanges(original: ProfileFields, current: ProfileFields): boolean {
  return (
    current.name.trim() !== original.name.trim() ||
    current.email.trim().toLowerCase() !== original.email.trim().toLowerCase() ||
    current.phone.trim() !== original.phone.trim()
  );
}

export function emailChanged(original: ProfileFields, current: ProfileFields): boolean {
  return current.email.trim().toLowerCase() !== original.email.trim().toLowerCase();
}

/**
 * Builds the request body. All three fields are sent, as specified.
 *
 * One refinement on phone: an empty field is sent as `null` when the student
 * had no phone to begin with. Sending "" there would make the service write an
 * empty string over a null on every save of a phoneless student — a silent
 * data change the admin never asked for. An empty field over an EXISTING phone
 * is sent as "" because that is a deliberate clear.
 */
export function buildProfilePayload(
  original: ProfileFields,
  current: ProfileFields
): UpdateStudentProfileRequest {
  const phone = current.phone.trim();
  return {
    name: current.name.trim(),
    email: current.email.trim(),
    phone: phone === '' && original.phone.trim() === '' ? null : phone,
  };
}

/**
 * Values to display after a successful save.
 *
 * The PUT response is preferred because it is what the database now holds —
 * notably, the service lowercases the email, so "Wade@Gmail.com" is stored as
 * "wade@gmail.com". If the response omits a field (its exact shape is not
 * guaranteed), the submitted value is used, normalized the same way the
 * service normalizes it.
 */
export function mergeSaved(
  sent: UpdateStudentProfileRequest,
  original: ProfileFields,
  res: StudentProfileResponse | null | undefined
): ProfileFields {
  const has = (k: keyof StudentProfileResponse) =>
    res != null && Object.prototype.hasOwnProperty.call(res, k);

  return {
    name: has('name') ? String(res!.name ?? '') : sent.name,
    email: has('email') ? String(res!.email ?? '') : sent.email.toLowerCase(),
    phone: has('phone')
      ? String(res!.phone ?? '')
      : sent.phone === null ? original.phone : sent.phone,
  };
}

export interface SaveFailure {
  /** Set when the problem belongs to one field, so it renders beside it. */
  field?: keyof ProfileFields;
  message: string;
}

/**
 * Turns a failed save into something the admin can act on.
 *
 * The service reports both "Email already exists" and "Student not found" as a
 * plain RuntimeException. Whether that text reaches the browser depends on the
 * backend's exception handling: with a handler that writes `message` into the
 * body it does; under Spring Boot's default error handling the body carries no
 * message and the status is a bare 500. Both cases are handled — and in the
 * second, this does NOT claim the email is taken when it cannot know that.
 */
export function describeSaveError(err: unknown, changedEmail: boolean): SaveFailure {
  const status = err instanceof ApiError ? err.status : -1;
  const raw = err instanceof Error ? err.message : '';
  const msg = raw.toLowerCase();

  if (status === 0) {
    return { message: 'Could not reach the server. Check your connection and try again.' };
  }
  if (status === 401) {
    return { message: 'Your session has expired. Sign in again, then retry.' };
  }
  if (status === 403) {
    return { message: 'Your account is not permitted to edit student profiles.' };
  }
  if (msg.includes('already exists')) {
    return { field: 'email', message: 'Email already exists.' };
  }
  if (status === 404 || msg.includes('not found')) {
    return { message: 'Student not found.' };
  }

  // A bare 5xx with no usable message. If the email was changed, a duplicate is
  // the likeliest cause — say so as a possibility, not as a fact.
  const uninformative = !raw || /^request failed/i.test(raw);
  if (uninformative && changedEmail) {
    return {
      field: 'email',
      message:
        'Could not save. This email may already belong to another student — check it, or try again.',
    };
  }
  if (uninformative) {
    return {
      message: `Could not save changes${status > 0 ? ` (server error ${status})` : ''}. Try again.`,
    };
  }
  return { message: raw };
}
