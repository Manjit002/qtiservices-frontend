import type { OrderDTO } from '@/types';
import { fmtOrderId, formatDate } from './format';

/** RFC-4180 escaping: wrap in quotes, double any embedded quote. */
function esc(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

/** Column set copied exactly from the legacy `ordersToCsv`. */
const HEADERS = [
  'Order ID', 'Subject', 'Type', 'Deadline', 'Status', 'Price',
  'Payment Status', 'Assigned Expert',
];

export function ordersToCsv(orders: OrderDTO[]): string {
  const rows = orders.map((o) =>
    [
      fmtOrderId(o.id),
      o.subject ?? '',
      o.type ?? '',
      formatDate(o.deadline),
      o.status ?? '',
      o.price ?? '',
      o.paymentStatus ?? '',
      (o.assignedEmployeeName as string | undefined) ?? '',
    ]
      .map(esc)
      .join(',')
  );
  return [HEADERS.map(esc).join(','), ...rows].join('\r\n');
}

/**
 * Trigger a browser download.
 *
 * The \uFEFF BOM is what makes Excel read the file as UTF-8 rather than
 * mangling non-ASCII subjects — that is why it is here and must stay.
 */
export function downloadCsv(csvText: string, filename: string): void {
  const blob = new Blob([`\uFEFF${csvText}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke on the next tick — revoking synchronously can cancel the download
  // in some browsers before it has started reading the blob.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function csvFilename(prefix = 'orders'): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${prefix}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.csv`;
}
