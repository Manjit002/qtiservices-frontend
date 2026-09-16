'use client';

import { useCallback, useEffect, useState } from 'react';
import { Modal } from '@/components/shared/Modal';
import { Spinner } from '@/components/shared/Spinner';
import { useToast } from '@/hooks/useToast';
import { ordersApi } from '@/lib/api/orders';
import { copyText } from '@/lib/utils/download';
import { fmtOrderId, formatCurrency } from '@/lib/utils/format';
import type { OrderDTO } from '@/types';

interface Props {
  order: OrderDTO | null;
  onClose: () => void;
}

export function PayLinkModal({ order, onClose }: Props) {
  const { showToast } = useToast();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setUrl(null);
    setError('');
    setCopied(false);
  }, [order]);

  const generate = useCallback(async () => {
    if (!order) return;
    setBusy(true);
    setError('');
    try {
      const res = await ordersApi.paymentLink(order.id);
      // The backend has used three different field names for this; the source
      // reads them in exactly this order.
      const link = res?.paymentUrl ?? res?.url ?? res?.checkoutUrl;
      if (!link) throw new Error('No payment URL returned');
      setUrl(link);
      setCopied(false);
    } catch (e) {
      setError(`⚠️ ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [order]);

  const copy = useCallback(async () => {
    if (!url) return;
    const done = await copyText(url);
    setCopied(done);
    showToast(done ? 'Payment link copied.' : 'Copy failed', done ? 'success' : 'error');
  }, [url, showToast]);

  return (
    <Modal
      isOpen={order != null}
      onClose={onClose}
      title={<>🔗 Payment Link — {fmtOrderId(order?.id ?? null)}</>}
      maxWidth="520px"
      closeOnOverlay={!busy}
      labelledBy="paylink-title"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Close
          </button>
          <button type="button" className="btn btn-primary" onClick={generate} disabled={busy}>
            {busy ? 'Generating…' : url ? '🔄 Regenerate' : '🔗 Generate Payment Link'}
          </button>
        </>
      }
    >
      {error && <div className="alert error" role="alert">{error}</div>}

      <div className="detail-item">
        <span className="detail-lbl">Subject</span>
        <span className="detail-val">{order?.subject ?? '—'}</span>
      </div>
      <div className="detail-item">
        <span className="detail-lbl">Price</span>
        <span className="detail-val">
          {order?.price != null ? formatCurrency(order.price) : '—'}
        </span>
      </div>
      <div className="detail-item">
        <span className="detail-lbl">Status</span>
        <span className="detail-val">{String(order?.status ?? '').replace(/_/g, ' ') || '—'}</span>
      </div>

      {busy && (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <Spinner />
          <div style={{ fontSize: '.8rem', color: 'var(--muted)', marginTop: 10 }}>
            Generating secure checkout link…
          </div>
        </div>
      )}

      {url && !busy && (
        <div style={{ marginTop: 18 }}>
          <div className="detail-lbl" style={{ marginBottom: 6 }}>Payment URL</div>
          <div
            style={{
              wordBreak: 'break-all', fontSize: '.78rem', background: 'rgba(255,255,255,.04)',
              border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px',
              color: 'var(--cyan)',
            }}
          >
            {url}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button type="button" className="btn-copy" onClick={copy}>
              {copied ? '✅ Copied' : '📋 Copy Link'}
            </button>
            <a className="btn-open-link" href={url} target="_blank" rel="noopener noreferrer">
              ↗ Open
            </a>
          </div>
        </div>
      )}
    </Modal>
  );
}
