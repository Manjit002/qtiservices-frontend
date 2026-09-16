'use client';

import { useCallback, useState } from 'react';
import {
  Check, X, BadgeCheck, ExternalLink, ThumbsUp, Flag, FileText, ShieldQuestion,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { StarsStatic } from './RatingStars';
import { formatDate } from '@/lib/utils/format';
import { REVIEW_SOURCE_LABEL } from '@/types/review';
import type { ReviewResponseDTO } from '@/types';

interface Props {
  review: ReviewResponseDTO;
  onApprove: (id: number, remark: string) => Promise<void>;
  onReject: (id: number, remark: string) => Promise<void>;
  onVerify: (id: number) => Promise<void>;
  onOpenImage: (url: string) => void;
}

export function ReviewCard({ review: r, onApprove, onReject, onVerify, onOpenImage }: Props) {
  const [remark, setRemark] = useState('');
  const [busy, setBusy] = useState<'approve' | 'reject' | 'verify' | null>(null);
  const [confirmReject, setConfirmReject] = useState(false);

  const media = r.media ?? [];
  const images = media.filter((m) => m.mediaType === 'IMAGE');
  const others = media.filter((m) => m.mediaType !== 'IMAGE');
  // External reviews never have an order attached, so verification is hidden.
  const isExternal = r.reviewType === 'EXTERNAL';

  const run = useCallback(
    async (kind: 'approve' | 'reject' | 'verify', fn: () => Promise<void>) => {
      setBusy(kind);
      try { await fn(); } finally { setBusy(null); }
    },
    []
  );

  return (
    <>
      <article className="card rv-card">
        <div className="rv-top">
          <div className="rv-who">
            <span className="avatar avatar-lg" aria-hidden>
              {(r.reviewerName ?? '?').charAt(0).toUpperCase()}
            </span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span className="t-h3">{r.reviewerName ?? 'Anonymous'}</span>
                {r.verifiedPurchase && (
                  <Badge tone="success"><BadgeCheck size={11} /> Verified</Badge>
                )}
                {isExternal && <Badge tone="info">External</Badge>}
              </span>
              <span className="t-xs text-dim">
                {r.country ? `${r.country} · ` : ''}
                {REVIEW_SOURCE_LABEL[String(r.reviewSource ?? '')] ?? r.reviewSource ?? '—'}
              </span>
            </span>
          </div>
          <StarsStatic rating={r.rating} size={16} />
        </div>

        {r.title && (
          <div className="t-h3" style={{ marginTop: 'var(--s3)' }}>{r.title}</div>
        )}
        {r.review && <div className="rv-quote">{r.review}</div>}

        {media.length > 0 && (
          <div className="rv-media">
            {images.map((m, i) => (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                key={m.id ?? i}
                className="rv-thumb"
                src={m.thumbnailUrl || m.fileUrl}
                alt={`Photo from ${r.reviewerName ?? 'reviewer'}`}
                onClick={() => m.fileUrl && onOpenImage(m.fileUrl)}
              />
            ))}
            {others.map((m, i) => (
              <a key={m.id ?? i} className="rv-file" href={m.fileUrl ?? '#'}
                 target="_blank" rel="noopener noreferrer">
                <FileText size={13} />
                {String(m.mediaType ?? 'File').charAt(0) +
                  String(m.mediaType ?? 'file').slice(1).toLowerCase()}
              </a>
            ))}
          </div>
        )}

        <div className="rv-meta">
          <span>Submitted {r.createdAt ? formatDate(r.createdAt) : '—'}</span>
          {(r.helpfulCount ?? 0) > 0 && (
            <span><ThumbsUp size={11} style={{ verticalAlign: -1 }} /> {r.helpfulCount} helpful</span>
          )}
          {(r.reportCount ?? 0) > 0 && (
            <span style={{ color: 'var(--danger)' }}>
              <Flag size={11} style={{ verticalAlign: -1 }} /> {r.reportCount} reported
            </span>
          )}
          {r.sourceUrl && (
            <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer"
               style={{ color: 'var(--accent-text)', fontWeight: 600 }}>
              View original <ExternalLink size={10} style={{ display: 'inline', verticalAlign: -1 }} />
            </a>
          )}
        </div>

        <div className="fl" style={{ marginTop: 'var(--s4)', marginBottom: 0 }}>
          <label htmlFor={`remark-${r.id}`} className="visually-hidden">Admin remark</label>
          <input
            id={`remark-${r.id}`}
            className="fi"
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder="Admin remark (optional, internal note)"
            disabled={busy !== null}
          />
        </div>

        <div className="rv-actions">
          <Button variant="primary" loading={busy === 'approve'} disabled={busy !== null}
                  onClick={() => run('approve', () => onApprove(r.id, remark))}>
            <Check size={14} /> Approve
          </Button>
          <Button variant="danger" loading={busy === 'reject'} disabled={busy !== null}
                  onClick={() => setConfirmReject(true)}>
            <X size={14} /> Reject
          </Button>
          {!isExternal && (
            <Button loading={busy === 'verify'} disabled={busy !== null}
                    onClick={() => run('verify', () => onVerify(r.id))}
                    title="Check whether this review is linked to a real order">
              <ShieldQuestion size={14} /> Verify purchase
            </Button>
          )}
        </div>
      </article>

      <ConfirmDialog
        isOpen={confirmReject}
        title="Reject review"
        message="This review will not be published. Any admin remark you entered is saved with the decision."
        confirmLabel="Reject review"
        danger
        busy={busy === 'reject'}
        onConfirm={() => { setConfirmReject(false); void run('reject', () => onReject(r.id, remark)); }}
        onCancel={() => setConfirmReject(false)}
      />
    </>
  );
}
