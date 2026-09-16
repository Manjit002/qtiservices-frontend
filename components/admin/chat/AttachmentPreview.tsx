'use client';

import { useEffect, useState } from 'react';
import { X, FileText, FileSpreadsheet, FileType } from 'lucide-react';
import { formatBytes } from '@/lib/utils/format';

function iconFor(type: string) {
  if (type.includes('pdf')) return <FileType size={16} />;
  if (type.includes('sheet') || type.includes('excel')) return <FileSpreadsheet size={16} />;
  return <FileText size={16} />;
}

/**
 * One queued attachment. Images get a real thumbnail via an object URL, which
 * is revoked on unmount — leaking these keeps the file data alive for the
 * lifetime of the tab.
 */
export function AttachmentPreview({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [thumb, setThumb] = useState<string | null>(null);
  const isImage = file.type.startsWith('image/');

  useEffect(() => {
    if (!isImage) return;
    const url = URL.createObjectURL(file);
    setThumb(url);
    return () => URL.revokeObjectURL(url);
  }, [file, isImage]);

  return (
    <div className="ch-att">
      {isImage && thumb ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img className="ch-att-thumb" src={thumb} alt="" />
      ) : (
        <span className="ch-att-icon" aria-hidden>{iconFor(file.type)}</span>
      )}
      <span className="ch-att-meta">
        <span className="ch-att-name" title={file.name}>{file.name}</span>
        <span className="ch-att-size">{formatBytes(file.size)}</span>
      </span>
      <button type="button" className="ch-att-rm" onClick={onRemove}
              aria-label={`Remove ${file.name}`}>
        <X size={12} />
      </button>
    </div>
  );
}
