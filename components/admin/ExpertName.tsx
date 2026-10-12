'use client';

import { isAssigned } from '@/lib/utils/statusConfig';
import { expertName } from '@/lib/utils/orderRows';
import type { OrderDTO } from '@/types';

/**
 * The expert on an order row. Rows from GET /admin/all carry no expert
 * fields, so a missing name is not the same as "unassigned": the name is shown
 * when the server sends it, otherwise the status says what is known.
 */
export function ExpertName({ order, maxWidth = 130 }: { order: OrderDTO; maxWidth?: number }) {
  const name = expertName(order);
  if (name) {
    return <span className="t-sm truncate" style={{ maxWidth, display: 'block' }}>{name}</span>;
  }
  if (isAssigned(String(order.status ?? ''))) {
    return (
      <span className="t-sm text-dim" title="Search results don't include the expert's name. Open the order to see it.">
        Assigned
      </span>
    );
  }
  return (
    <span className="text-faint t-sm" title="Search results don't include the expert. Open the order to see it.">
      —
    </span>
  );
}
