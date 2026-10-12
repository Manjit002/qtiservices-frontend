'use client';

/* eslint-disable @next/next/no-img-element --
   Previews are short-lived pre-signed S3 URLs. next/image would require the
   bucket host in remotePatterns and would proxy/cache a credentialed URL that
   expires; a plain <img> is the correct primitive for this case. */

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { isImageFile } from '@/lib/utils/format';

interface FileLightboxProps {
  url: string | null;
  name?: string;
  onClose: () => void;
}

/** Full-screen preview: images inline, everything else in an iframe (PDFs etc). */
export function FileLightbox({ url, name, onClose }: FileLightboxProps) {
  useEffect(() => {
    if (!url) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [url, onClose]);

  if (!url || typeof document === 'undefined') return null;

  return createPortal(
    <div className="lightbox" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <button type="button" className="lightbox-close" onClick={onClose} aria-label="Close preview">×</button>
      {isImageFile(name) ? (
        <img src={url} alt={name ? `Preview of ${name}` : 'File preview'} />
      ) : (
        <iframe src={url} title={name ? `Preview of ${name}` : 'File preview'} style={{ width: '90vw', height: '85vh' }} />
      )}
    </div>,
    document.body,
  );
}
