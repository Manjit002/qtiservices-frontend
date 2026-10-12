'use client';

import { useRef, useState } from 'react';
import { UploadCloud, X } from 'lucide-react';
import { FileTypeIcon } from '@/components/ui/FileTypeIcon';
import { formatBytes } from '@/lib/utils/format';
import type { QueuedUpload } from '@/types';

interface FileUploadQueueProps {
  queue: QueuedUpload[];
  onAdd: (files: FileList | null) => void;
  onRemove: (localId: string) => void;
  progress: number | null;
  disabled?: boolean;
  label?: string;
}

/** Drag-and-drop + click-to-browse queue with a real upload progress bar. */
export function FileUploadQueue({
  queue, onAdd, onRemove, progress, disabled, label = 'Drop files here, or click to browse',
}: FileUploadQueueProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const totalBytes = queue.reduce((n, u) => n + u.file.size, 0);

  return (
    <div>
      <div
        className={`dropzone${over ? ' over' : ''}`}
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (!disabled) onAdd(e.dataTransfer.files);
        }}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled || undefined}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!disabled) inputRef.current?.click();
          }
        }}
      >
        <UploadCloud size={20} aria-hidden />
        <span className="t-sm" style={{ fontWeight: 600, color: 'var(--text)' }}>{label}</span>
        <span className="t-xs text-faint">Any file type · several at once</span>
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          aria-label={label}
          onChange={(e) => {
            onAdd(e.target.files);
            e.target.value = ''; // allow re-selecting the same file
          }}
          disabled={disabled}
        />
      </div>

      {queue.length > 0 && (
        <>
          <div className="t-xs text-dim" style={{ marginTop: 'var(--s3)' }}>
            {queue.length} file{queue.length === 1 ? '' : 's'} · {formatBytes(totalBytes)}
          </div>
          <ul className="queue" style={{ listStyle: 'none', marginTop: 6 }}>
            {queue.map((u) => (
              <li key={u.localId} className="queue-item">
                <FileTypeIcon name={u.file.name} size={16} />
                <span className="name" title={u.file.name}>{u.file.name}</span>
                <span className="t-xs text-dim">{formatBytes(u.file.size)}</span>
                <button
                  type="button"
                  className="act act-icon"
                  onClick={() => onRemove(u.localId)}
                  aria-label={`Remove ${u.file.name}`}
                  disabled={disabled}
                >
                  <X size={13} />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {progress != null && (
        <div style={{ marginTop: 'var(--s3)' }}>
          <div className="t-xs text-dim" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span>Uploading…</span><span>{progress}%</span>
          </div>
          <div className="upload-prog-wrap" role="progressbar" aria-label="Upload progress" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <div className="upload-prog-bar" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}
