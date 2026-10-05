'use client';

import { Search, X, ArrowRight, SearchX } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { fmtOrderId, fmtStudentId } from '@/lib/utils/format';
import type { OrderDTO } from '@/types';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSearch: () => void;
  onClear: () => void;
  results: OrderDTO[] | null;
  loading: boolean;
  error: string | null;
  onSelect: (order: OrderDTO) => void;
}

export function PaymentSearch({
  value, onChange, onSearch, onClear, results, loading, error, onSelect,
}: Props) {
  return (
    <section className="card" style={{ marginBottom: 'var(--s5)' }}>
      <div className="card-head">
        <div>
          <h2 className="t-h3">Find an order&rsquo;s payments</h2>
          <p className="t-xs text-dim" style={{ marginTop: 2 }}>
            Search by order ID, subject, student ID or student email
          </p>
        </div>
      </div>

      <div style={{ padding: 'var(--s5)' }}>
        <form className="stu-search" onSubmit={(e) => { e.preventDefault(); onSearch(); }} role="search">
          <div className="stu-search-field">
            <Search size={15} />
            <input
              className="input"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="OD-2417, 2417, student@example.com…"
              aria-label="Search orders by ID, subject, student ID or email"
              autoComplete="off"
            />
          </div>
          <Button type="submit" variant="primary" size="lg" loading={loading} disabled={!value.trim()}>
            {loading ? 'Searching' : 'Search'}
          </Button>
          {value && (
            <Button type="button" size="lg" onClick={onClear}>
              <X size={14} /> Clear
            </Button>
          )}
        </form>
      </div>

      {loading && (
        <div style={{ padding: '0 var(--s5) var(--s5)', display: 'grid', gap: 'var(--s2)' }}>
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} h={40} />)}
        </div>
      )}

      {error && <ErrorState message={error} onRetry={onSearch} />}

      {!loading && !error && results !== null && results.length === 0 && (
        <EmptyState
          icon={<SearchX size={18} />}
          title={`No orders match "${value}"`}
          hint="Try the numeric order ID, the student's ID, or their email address."
        />
      )}

      {!loading && results && results.length > 0 && (
        <div>
          {results.map((o) => (
            <button key={o.id} type="button" className="pv-hit" onClick={() => onSelect(o)}>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span className="ord-id">{fmtOrderId(o.id)}</span>
                <span className="t-sm truncate" style={{ display: 'block', marginTop: 1 }}>
                  {o.subject || 'Untitled order'}
                </span>
                <span className="t-xs text-dim truncate" style={{ display: 'block' }}>
                  {o.studentEmail || (o.studentId ? fmtStudentId(o.studentId) : '')}
                </span>
              </span>
              <span className="pv-hit-go">Select <ArrowRight size={11} style={{ display: 'inline', verticalAlign: -1 }} /></span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
