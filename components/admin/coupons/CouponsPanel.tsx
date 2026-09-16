'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  Search, X, RotateCw, Plus, Ticket, Pencil, Trash2, Power, PowerOff,
  CalendarX2, TrendingUp, CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Skeleton, SkeletonRows, EmptyState, ErrorState } from '@/components/ui/States';
import { useAsync } from '@/hooks/useAsync';
import { useDebounce } from '@/hooks/useDebounce';
import { useToast } from '@/hooks/useToast';
import { couponsApi } from '@/lib/api/coupons';
import { CouponFormDialog } from './CouponFormDialog';
import { formatCurrency, formatDateTime } from '@/lib/utils/format';
import { couponState, type Coupon, type CouponState } from '@/types';
import './coupons.css';
import '@/components/admin/orders.css';
import '@/components/admin/students/students.css';

const STATE_TONE: Record<CouponState, 'success' | 'neutral' | 'danger'> = {
  active: 'success', inactive: 'neutral', expired: 'danger',
};

const FILTERS: (CouponState | 'ALL')[] = ['ALL', 'active', 'inactive', 'expired'];

export function CouponsPanel() {
  const { showToast } = useToast();
  const coupons = useAsync((s) => couponsApi.list(s), []);

  const [query, setQuery] = useState('');
  const [state, setState] = useState<CouponState | 'ALL'>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'PERCENTAGE' | 'FIXED'>('ALL');
  const [formTarget, setFormTarget] = useState<Coupon | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Coupon | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const search = useDebounce(query, 250);
  const all = useMemo(() => coupons.data ?? [], [coupons.data]);

  const rows = useMemo(() => {
    const q = search.trim().toUpperCase();
    return all.filter((c) => {
      if (state !== 'ALL' && couponState(c) !== state) return false;
      if (typeFilter !== 'ALL' && c.discountType !== typeFilter) return false;
      return !q || (c.code ?? '').toUpperCase().includes(q);
    });
  }, [all, search, state, typeFilter]);

  /** Every figure computed from the real list — none supplied by the API. */
  const stats = useMemo(() => ({
    total: all.length,
    active: all.filter((c) => couponState(c) === 'active').length,
    expired: all.filter((c) => couponState(c) === 'expired').length,
    redemptions: all.reduce((s, c) => s + (c.usedCount ?? 0), 0),
  }), [all]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: all.length };
    all.forEach((x) => { const s = couponState(x); c[s] = (c[s] ?? 0) + 1; });
    return c;
  }, [all]);

  const toggle = useCallback(
    async (c: Coupon) => {
      setBusyId(c.id);
      try {
        // The response is the source of truth — never assume !active.
        const updated = await couponsApi.toggle(c.id);
        showToast(
          `${c.code} ${updated?.active ? 'activated' : 'deactivated'}.`,
          'success'
        );
        coupons.reload();
      } catch (e) {
        showToast((e as Error).message, 'error');
      } finally {
        setBusyId(null);
      }
    },
    [coupons, showToast]
  );

  const remove = useCallback(async () => {
    if (!deleting) return;
    setBusyId(deleting.id);
    try {
      await couponsApi.remove(deleting.id);
      showToast(`Coupon ${deleting.code} deleted.`, 'success');
      setDeleting(null);
      coupons.reload();
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setBusyId(null);
    }
  }, [deleting, coupons, showToast]);

  const filtering = Boolean(query || state !== 'ALL' || typeFilter !== 'ALL');
  const clearAll = () => { setQuery(''); setState('ALL'); setTypeFilter('ALL'); };

  const discountOf = (c: Coupon) =>
    c.discountType === 'PERCENTAGE'
      ? `${c.discountValue}%`
      : formatCurrency(c.discountValue ?? 0);

  const usageOf = (c: Coupon) => {
    const used = c.usedCount ?? 0;
    if (c.usageLimit == null) return { label: `${used} · unlimited`, pct: 0, full: false };
    const pct = c.usageLimit > 0 ? Math.min(100, (used / c.usageLimit) * 100) : 0;
    return { label: `${used} / ${c.usageLimit}`, pct, full: used >= c.usageLimit };
  };

  const cards = [
    { label: 'Total coupons', value: stats.total, tone: 'var(--accent)', icon: <Ticket size={14} /> },
    { label: 'Active', value: stats.active, tone: 'var(--success)', icon: <CheckCircle2 size={14} /> },
    { label: 'Expired', value: stats.expired, tone: 'var(--danger)', icon: <CalendarX2 size={14} /> },
    { label: 'Redemptions', value: stats.redemptions, tone: 'var(--gold)', icon: <TrendingUp size={14} /> },
  ];

  return (
    <div className="rise">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--s4)', flexWrap: 'wrap', marginBottom: 'var(--s5)' }}>
        <div>
          <h1 className="t-h1">Coupons</h1>
          <p className="t-sm text-dim" style={{ marginTop: 4 }}>
            Discount codes, their limits and how often they have been redeemed.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--s2)' }}>
          <Button size="sm" onClick={coupons.reload} loading={coupons.loading}>
            <RotateCw size={13} /> Refresh
          </Button>
          <Button size="sm" variant="primary" onClick={() => setFormTarget('new')}>
            <Plus size={14} /> New coupon
          </Button>
        </div>
      </div>

      <div className="stu-stats" style={{ marginBottom: 'var(--s5)' }}>
        {cards.map((c) => (
          <div className="stu-stat" key={c.label}>
            <span className="stu-stat-flag" style={{ background: c.tone }} aria-hidden />
            <div className="stu-stat-val">
              {coupons.loading ? <Skeleton w={40} h={22} /> : c.value}
            </div>
            <div className="stu-stat-lbl" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ color: c.tone }}>{c.icon}</span> {c.label}
            </div>
          </div>
        ))}
      </div>

      <div className="ord-bar">
        <div className="ord-search">
          <Search size={14} />
          <input className="input" value={query} onChange={(e) => setQuery(e.target.value)}
                 placeholder="Search by coupon code…" aria-label="Search coupons"
                 style={{ textTransform: 'uppercase' }} />
          {query && (
            <button type="button" className="clear" onClick={() => setQuery('')}
                    aria-label="Clear search"><X size={13} /></button>
          )}
        </div>
        <select className="input" style={{ width: 160 }} value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
                aria-label="Filter by discount type">
          <option value="ALL">All types</option>
          <option value="PERCENTAGE">Percentage</option>
          <option value="FIXED">Fixed amount</option>
        </select>
        {filtering && (
          <Button size="sm" variant="ghost" onClick={clearAll}>Clear filters</Button>
        )}
      </div>

      <div className="ord-bar">
        <div className="seg" role="group" aria-label="Filter by status">
          {FILTERS.map((s) => (
            <button key={s} type="button" className={state === s ? 'on' : ''}
                    onClick={() => setState(s)} aria-pressed={state === s}>
              {s === 'ALL' ? 'All' : s}{counts[s] != null && ` (${counts[s]})`}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="cp-table-wrap table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th scope="col">Code</th>
                <th scope="col">Discount</th>
                <th scope="col">Usage</th>
                <th scope="col">Expires</th>
                <th scope="col">Status</th>
                <th scope="col" style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {coupons.loading && <SkeletonRows rows={5} cols={6} />}
              {coupons.error && (
                <tr><td colSpan={6}><ErrorState message={coupons.error} onRetry={coupons.reload} /></td></tr>
              )}
              {!coupons.loading && !coupons.error && rows.length === 0 && (
                <tr><td colSpan={6}>
                  <EmptyState
                    icon={<Ticket size={18} />}
                    title={filtering ? 'No coupons match' : 'No coupons yet'}
                    hint={filtering
                      ? 'Try a different code, type or status.'
                      : 'Create a discount code to offer students a reduction at checkout.'}
                    action={filtering
                      ? <Button size="sm" onClick={clearAll}>Clear filters</Button>
                      : <Button size="sm" variant="primary" onClick={() => setFormTarget('new')}>
                          <Plus size={13} /> New coupon
                        </Button>}
                  />
                </td></tr>
              )}
              {rows.map((c) => {
                const st = couponState(c);
                const u = usageOf(c);
                return (
                  <tr key={c.id}>
                    <td><span className="cp-code">{c.code}</span></td>
                    <td>
                      <div className="cp-discount">{discountOf(c)}</div>
                      <div className="t-xs text-dim">
                        {c.discountType === 'PERCENTAGE' ? 'percentage' : 'fixed amount'}
                      </div>
                    </td>
                    <td>
                      <div className="cp-usage">
                        <div className="cp-usage-top">
                          <span>{u.label}</span>
                          {u.full && <span style={{ color: 'var(--danger)' }}>limit reached</span>}
                        </div>
                        {c.usageLimit != null && (
                          <div className="cp-usage-bar">
                            <div className="cp-usage-fill"
                                 style={{ width: `${u.pct}%`, background: u.full ? 'var(--danger)' : 'var(--accent)' }} />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="t-sm text-dim" style={{ whiteSpace: 'nowrap' }}>
                      {c.expiryDate ? formatDateTime(c.expiryDate) : 'Never'}
                    </td>
                    <td><Badge tone={STATE_TONE[st]} dot>{st}</Badge></td>
                    <td>
                      <div className="acts">
                        <button type="button" className="act" onClick={() => setFormTarget(c)}>
                          <Pencil size={12} /> Edit
                        </button>
                        <button type="button" className="act act-icon tip"
                                data-tip={c.active ? 'Deactivate' : 'Activate'}
                                aria-label={`${c.active ? 'Deactivate' : 'Activate'} ${c.code}`}
                                disabled={busyId === c.id}
                                onClick={() => toggle(c)}>
                          {c.active ? <PowerOff size={13} /> : <Power size={13} />}
                        </button>
                        <span className="acts-sep" aria-hidden />
                        <button type="button" className="act act-icon act-danger tip"
                                data-tip="Delete coupon" aria-label={`Delete ${c.code}`}
                                disabled={busyId === c.id}
                                onClick={() => setDeleting(c)}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Mobile cards ── */}
        <div className="cp-cards">
          {!coupons.loading && rows.map((c) => {
            const st = couponState(c);
            const u = usageOf(c);
            return (
              <article className="cp-card" key={c.id}>
                <div className="cp-card-top">
                  <div>
                    <span className="cp-code">{c.code}</span>
                    <div className="cp-discount" style={{ marginTop: 2 }}>{discountOf(c)}</div>
                  </div>
                  <Badge tone={STATE_TONE[st]} dot>{st}</Badge>
                </div>
                <div className="cp-card-grid">
                  <div>
                    <div className="t-eyebrow">Usage</div>
                    <div className="t-sm">{u.label}</div>
                  </div>
                  <div>
                    <div className="t-eyebrow">Expires</div>
                    <div className="t-sm">{c.expiryDate ? formatDateTime(c.expiryDate) : 'Never'}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--s2)', marginTop: 'var(--s3)' }}>
                  <Button size="sm" style={{ flex: 1 }} onClick={() => setFormTarget(c)}>
                    <Pencil size={13} /> Edit
                  </Button>
                  <Button size="sm" style={{ flex: 1 }} disabled={busyId === c.id}
                          onClick={() => toggle(c)}>
                    {c.active ? <PowerOff size={13} /> : <Power size={13} />}
                    {c.active ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button size="sm" variant="danger" iconOnly aria-label={`Delete ${c.code}`}
                          disabled={busyId === c.id} onClick={() => setDeleting(c)}>
                    <Trash2 size={13} />
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <CouponFormDialog
        target={formTarget}
        onClose={() => setFormTarget(null)}
        onSaved={coupons.reload}
      />

      <ConfirmDialog
        isOpen={deleting !== null}
        title="Delete coupon"
        message={`Delete ${deleting?.code}? It has been redeemed ${deleting?.usedCount ?? 0} time${(deleting?.usedCount ?? 0) === 1 ? '' : 's'}. This cannot be undone — deactivate instead if you only want to stop it being used.`}
        confirmLabel="Delete coupon"
        danger
        busy={busyId === deleting?.id}
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
