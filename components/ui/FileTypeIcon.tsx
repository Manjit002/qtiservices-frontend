'use client';

import {
  File, FileArchive, FileImage, FileSpreadsheet, FileText, FileVideo, FileAudio, FileCode, Presentation,
} from 'lucide-react';
import { extensionOf } from '@/lib/utils/format';

/**
 * One icon set for file types, replacing the emoji (📕 📘 🖼) the file tiles
 * used. Colour carries the type at a glance the way the emoji did, but from
 * the product's own palette so it reads in both themes.
 */
const KINDS: { exts: string[]; Icon: typeof File; color: string; label: string }[] = [
  { exts: ['pdf'], Icon: FileText, color: 'var(--danger)', label: 'PDF' },
  { exts: ['doc', 'docx', 'rtf', 'odt', 'txt', 'md'], Icon: FileText, color: 'var(--info)', label: 'Document' },
  { exts: ['xls', 'xlsx', 'csv', 'ods'], Icon: FileSpreadsheet, color: 'var(--success)', label: 'Spreadsheet' },
  { exts: ['ppt', 'pptx', 'key', 'odp'], Icon: Presentation, color: 'var(--warning)', label: 'Presentation' },
  { exts: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'heic'], Icon: FileImage, color: 'var(--accent)', label: 'Image' },
  { exts: ['zip', 'rar', '7z', 'tar', 'gz'], Icon: FileArchive, color: 'var(--text-mid)', label: 'Archive' },
  { exts: ['mp4', 'mov', 'webm', 'avi', 'mkv'], Icon: FileVideo, color: 'var(--accent)', label: 'Video' },
  { exts: ['mp3', 'wav', 'm4a', 'ogg'], Icon: FileAudio, color: 'var(--accent)', label: 'Audio' },
  { exts: ['py', 'js', 'ts', 'java', 'c', 'cpp', 'cs', 'html', 'css', 'json', 'sql', 'ipynb', 'r'], Icon: FileCode, color: 'var(--info)', label: 'Code' },
];

export function fileKind(name: string | null | undefined) {
  const ext = extensionOf(name);
  return KINDS.find((k) => k.exts.includes(ext)) ?? { Icon: File, color: 'var(--text-dim)', label: 'File', exts: [] };
}

export function FileTypeIcon({ name, size = 18 }: { name: string | null | undefined; size?: number }) {
  const { Icon, color } = fileKind(name);
  return <Icon size={size} style={{ color, flexShrink: 0 }} aria-hidden />;
}
