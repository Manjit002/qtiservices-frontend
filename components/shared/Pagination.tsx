'use client';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Total row count across all pages, shown in the info line. */
  total?: number;
  /** Noun for the info line, e.g. "orders" / "files". */
  label?: string;
  /** Extra qualifier appended to the info line, e.g. the active status filter. */
  suffix?: string;
  /** Fully custom info line — overrides total/label/suffix when provided. */
  info?: string;
}

/** Numbered pager with a sliding window, matching the legacy renderPgNumbers. */
export function Pagination({
  page, totalPages, onPageChange, total, label = 'items', suffix, info,
}: PaginationProps) {
  const infoLine =
    info ??
    (total === undefined
      ? `Page ${page + 1} of ${totalPages}`
      : `Page ${page + 1} of ${totalPages} (${total} ${label}${suffix ? ` · ${suffix}` : ''})`);

  if (totalPages <= 1 && total === undefined && !info) return null;

  const windowSize = 5;
  let start = Math.max(0, page - Math.floor(windowSize / 2));
  const end = Math.min(totalPages, start + windowSize);
  start = Math.max(0, end - windowSize);
  const pages = Array.from({ length: end - start }, (_, i) => start + i);

  return (
    <div className="pg-row">
      <div className="pg-info">{infoLine}</div>
      <nav className="pg-btns" aria-label="Pagination">
        <button
          className="pg-btn"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 0}
          aria-label="Previous page"
          type="button"
        >
          ‹ Prev
        </button>

        {start > 0 && (
          <button className="pg-number" onClick={() => onPageChange(0)} type="button">
            1
          </button>
        )}
        {start > 1 && <span className="pg-ellipsis">…</span>}

        {pages.map((p) => (
          <button
            key={p}
            className={`pg-number${p === page ? ' current' : ''}`}
            onClick={() => onPageChange(p)}
            aria-current={p === page ? 'page' : undefined}
            aria-label={`Page ${p + 1}`}
            type="button"
          >
            {p + 1}
          </button>
        ))}

        {end < totalPages - 1 && <span className="pg-ellipsis">…</span>}
        {end < totalPages && (
          <button className="pg-number" onClick={() => onPageChange(totalPages - 1)} type="button">
            {totalPages}
          </button>
        )}

        <button
          className="pg-btn"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages - 1}
          aria-label="Next page"
          type="button"
        >
          Next ›
        </button>
      </nav>
    </div>
  );
}
