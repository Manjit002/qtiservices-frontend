'use client';

import { useCallback, useMemo, useState } from 'react';
import { Search, X, Star, PartyPopper, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Skeleton, EmptyState, ErrorState } from '@/components/ui/States';
import { FileLightbox } from '@/components/shared/FileLightbox';
import { useAsync } from '@/hooks/useAsync';
import { useDebounce } from '@/hooks/useDebounce';
import { useToast } from '@/hooks/useToast';
import { reviewsApi } from '@/lib/api/reviews';
import { ReviewCard } from './ReviewCard';
import { REVIEW_SOURCE_LABEL } from '@/types/review';
import type { ReviewResponseDTO } from '@/types';
import './reviews.css';
import '@/components/admin/orders.css';
import '@/components/admin/students/students.css';

interface Props {
  onAddExternal: () => void;
}

export function ReviewsPanel({ onAddExternal }: Props) {
  const { showToast } = useToast();
  const reviews = useAsync((s) => reviewsApi.pending(s), []);

  const [query, setQuery] = useState('');
  const [source, setSource] = useState('ALL');
  const [minRating, setMinRating] = useState(0);
  const [lightbox, setLightbox] = useState<string | null>(null);
  /** Rows removed locally after a decision, so the card leaves immediately. */
  const [settled, setSettled] = useState<Set<number>>(new Set());

  const search = useDebounce(query, 250);

  const all = useMemo(
    () => (reviews.data ?? []).filter((r) => !settled.has(r.id)),
    [reviews.data, settled]
  );

  /**
   * The endpoint returns pending reviews only and takes no query parameters,
   * so filtering happens in the browser over the fetched array.
   */
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((r) => {
      if (source !== 'ALL' && String(r.reviewSource ?? '') !== source) return false;
      if (minRating > 0 && (r.rating ?? 0) < minRating) return false;
      if (!q) return true;
      return (
        (r.reviewerName ?? '').toLowerCase().includes(q) ||
        (r.title ?? '').toLowerCase().includes(q) ||
        (r.review ?? '').toLowerCase().includes(q) ||
        (r.country ?? '').toLowerCase().includes(q)
      );
    });
  }, [all, search, source, minRating]);

  /** Only figures the pending list can actually support — nothing invented. */
  const stats = useMemo(() => {
    const rated = all.filter((r) => (r.rating ?? 0) > 0);
    const avg = rated.length
      ? rated.reduce((s, r) => s + (r.rating ?? 0), 0) / rated.length
      : 0;
    return {
      pending: all.length,
      withMedia: all.filter((r) => (r.media?.length ?? 0) > 0).length,
      external: all.filter((r) => r.reviewType === 'EXTERNAL').length,
      avg,
    };
  }, [all]);

  const decide = useCallback(
    async (id: number, fn: () => Promise<ReviewResponseDTO>, message: string) => {
      try {
        await fn();
        showToast(message, 'success');
        setSettled((prev) => new Set(prev).add(id));
      } catch (e) {
        showToast((e as Error).message, 'error');
        throw e;                      // keeps the card's button state honest
      }
    },
    [showToast]
  );

  const approve = useCallback(
    (id: number, remark: string) =>
      decide(id, () => reviewsApi.approve(id, remark),
        'Review approved — it is now eligible for the public site.'),
    [decide]
  );

  const reject = useCallback(
    (id: number, remark: string) =>
      decide(id, () => reviewsApi.reject(id, remark), 'Review rejected.'),
    [decide]
  );

  const verify = useCallback(
    async (id: number) => {
      try {
        const updated = await reviewsApi.verifyPurchase(id);
        // A false result is a legitimate answer, not a failure — it means no
        // order was ever linked to this review.
        if (updated?.verifiedPurchase) {
          showToast('Purchase verified — a matching order exists.', 'success');
        } else {
          showToast('No matching order found for this review.', 'warning');
        }
        reviews.reload();
      } catch (e) {
        showToast((e as Error).message, 'error');
      }
    },
    [reviews, showToast]
  );

  const sources = useMemo(() => {
    const present = new Set(all.map((r) => String(r.reviewSource ?? '')).filter(Boolean));
    return ['ALL', ...[...present].sort()];
  }, [all]);

  const filtering = Boolean(query || source !== 'ALL' || minRating > 0);

  return (
    <div className="rise">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--s4)', flexWrap: 'wrap', marginBottom: 'var(--s5)' }}>
        <div>
          <h1 className="t-h1">Reviews</h1>
          <p className="t-sm text-dim" style={{ marginTop: 4 }}>
            Moderate reviews awaiting a decision. Approved reviews become eligible for the public site.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={onAddExternal}>
          <Plus size={14} /> Add external review
        </Button>
      </div>

      <div className="stu-stats" style={{ marginBottom: 'var(--s5)' }}>
        {[
          { label: 'Awaiting decision', value: String(stats.pending), tone: 'var(--warning)' },
          { label: 'With media', value: String(stats.withMedia), tone: 'var(--accent)' },
          { label: 'External', value: String(stats.external), tone: 'var(--info)' },
          { label: 'Average rating', value: stats.avg ? stats.avg.toFixed(1) : '—', tone: 'var(--gold)' },
        ].map((s) => (
          <div className="stu-stat" key={s.label}>
            <span className="stu-stat-flag" style={{ background: s.tone }} aria-hidden />
            <div className="stu-stat-val">
              {reviews.loading ? <Skeleton w={44} h={22} /> : s.value}
            </div>
            <div className="stu-stat-lbl">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="ord-bar">
        <div className="ord-search">
          <Search size={14} />
          <input className="input" value={query} onChange={(e) => setQuery(e.target.value)}
                 placeholder="Search reviewer, title or text…" aria-label="Search reviews" />
          {query && (
            <button type="button" className="clear" onClick={() => setQuery('')}
                    aria-label="Clear search">
              <X size={13} />
            </button>
          )}
        </div>

        <select className="input" style={{ width: 150 }} value={source}
                onChange={(e) => setSource(e.target.value)} aria-label="Filter by source">
          {sources.map((s) => (
            <option key={s} value={s}>
              {s === 'ALL' ? 'All sources' : REVIEW_SOURCE_LABEL[s] ?? s}
            </option>
          ))}
        </select>

        <select className="input" style={{ width: 140 }} value={minRating}
                onChange={(e) => setMinRating(Number(e.target.value))}
                aria-label="Minimum rating">
          <option value={0}>Any rating</option>
          {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} stars &amp; up</option>)}
        </select>

        {filtering && (
          <Button size="sm" variant="ghost"
                  onClick={() => { setQuery(''); setSource('ALL'); setMinRating(0); }}>
            Reset
          </Button>
        )}
      </div>

      {reviews.loading && (
        <div className="rv-list">
          {Array.from({ length: 3 }).map((_, i) => (
            <div className="card rv-card" key={i}>
              <Skeleton h={130} />
            </div>
          ))}
        </div>
      )}

      {reviews.error && <ErrorState message={reviews.error} onRetry={reviews.reload} />}

      {!reviews.loading && !reviews.error && rows.length === 0 && (
        <section className="card">
          <EmptyState
            icon={filtering ? <Search size={18} /> : <PartyPopper size={18} />}
            title={filtering ? 'No reviews match' : 'No pending reviews'}
            hint={filtering
              ? 'Try a different search or clear the filters.'
              : 'Everything has been moderated. New submissions appear here automatically.'}
            action={filtering
              ? <Button size="sm" onClick={() => { setQuery(''); setSource('ALL'); setMinRating(0); }}>
                  Clear filters
                </Button>
              : <Button size="sm" variant="primary" onClick={onAddExternal}>
                  <Star size={13} /> Add an external review
                </Button>}
          />
        </section>
      )}

      {rows.length > 0 && (
        <div className="rv-list">
          {rows.map((r) => (
            <ReviewCard key={r.id} review={r} onApprove={approve} onReject={reject}
                        onVerify={verify} onOpenImage={setLightbox} />
          ))}
        </div>
      )}

      <FileLightbox url={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}
