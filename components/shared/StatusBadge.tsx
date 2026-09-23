'use client';

import { statusBadgeClass, statusText } from '@/lib/utils/statusConfig';
import type { OrderStatus } from '@/types';

export function StatusBadge({ status }: { status: OrderStatus | null | undefined }) {
  return <span className={statusBadgeClass(status)}>{statusText(status)}</span>;
}
