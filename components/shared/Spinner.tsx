export function Spinner({ size = 'md', onAccent = false }: { size?: 'sm' | 'md' | 'lg'; onAccent?: boolean }) {
  const cls = ['spinner', size === 'sm' ? 'spin-sm' : size === 'lg' ? 'lg' : '', onAccent ? 'on-accent' : '']
    .filter(Boolean)
    .join(' ');
  return <span className={cls} role="status" aria-label="Loading" />;
}
