'use client';

import { useEffect, useRef } from 'react';
import type { CommandItem } from '@/hooks/useCommandPalette';

interface CommandPaletteProps {
  isOpen: boolean;
  query: string;
  setQuery: (q: string) => void;
  items: CommandItem[];
  activeIndex: number;
  setActiveIndex: (i: number) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onClose: () => void;
}

export function CommandPalette({
  isOpen, query, setQuery, items, activeIndex, setActiveIndex, onKeyDown, onClose,
}: CommandPaletteProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="cmdk-overlay open"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="cmdk-box" role="dialog" aria-modal="true" aria-label="Command palette">
        <input
          ref={inputRef}
          className="cmdk-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Jump to…"
          aria-label="Search commands"
          role="combobox"
          aria-expanded="true"
          aria-controls="cmdk-list"
          aria-activedescendant={items[activeIndex] ? `cmdk-${items[activeIndex].id}` : undefined}
        />
        <div className="cmdk-list" id="cmdk-list" role="listbox">
          {items.length === 0 ? (
            <div className="cmdk-empty">No matches</div>
          ) : (
            items.map((item, i) => (
              <button
                key={item.id}
                id={`cmdk-${item.id}`}
                role="option"
                aria-selected={i === activeIndex}
                className={`cmdk-item${i === activeIndex ? ' active' : ''}`}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => {
                  item.action();
                  onClose();
                }}
                type="button"
              >
                <span className="cmdk-item-icon" aria-hidden="true">
                  <item.icon size={15} />
                </span>
                <span className="cmdk-item-label">{item.label}</span>
                {item.hint && <span className="cmdk-hint">{item.hint}</span>}
              </button>
            ))
          )}
        </div>
        <div className="cmdk-esc-hint">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}
