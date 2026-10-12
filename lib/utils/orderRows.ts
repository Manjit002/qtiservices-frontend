import type { OrderDTO } from '@/types';
import { fmtStudentId } from './format';
import { isAssigned } from './statusConfig';

/**
 * Order lists come from GET /admin/all, whose rows (OrderService.mapToOrderDTO)
 * carry no student or expert fields. These helpers read those fields when the
 * server sends them and say "unknown" otherwise, so no screen turns a missing
 * field into a false statement such as "Unassigned" or "0 active orders".
 */

/** The expert's name on a row, or '' when the row doesn't say. */
export function expertName(o: OrderDTO): string {
  return typeof o.assignedEmployeeName === 'string' ? o.assignedEmployeeName.trim() : '';
}

/** The student's email or ID on a row, or null when the row doesn't say. */
export function studentLabel(o: OrderDTO): string | null {
  const email = typeof o.studentEmail === 'string' ? o.studentEmail.trim() : '';
  if (email) return email;
  return o.studentId ? fmtStudentId(o.studentId) : null;
}

/** True when at least one row identifies its student. */
export function rowsHaveStudents(rows: OrderDTO[]): boolean {
  return rows.some((o) => studentLabel(o) != null);
}

/**
 * True when these rows can say who each order's expert is: some row names an
 * expert, or no row is in an assigned status (so there is nobody to name).
 * False means expert counts from these rows would be wrong, not zero.
 */
export function expertNamesKnown(rows: OrderDTO[]): boolean {
  if (rows.some((o) => expertName(o))) return true;
  return !rows.some((o) => isAssigned(String(o.status ?? '')));
}

export const EXPERT_UNKNOWN_NOTE =
  'Order search results don’t include the assigned expert, so this can’t be counted.';
