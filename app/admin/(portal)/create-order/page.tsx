'use client';

import { useAdminPortal } from '@/components/admin/shell/AdminPortal';
import { CreateOrderPanel } from '@/components/admin/create-order/CreateOrderPanel';
import { useToast } from '@/hooks/useToast';
import { ordersApi } from '@/lib/api/orders';
import type { OrderDTO } from '@/types';

export default function AdminCreateOrderPage() {
  const { openOrderDetail, bumpRefresh, openSetPrice } = useAdminPortal();
  const { showToast } = useToast();
  return (
    <CreateOrderPanel
      onViewOrder={(id) => openOrderDetail(id)}
      onCreated={bumpRefresh}
      onSetPrice={async (id) => {
        // The success screen only has the new order's ID, and SetPriceModal
        // needs the record — fetch it rather than passing a stub.
        try {
          // detail's `status` is EnumLike (string or {name}); the modal only
          // reads id/subject/price, so the narrowing is safe here.
          const detail = await ordersApi.detail(id);
          openSetPrice(detail as unknown as OrderDTO);
        } catch (e) {
          showToast((e as Error).message, 'error');
        }
      }}
    />
  );
}
