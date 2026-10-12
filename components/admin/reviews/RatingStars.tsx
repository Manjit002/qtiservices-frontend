'use client';

import { Star } from 'lucide-react';

/** Read-only rating. Always paired with the numeric value for screen readers. */
export function StarsStatic({ rating, size = 14 }: { rating?: number | null; size?: number }) {
  const n = Math.round(rating ?? 0);
  return (
    <span className="stars" role="img" aria-label={`${n} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          aria-hidden
          fill={i <= n ? 'var(--warning)' : 'none'}
          color={i <= n ? 'var(--warning)' : 'var(--text-faint)'}
        />
      ))}
    </span>
  );
}

/** Interactive selector. Arrow keys work, so it is usable without a mouse. */
export function StarsInput({
  value, onChange, disabled,
}: { value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <span
      className="stars"
      role="radiogroup"
      aria-label="Rating"
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
          e.preventDefault();
          onChange(Math.min(5, value + 1));
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
          e.preventDefault();
          onChange(Math.max(1, value - 1));
        }
      }}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={value === i}
          aria-label={`${i} star${i > 1 ? 's' : ''}`}
          className={`star-btn${i <= value ? ' on' : ''}`}
          disabled={disabled}
          tabIndex={value === i || (value === 0 && i === 1) ? 0 : -1}
          onClick={() => onChange(i)}
        >
          <Star size={24} fill={i <= value ? 'var(--warning)' : 'none'} />
        </button>
      ))}
    </span>
  );
}
