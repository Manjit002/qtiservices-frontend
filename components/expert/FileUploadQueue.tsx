'use client';

import { useRef } from 'react';
import { fileExtension, fileIcon, formatBytes } from '@/lib/utils/format';
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
export function FileUploadQueue({ queue, onAdd, onRemove, progress, disabled, label = 'Drop files here or click to browse' }: FileUploadQueueProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  return (
    <div>
      <div
        ref={dropRef}
        className="file-drop"
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          dropRef.current?.classList.add('over');
        }}
        onDragLeave={() => dropRef.current?.classList.remove('over')}
        onDrop={(e) => {
          e.preventDefault();
          dropRef.current?.classList.remove('over');
          if (!disabled) onAdd(e.dataTransfer.files);
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        aria-label={label}
      >
        <div style={{ fontSize: '1.8rem', marginBottom: 8, opacity: 0.6 }} aria-hidden>📤</div>
        <div style={{ fontSize: '.84rem', fontWeight: 600 }}>{label}</div>
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            onAdd(e.target.files);
            e.target.value = ''; // allow re-selecting the same file
          }}
          disabled={disabled}
        />
      </div>

      {queue.length > 0 && (
        <ul style={{ listStyle: 'none', marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {queue.map((u) => (
            <li key={u.localId} className="fq-item">
              <span aria-hidden>{fileIcon(fileExtension(u.file.name))}</span>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {u.file.name}
              </span>
              <span style={{ fontSize: '.72rem', color: 'var(--muted)' }}>{formatBytes(u.file.size)}</span>
              <button
                type="button"
                onClick={() => onRemove(u.localId)}
                aria-label={`Remove ${u.file.name}`}
                style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: '1rem' }}
                disabled={disabled}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {progress != null && (
        <div className="upload-prog-wrap" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="upload-prog-bar" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}
