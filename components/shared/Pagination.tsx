'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Total item count, for the summary line. */
  total?: number;
  /** Noun for the summary line, e.g. "orders". */
  label?: string;
  /** Optional qualifier appended to the summary, e.g. the active filter. */
  suffix?: string;
  /** Replaces the generated summary entirely. */
  info?: string;
}

/** Page numbers to show: first, last, and a window around the current page. */
function windowed(page: number, total: number): (number | 'gap')[] {
  const out: (number | 'gap')[] = [];
  for (let i = 0; i < total; i++) {
    if (i === 0 || i === total - 1 || Math.abs(i - page) <= 1) out.push(i);
    else if (out[out.length - 1] !== 'gap') out.push('gap');
  }
  return out;
}

/**
 * Pager in the shared product style (`.pager` / `.pg-n`, as on admin Orders).
 * Props are unchanged from the earlier version, so callers did not move.
 */
export function Pagination({ page, totalPages, onPageChange, total, label = 'items', suffix, info }: PaginationProps) {
  const pages = Math.max(1, totalPages);
  const summary = info
    ?? `Page ${page + 1} of ${pages}${total != null ? ` · ${total.toLocaleString()} ${label}` : ''}${suffix ? ` · ${suffix.replace(/_/g, ' ').toLowerCase()}` : ''}`;

  return (
    <nav className="pager" aria-label="Pagination">
      <span className="t-xs text-dim">{summary}</span>
      {pages > 1 && (
        <div className="pager-nums">
          <button type="button" className="pg-n" onClick={() => onPageChange(page - 1)} disabled={page === 0} aria-label="Previous page">
            <ChevronLeft size={14} />
          </button>
          {windowed(page, pages).map((p, i) =>
            p === 'gap' ? (
              <span key={`g${i}`} className="t-xs text-faint" aria-hidden>…</span>
            ) : (
              <button
                key={p}
                type="button"
                className={`pg-n${p === page ? ' on' : ''}`}
                onClick={() => onPageChange(p)}
                aria-current={p === page ? 'page' : undefined}
                aria-label={`Page ${p + 1}`}
              >
                {p + 1}
              </button>
            )
          )}
          <button type="button" className="pg-n" onClick={() => onPageChange(page + 1)} disabled={page >= pages - 1} aria-label="Next page">
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </nav>
  );
}
