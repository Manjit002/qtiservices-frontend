'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  /** Rendered in the footer row. */
  footer?: ReactNode;
  /** Clicking the dim overlay closes. Off for destructive/confirm dialogs. */
  closeOnOverlay?: boolean;
  maxWidth?: string;
  labelledBy?: string;
}

/**
 * One modal implementation for the whole app.
 *
 * Handles Escape, overlay click, body scroll-lock, focus capture and restore,
 * and a focus trap. The legacy dashboard repeated this per modal (nine of them)
 * with the accessibility parts missing.
 */
export function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  closeOnOverlay = true,
  maxWidth = '620px',
  labelledBy,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  /* `document` does not exist during SSR, so the portal waits for mount.
     Without this the server render throws instead of producing markup. */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    /**
     * `mounted` is in the guard AND the deps because the panel only exists once
     * the portal has rendered. A dialog that is open on its very first render
     * would otherwise run this while `panelRef.current` is still null, focus
     * nothing, and never retry — `isOpen` has not changed, so the effect would
     * not fire again.
     */
    if (!isOpen || !mounted) return;

    restoreFocusRef.current = document.activeElement as HTMLElement | null;

    // Scroll-lock without layout shift: replace the scrollbar's width with padding.
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    const prevOverflow = document.body.style.overflow;
    const prevPadding = document.body.style.paddingRight;
    document.body.style.overflow = 'hidden';
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;

    // Focus the first focusable element inside the panel.
    const t = setTimeout(() => {
      const focusable = panelRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      (focusable ?? panelRef.current)?.focus();
    }, 20);

    return () => {
      clearTimeout(t);
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPadding;
      restoreFocusRef.current?.focus?.();
    };
  }, [isOpen, mounted]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;

      const nodes = panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!nodes || nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (!first || !last) return;

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose]
  );

  if (!isOpen || !mounted) return null;

  /**
   * Rendered into <body> rather than in place.
   *
   * A `position: fixed` overlay is only viewport-fixed while no ancestor
   * creates a containing block — and a transform, filter, backdrop-filter,
   * perspective, will-change or contain on ANY wrapper does exactly that. Every
   * admin panel root carries `.rise`, which animates `transform`, so a dialog
   * opened inside one is sized and clipped to the panel instead of the window.
   *
   * Portalling removes the whole class of failure: nothing between the dialog
   * and <body> can contain, clip or stack above it, whatever styling a future
   * wrapper picks up. FileLightbox already did this; Modal did not, which is
   * why it was the one that broke.
   */
  return createPortal(
    <div
      className="modal-overlay open"
      onMouseDown={(e) => {
        if (closeOnOverlay && e.target === e.currentTarget) onClose();
      }}
      onKeyDown={onKeyDown}
    >
      <div
        ref={panelRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        style={{ maxWidth }}
      >
        {title !== undefined && (
          <div className="modal-head">
            <div className="modal-title" id={labelledBy}>
              {title}
            </div>
            <button className="modal-close" onClick={onClose} aria-label="Close dialog" type="button">
              ✕
            </button>
          </div>
        )}
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
