'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, UserX } from 'lucide-react';
import { Skeleton, EmptyState, ErrorState } from '@/components/ui/States';
import type { EmployeeDTO } from '@/types';

interface Props {
  experts: EmployeeDTO[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  selectedId: number | null;
  onSelect: (id: number) => void;
  /**
   * Orders currently attached to each expert, derived from the order records
   * already on screen. The API exposes no workload figure, so this is a real
   * count over a known sample rather than an invented metric.
   */
  workload: Map<string, number>;
  workloadNote: string;
  disabled?: boolean;
}

export function ExpertSelector({
  experts, loading, error, onRetry, selectedId, onSelect, workload, workloadNote, disabled,
}: Props) {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return experts;
    return experts.filter(
      (e) => (e.name ?? '').toLowerCase().includes(q) || (e.email ?? '').toLowerCase().includes(q)
    );
  }, [experts, query]);

  useEffect(() => setCursor(0), [query]);

  /** Arrow keys move a cursor; Enter commits it. Selection stays explicit. */
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!rows.length) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setCursor((c) => Math.min(c + 1, rows.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setCursor((c) => Math.max(c - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const pick = rows[cursor];
        if (pick) onSelect(pick.id);
      }
    },
    [rows, cursor, onSelect]
  );

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('.ep-item.cursor')
      ?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  return (
    <div>
      <div className="ep-search">
        <Search size={14} />
        <input
          className="fi"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search experts by name or email…"
          aria-label="Search experts"
          disabled={disabled || loading}
          autoComplete="off"
        />
        {query && (
          <button type="button" className="clear" onClick={() => setQuery('')}
                  aria-label="Clear expert search">
            <X size={12} />
          </button>
        )}
      </div>

      {loading && (
        <div className="ep-list">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} h={46} />)}
        </div>
      )}

      {error && <ErrorState message={error} onRetry={onRetry} />}

      {!loading && !error && experts.length === 0 && (
        <EmptyState
          icon={<UserX size={18} />}
          title="No experts are available"
          hint="Everyone is busy or offline. Availability is set by each expert on their own profile."
        />
      )}

      {!loading && !error && experts.length > 0 && rows.length === 0 && (
        <EmptyState title="No experts match" hint="Try a different name or email." />
      )}

      {rows.length > 0 && (
        <div className="ep-list" ref={listRef} role="radiogroup" aria-label="Available experts">
          {rows.map((e, i) => {
            const key = (e.name ?? e.email ?? '').trim();
            const load = workload.get(key) ?? 0;
            const on = selectedId === e.id;
            return (
              <button
                key={e.id}
                type="button"
                role="radio"
                aria-checked={on}
                className={`ep-item${on ? ' on' : ''}${i === cursor ? ' cursor' : ''}`}
                onClick={() => onSelect(e.id)}
                onMouseEnter={() => setCursor(i)}
                disabled={disabled}
              >
                <span className="ep-radio" aria-hidden />
                <span className="avatar" aria-hidden>
                  {(e.name ?? e.email ?? '?').charAt(0).toUpperCase()}
                </span>
                <span className="ep-main">
                  <span className="ep-name truncate" style={{ display: 'block' }}>
                    {e.name ?? e.email ?? `Employee ${e.id}`}
                  </span>
                  <span className="ep-meta truncate" style={{ display: 'block' }}>
                    {e.email ?? ''}
                  </span>
                </span>
                <span className="ep-load">
                  <span className="badge badge-success" style={{ marginBottom: 3 }}>
                    <span className="dot" /> Available
                  </span>
                  <span style={{ display: 'block' }}>
                    {load > 0 ? `${load} active` : 'no active orders'}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {rows.length > 0 && (
        <p className="t-xs text-faint" style={{ marginTop: 'var(--s2)' }}>
          {workloadNote}
        </p>
      )}
    </div>
  );
}
