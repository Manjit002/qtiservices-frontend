import type { OrderEditFields, OrderUpdatePayload, OrderStatus } from '@/types';

/**
 * Build the request body from the diff between the opened snapshot and the
 * current form state.
 *
 * Why a diff and not the whole form: the backend DTO treats an ABSENT key as
 * "leave unchanged". Sending every field would therefore overwrite any value a
 * colleague changed while this dialog was open, and would write fields the
 * admin never touched.
 */
export function buildUpdatePayload(
  original: OrderEditFields,
  current: OrderEditFields
): OrderUpdatePayload {
  const body: OrderUpdatePayload = {};
  (Object.keys(current) as (keyof OrderEditFields)[]).forEach((k) => {
    if (current[k] === original[k]) return;

    if (k === 'totalPrice') {
      /**
       * An empty or unparseable price must NOT be sent. `parseFloat('')` is
       * NaN, and JSON.stringify turns NaN into `null` — which the server reads
       * as "leave unchanged". The request then succeeds, the toast says the
       * order was updated, and nothing actually changed. Skipping the key is
       * honest about that; checkPrice() surfaces the reason to the admin.
       */
      const n = parseFloat(current.totalPrice);
      if (!Number.isNaN(n)) body.totalPrice = n;
    } else if (k === 'deadline') {
      // datetime-local yields 16 chars; the backend wants seconds.
      const v = current.deadline;
      if (v) body.deadline = v.length === 16 ? `${v}:00` : v;
      // A cleared deadline is deliberately NOT sent: null would be read as
      // "unchanged" by the server, so sending it would be misleading rather
      // than clearing anything.
    } else if (k === 'status') {
      /**
       * `status` is a Java enum. An empty string is not a valid constant, so
       * Jackson throws InvalidFormatException and the WHOLE request 400s —
       * taking every other edited field down with it. Only send a real value.
       */
      if (current.status) body.status = current.status as OrderStatus;
    } else {
      body[k] = current[k];
    }
  });
  return body;
}

/** Human-readable list of what will change, for the confirmation step. */
export function describeChanges(body: OrderUpdatePayload): string {
  return Object.keys(body)
    .map((k) => k.replace(/([A-Z])/g, ' $1').toLowerCase())
    .join(', ');
}

export interface PriceIssue {
  level: 'error' | 'warning';
  message: string;
}

/**
 * Mirrors the server's own price checks so a mistake gets an instant answer
 * instead of a round-trip that ends in a rejection.
 */
export function checkPrice(
  value: string,
  paidAmount: number,
  original = ''
): PriceIssue | null {
  if (!value.trim()) {
    /**
     * Blank is only a mistake if the field USED to hold a value — that is a
     * clear, and clearing is not supported (the payload would carry NaN, which
     * serialises to null and the server reads as "unchanged").
     *
     * An order that never had a price starts blank, and the admin must still
     * be able to edit its subject, so that case stays valid.
     */
    return original.trim()
      ? { level: 'error', message: 'Total price cannot be cleared — enter a value, or restore the original.' }
      : null;
  }
  const total = parseFloat(value);
  if (Number.isNaN(total)) return { level: 'error', message: 'Total price must be a number.' };
  if (total < 0) return { level: 'error', message: 'Total price cannot be negative.' };
  if (paidAmount > 0 && total < paidAmount) {
    return {
      level: 'error',
      message:
        `Total ($${total.toFixed(2)}) is below the $${paidAmount.toFixed(2)} already paid — ` +
        'the server will reject this. Refund the difference first if the price really needs to drop.',
    };
  }
  return null;
}
