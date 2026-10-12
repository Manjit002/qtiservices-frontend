'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Rocket, AlertTriangle, CheckCircle2, Info, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useToast } from '@/hooks/useToast';
import { reviewsApi } from '@/lib/api/reviews';
import { StarsInput, StarsStatic } from './RatingStars';
import { MediaUploader } from './MediaUploader';
import { REVIEW_SOURCES, REVIEW_SOURCE_LABEL } from '@/types/review';
import type { ReviewSource } from '@/types';
import './reviews.css';
import '@/components/admin/create-order/create-order.css';
import '@/components/admin/order-edit.css';

interface Props {
  onDone: () => void;
}

interface Fields {
  reviewerName: string;
  country: string;
  rating: number;
  title: string;
  review: string;
  reviewSource: ReviewSource | '';
  sourceUrl: string;
}

const EMPTY: Fields = {
  reviewerName: '', country: '', rating: 0, title: '', review: '',
  reviewSource: '', sourceUrl: '',
};

const MAX_IMAGE = 10 * 1024 * 1024;
const MAX_VIDEO = 100 * 1024 * 1024;

export function ExternalReviewPanel({ onDone }: Props) {
  const { showToast } = useToast();
  const [f, setF] = useState<Fields>(EMPTY);
  const [images, setImages] = useState<File[]>([]);
  const [videos, setVideos] = useState<File[]>([]);
  const [errors, setErrors] = useState<Partial<Record<keyof Fields, string>>>({});
  const [formError, setFormError] = useState('');
  const [published, setPublished] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [confirming, setConfirming] = useState(false);

  const set = <K extends keyof Fields>(k: K, v: Fields[K]) => {
    setF((prev) => ({ ...prev, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
    setFormError('');
  };

  const dirty = useMemo(
    () => JSON.stringify(f) !== JSON.stringify(EMPTY) || images.length > 0 || videos.length > 0,
    [f, images, videos]
  );

  const validate = useCallback((): boolean => {
    const next: Partial<Record<keyof Fields, string>> = {};
    if (!f.reviewerName.trim()) next.reviewerName = 'Reviewer name is required.';
    if (!f.rating) next.rating = 'Select a star rating.';
    if (!f.review.trim()) next.review = 'Review text is required.';
    if (!f.reviewSource) next.reviewSource = 'Select a review source.';
    if (f.sourceUrl.trim() && !/^https?:\/\/.+/i.test(f.sourceUrl.trim())) {
      next.sourceUrl = 'Enter a full URL starting with http:// or https://';
    }
    setErrors(next);
    if (Object.keys(next).length) {
      setFormError('Fix the highlighted fields before publishing.');
      return false;
    }
    return true;
  }, [f]);

  const publish = useCallback(async () => {
    setConfirming(false);
    setBusy(true);
    setFormError('');
    setProgress(0);
    try {
      const { promise } = reviewsApi.createExternal(
        {
          reviewerName: f.reviewerName.trim(),
          country: f.country.trim(),
          rating: f.rating,
          title: f.title.trim(),
          review: f.review.trim(),
          reviewSource: f.reviewSource as ReviewSource,
          sourceUrl: f.sourceUrl.trim(),
        },
        images,
        videos,
        setProgress
      );
      const dto = await promise;
      setPublished(dto?.reviewerName ?? f.reviewerName.trim());
      showToast('External review published.', 'success', 5000);
      // Cleared only on success — a failed request keeps everything typed.
      setF(EMPTY);
      setImages([]);
      setVideos([]);
    } catch (e) {
      const msg = (e as Error).message;
      setFormError(msg);
      showToast(msg, 'error');
    } finally {
      setBusy(false);
      setProgress(0);
    }
  }, [f, images, videos, showToast]);

  const attempt = useCallback(() => {
    setPublished(null);
    if (!validate()) return;
    // This endpoint publishes immediately — there is no queue to undo from, so
    // it confirms first.
    setConfirming(true);
  }, [validate]);

  return (
    <div className="rise">
      <div style={{ marginBottom: 'var(--s5)' }}>
        <Button variant="ghost" size="sm" onClick={onDone} style={{ marginBottom: 'var(--s3)' }}>
          <ArrowLeft size={14} /> Back to reviews
        </Button>
        <h1 className="t-h1">Add external review</h1>
        <p className="t-sm text-dim" style={{ marginTop: 4 }}>
          Record a review collected somewhere else — Google, Facebook, email, and so on.
        </p>
      </div>

      <div className="xr-cols">
        <div style={{ display: 'grid', gap: 'var(--s5)' }}>
          {published && (
            <div className="alert success" role="status">
              <CheckCircle2 size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
              Review by <strong>{published}</strong> published and live.
            </div>
          )}
          {formError && (
            <div className="alert error" role="alert">
              <AlertTriangle size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
              {formError}
            </div>
          )}

          <section className="card">
            <div className="card-head"><h2 className="t-h3">Reviewer</h2></div>
            <div className="xr-grid">
              <div className="fl">
                <label htmlFor="xr-name">Reviewer name<span className="co-req">*</span></label>
                <input id="xr-name" className="fi" value={f.reviewerName} disabled={busy}
                       onChange={(e) => set('reviewerName', e.target.value)}
                       placeholder="Jane Okafor" aria-invalid={Boolean(errors.reviewerName)} />
                {errors.reviewerName && <span className="field-error">{errors.reviewerName}</span>}
              </div>
              <div className="fl">
                <label htmlFor="xr-country">Country</label>
                <input id="xr-country" className="fi" value={f.country} disabled={busy}
                       onChange={(e) => set('country', e.target.value)} placeholder="Optional" />
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-head"><h2 className="t-h3">Review</h2></div>
            <div className="xr-grid">
              <div className="fl full">
                <label htmlFor="xr-rating">Rating<span className="co-req">*</span></label>
                <div id="xr-rating">
                  <StarsInput value={f.rating} onChange={(v) => set('rating', v)} disabled={busy} />
                </div>
                {errors.rating
                  ? <span className="field-error">{errors.rating}</span>
                  : <span className="t-xs text-faint">
                      {f.rating ? `${f.rating} of 5` : 'Click a star, or use the arrow keys.'}
                    </span>}
              </div>

              <div className="fl full">
                <label htmlFor="xr-title">Title</label>
                <input id="xr-title" className="fi" value={f.title} disabled={busy}
                       onChange={(e) => set('title', e.target.value)}
                       placeholder="Optional headline" />
              </div>

              <div className="fl full">
                <label htmlFor="xr-review">Review<span className="co-req">*</span></label>
                <textarea id="xr-review" className="fi" rows={7} disabled={busy}
                          style={{ height: 'auto', padding: '10px 12px', lineHeight: 1.7 }}
                          value={f.review} onChange={(e) => set('review', e.target.value)}
                          placeholder="What did the reviewer say?"
                          aria-invalid={Boolean(errors.review)} />
                {errors.review && <span className="field-error">{errors.review}</span>}
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-head"><h2 className="t-h3">Source</h2></div>
            <div className="xr-grid">
              <div className="fl">
                <label htmlFor="xr-source">Review source<span className="co-req">*</span></label>
                <select id="xr-source" className="fi" value={f.reviewSource} disabled={busy}
                        onChange={(e) => set('reviewSource', e.target.value as ReviewSource)}
                        aria-invalid={Boolean(errors.reviewSource)}>
                  <option value="">— Select source —</option>
                  {REVIEW_SOURCES.map((s) => (
                    <option key={s} value={s}>{REVIEW_SOURCE_LABEL[s] ?? s}</option>
                  ))}
                </select>
                {errors.reviewSource && <span className="field-error">{errors.reviewSource}</span>}
              </div>
              <div className="fl">
                <label htmlFor="xr-url">Source URL</label>
                <input id="xr-url" type="url" className="fi" value={f.sourceUrl} disabled={busy}
                       onChange={(e) => set('sourceUrl', e.target.value)}
                       placeholder="https://…" aria-invalid={Boolean(errors.sourceUrl)} />
                {errors.sourceUrl && <span className="field-error">{errors.sourceUrl}</span>}
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-head"><h2 className="t-h3">Media</h2></div>
            <div className="xr-grid">
              <div className="fl full">
                <label>Images</label>
                <MediaUploader kind="image" files={images} onChange={setImages}
                               disabled={busy} maxBytes={MAX_IMAGE} />
              </div>
              <div className="fl full">
                <label>Videos</label>
                <MediaUploader kind="video" files={videos} onChange={setVideos}
                               disabled={busy} maxBytes={MAX_VIDEO} />
              </div>
            </div>
          </section>
        </div>

        {/* ── Preview + publish ── */}
        <div className="xr-rail">
          <section className="card">
            <div className="card-head"><h2 className="t-h3">Preview</h2></div>
            <div style={{ padding: 'var(--s5)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="avatar" aria-hidden>
                  {(f.reviewerName || '?').charAt(0).toUpperCase()}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span className="t-sm truncate" style={{ display: 'block', fontWeight: 600 }}>
                    {f.reviewerName || 'Reviewer name'}
                  </span>
                  <span className="t-xs text-dim">
                    {f.country ? `${f.country} · ` : ''}
                    {f.reviewSource ? REVIEW_SOURCE_LABEL[f.reviewSource] ?? f.reviewSource : 'No source'}
                  </span>
                </span>
              </div>

              <div style={{ marginTop: 'var(--s3)' }}><StarsStatic rating={f.rating} /></div>
              {f.title && <div className="t-h3" style={{ marginTop: 'var(--s2)' }}>{f.title}</div>}
              <div className="rv-quote" style={{ marginTop: 'var(--s2)' }}>
                {f.review || <span className="text-faint">The review text appears here.</span>}
              </div>
              {(images.length > 0 || videos.length > 0) && (
                <div className="t-xs text-dim" style={{ marginTop: 'var(--s3)' }}>
                  {images.length} image{images.length === 1 ? '' : 's'} ·{' '}
                  {videos.length} video{videos.length === 1 ? '' : 's'}
                </div>
              )}

              {/* This endpoint publishes immediately — stated up front. */}
              <div className="oe-note warn" style={{ marginTop: 'var(--s4)' }}>
                <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>
                  External reviews are <strong>published immediately</strong>. They skip the
                  moderation queue, so this one goes live as soon as you publish it.
                </span>
              </div>

              {busy && (images.length > 0 || videos.length > 0) && (
                <div className="upload-prog-wrap" style={{ marginTop: 'var(--s4)' }}>
                  <div className="upload-prog-bar" style={{ width: `${progress}%` }} />
                </div>
              )}

              <Button variant="primary" size="lg" loading={busy} onClick={attempt}
                      style={{ width: '100%', marginTop: 'var(--s4)' }}>
                <Rocket size={15} /> {busy ? 'Publishing…' : 'Publish review'}
              </Button>
              <Button variant="ghost" size="sm" onClick={onDone} disabled={busy}
                      style={{ width: '100%', marginTop: 'var(--s2)' }}>
                Cancel
              </Button>
            </div>
          </section>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirming}
        title="Publish external review"
        message={`This publishes ${f.reviewerName.trim() || 'the review'}'s ${f.rating}-star review immediately — it does not go through moderation. Continue?`}
        confirmLabel="Publish now"
        busy={busy}
        onConfirm={publish}
        onCancel={() => setConfirming(false)}
      />

      {/* Guards against losing a part-written review on navigation. */}
      {dirty && !busy && <UnsavedGuard />}
    </div>
  );
}

/**
 * Native beforeunload prompt, so a part-written review survives an accidental
 * reload or tab close. useEffect, not useMemo — a memo's return value is a
 * cached value, never a cleanup, so the listener would leak and fire forever.
 */
function UnsavedGuard() {
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);
  return null;
}
