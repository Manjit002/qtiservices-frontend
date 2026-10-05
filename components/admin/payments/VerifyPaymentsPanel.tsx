'use client';

import { useCallback, useState } from 'react';
import { BadgeCheck } from 'lucide-react';
import { EmptyState } from '@/components/ui/States';
import { useToast } from '@/hooks/useToast';
import { ordersApi } from '@/lib/api/orders';
import { PaymentSearch } from './PaymentSearch';
import { PaymentSummary } from './PaymentSummary';
import { PaymentHistory } from './PaymentHistory';
import { ManualVerification } from './ManualVerification';
import type { OrderDTO, OrderDetailDTO, PaymentDTO } from '@/types';
import './payments.css';
import '@/components/admin/students/students.css';
import '@/components/admin/orders.css';

/** Prefix-tolerant: OD-2417, od-2417, ID-88 and bare numbers all work. */
function normalise(q: string): string {
  return q.trim().toLowerCase().replace(/^od-/, '').replace(/^id-/, '');
}

export function VerifyPaymentsPanel() {
  const { showToast } = useToast();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<OrderDTO[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [order, setOrder] = useState<OrderDetailDTO | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  const [mvOrderId, setMvOrderId] = useState('');
  const [mvIntent, setMvIntent] = useState('');
  const [focusToken, setFocusToken] = useState(0);

  /**
   * The backend has no order-search endpoint for this page, so the source
   * fetches a wide page and filters in the browser across id, subject, student
   * id and email, capped at 8 hits. Reproduced exactly.
   */
  const search = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setSearchError(null);
    try {
      const page = await ordersApi.listAll(0, 200, 'createdAt,desc');
      const kw = normalise(q);
      const hits = (page.content ?? []).filter((o) =>
        String(o.id).includes(kw) ||
        (o.subject ?? '').toLowerCase().includes(kw) ||
        String(o.studentId ?? '').includes(kw) ||
        (o.studentEmail ?? '').toLowerCase().includes(kw)
      ).slice(0, 8);
      setResults(hits);
    } catch (e) {
      setSearchError((e as Error).message);
    } finally {
      setSearching(false);
    }
  }, [query]);

  /**
   * Payments come EMBEDDED in the order detail — this page does not call
   * /payments/order/{id}. One request gives the totals and the history together.
   */
  const loadOrder = useCallback(async (orderId: number) => {
    setLoadingOrder(true);
    setOrderError(null);
    try {
      setOrder(await ordersApi.detail(orderId));
    } catch (e) {
      setOrderError((e as Error).message);
    } finally {
      setLoadingOrder(false);
    }
  }, []);

  const select = useCallback(
    (o: OrderDTO) => {
      setResults(null);
      setQuery('');
      setMvOrderId(String(o.id));   // pre-fill for convenience; still editable
      void loadOrder(o.id);
    },
    [loadOrder]
  );

  const clear = useCallback(() => {
    setQuery('');
    setResults(null);
    setSearchError(null);
  }, []);

  const prefillFromPayment = useCallback((paymentIntentId: string) => {
    if (order) setMvOrderId(String(order.id));
    setMvIntent(paymentIntentId);
    setFocusToken((n) => n + 1);
  }, [order]);

  /** Refetch after a successful attach so totals and history reflect the server. */
  const afterVerified = useCallback(
    (verifiedOrderId: number) => {
      if (order?.id === verifiedOrderId) void loadOrder(verifiedOrderId);
      else showToast(`Attached to order ${verifiedOrderId}. Search it to see the updated history.`, 'info', 6000);
    },
    [order, loadOrder, showToast]
  );

  const payments: PaymentDTO[] = order?.payments ?? [];

  return (
    <div className="rise">
      <div style={{ marginBottom: 'var(--s5)' }}>
        <h1 className="t-h1">Verify payments</h1>
        <p className="t-sm text-dim" style={{ marginTop: 4 }}>
          Inspect an order&rsquo;s payment history, and attach a Stripe payment that
          didn&rsquo;t reconcile automatically.
        </p>
      </div>

      <div className="pv-cols">
        <div>
          <PaymentSearch
            value={query}
            onChange={setQuery}
            onSearch={search}
            onClear={clear}
            results={results}
            loading={searching}
            error={searchError}
            onSelect={select}
          />

          {order && !loadingOrder && <PaymentSummary order={order} />}

          {order || loadingOrder || orderError ? (
            <PaymentHistory
              payments={payments}
              loading={loadingOrder}
              error={orderError}
              onRetry={() => order && void loadOrder(order.id)}
              onVerifyManually={prefillFromPayment}
            />
          ) : (
            <section className="card">
              <EmptyState
                icon={<BadgeCheck size={18} />}
                title="Pick an order to see its payments"
                hint="Search above, or use manual verification on the right if you already have the order ID and Stripe payment intent."
              />
            </section>
          )}
        </div>

        <div className="pv-rail">
          <ManualVerification
            orderId={mvOrderId}
            onOrderIdChange={setMvOrderId}
            paymentIntentId={mvIntent}
            onPaymentIntentChange={setMvIntent}
            onVerified={afterVerified}
            focusToken={focusToken}
          />
        </div>
      </div>
    </div>
  );
}
