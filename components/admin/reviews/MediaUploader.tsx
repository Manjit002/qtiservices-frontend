'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Upload, Film, ImageIcon } from 'lucide-react';
import { formatBytes } from '@/lib/utils/format';

interface Props {
  kind: 'image' | 'video';
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
  maxBytes: number;
}

const ACCEPT = {
  image: 'image/jpeg,image/png,image/webp,image/gif',
  video: 'video/mp4,video/quicktime,video/webm',
};

/** Preview whose object URL is revoked on unmount — otherwise the file data
 *  stays alive for the lifetime of the tab. */
function Preview({ file, kind, onRemove }: { file: File; kind: 'image' | 'video'; onRemove: () => void }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  return (
    <div className="xr-prev">
      {url && kind === 'image' && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={url} alt={file.name} />
      )}
      {url && kind === 'video' && <video src={url} muted preload="metadata" />}
      {!url && <div className="xr-prev-file"><Film size={18} /></div>}
      <button type="button" className="xr-prev-x" onClick={onRemove}
              aria-label={`Remove ${file.name}`}>
        <X size={11} />
      </button>
      <div className="xr-prev-name" title={file.name}>{file.name}</div>
      <div className="xr-prev-name">{formatBytes(file.size)}</div>
    </div>
  );
}

export function MediaUploader({ kind, files, onChange, disabled, maxBytes }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState('');

  const add = useCallback(
    (list: FileList | null) => {
      if (!list) return;
      const ok: File[] = [];
      const problems: string[] = [];
      Array.from(list).forEach((f) => {
        if (!f.type.startsWith(`${kind}/`)) {
          problems.push(`${f.name} is not ${kind === 'image' ? 'an image' : 'a video'}.`);
        } else if (f.size > maxBytes) {
          problems.push(`${f.name} exceeds ${formatBytes(maxBytes)}.`);
        } else ok.push(f);
      });
      setError(problems.join(' '));
      if (ok.length) onChange([...files, ...ok]);
    },
    [kind, files, onChange, maxBytes]
  );

  return (
    <div>
      <button
        type="button"
        className={`xr-drop${over ? ' over' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files); }}
        disabled={disabled}
      >
        {kind === 'image' ? <ImageIcon size={18} /> : <Film size={18} />}
        <span>
          Drop {kind === 'image' ? 'images' : 'videos'} here, or click to browse
        </span>
        <span className="t-xs text-faint">Up to {formatBytes(maxBytes)} each</span>
      </button>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT[kind]}
        className="visually-hidden"
        aria-label={`Attach ${kind}s`}
        onChange={(e) => { add(e.target.files); e.target.value = ''; }}
      />

      {error && <div className="field-error" style={{ marginTop: 6 }}>{error}</div>}

      {files.length > 0 && (
        <>
          <div className="xr-previews">
            {files.map((f, i) => (
              <Preview key={`${f.name}-${f.size}-${i}`} file={f} kind={kind}
                       onRemove={() => onChange(files.filter((_, idx) => idx !== i))} />
            ))}
          </div>
          <button type="button" className="act" style={{ marginTop: 'var(--s2)' }}
                  onClick={() => onChange([])} disabled={disabled}>
            <X size={11} /> Clear all {kind}s
          </button>
        </>
      )}
    </div>
  );
}

export { Upload };
