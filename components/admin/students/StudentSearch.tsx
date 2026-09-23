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
}

export function StudentSearch({ value, onChange, onSearch, onClear, busy }: Props) {
  const kind = value.trim() ? classifyQuery(value).kind : null;

  return (
    <form
      className="stu-search"
      onSubmit={(e) => { e.preventDefault(); onSearch(); }}
      role="search"
    >
      <div className="stu-search-field">
        <Search size={15} />
        <input
          className="input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter Student ID or Email address…"
          aria-label="Search by student ID or email"
          disabled={busy}
          autoComplete="off"
        />
        {/* The input type is detected, and we say which — so the admin never has
            to guess which format the system wanted. */}
        {kind && (
          <span className="t-xs text-dim" style={{ display: 'block', marginTop: 5 }}>
            {kind === 'email' ? 'Searching by email address'
              : kind === 'stuid' ? 'Searching by student ID'
              : 'Searching all fields'}
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
