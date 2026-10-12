'use client';

import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { classifyQuery } from '@/lib/api/students';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSearch: () => void;
  onClear: () => void;
  busy: boolean;
  /** Shown under the field when the last submit was rejected before any request. */
  validation?: string | null;
}

export function StudentSearch({ value, onChange, onSearch, onClear, busy, validation = null }: Props) {
  const check = value.trim() ? classifyQuery(value) : null;

  return (
    <form
      className="stu-search"
      onSubmit={(e) => { e.preventDefault(); onSearch(); }}
      role="search"
    >
      <div className="stu-search-field">
        <Search size={15} />
        <input
          className={`input${validation ? ' invalid' : ''}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          // The Search button is disabled while the field is empty, which also
          // blocks Enter; handle it here so an empty Enter still explains why.
          onKeyDown={(e) => { if (e.key === 'Enter' && !value.trim()) { e.preventDefault(); onSearch(); } }}
          placeholder="Enter Student ID or Email address…"
          aria-label="Search by student ID or email"
          aria-invalid={Boolean(validation)}
          aria-describedby={validation ? 'stu-search-msg' : undefined}
          disabled={busy}
          autoComplete="off"
        />
        {/* The input type is detected, and we say which — so the admin never has
            to guess which format the system wanted. */}
        {validation ? (
          <span id="stu-search-msg" className="field-error" role="alert" style={{ display: 'block', marginTop: 5 }}>
            {validation}
          </span>
        ) : check && (
          <span className="t-xs text-dim" style={{ display: 'block', marginTop: 5 }}>
            {check.kind === 'email' ? 'Searching by email address'
              : check.kind === 'id' ? 'Searching by student ID'
              : 'Enter a numeric student ID or an email address'}
          </span>
        )}
      </div>

      <Button type="submit" variant="primary" size="lg" loading={busy} disabled={!value.trim()}>
        {busy ? 'Searching' : 'Search'}
      </Button>
      {value && (
        <Button type="button" size="lg" onClick={onClear} disabled={busy}>
          <X size={14} /> Clear
        </Button>
      )}
    </form>
  );
}
