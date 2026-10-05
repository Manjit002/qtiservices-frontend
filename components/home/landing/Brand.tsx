import Link from 'next/link';

/** The QTI mark — identical in the header and footer, so it lives in one place. */
export function Brand({ inverted = false }: { inverted?: boolean }) {
  return (
    <Link href="/" className="lp-logo" aria-label="QTIServices home">
      <span className="lp-logo-box" aria-hidden><span>QTI</span></span>
      <span className="lp-logo-text">
        <strong style={inverted ? { color: '#fff' } : undefined}>QTIServices</strong>
        <small style={inverted ? { color: 'rgba(255,255,255,.4)' } : undefined}>
          Quality · Technology · Integration
        </small>
      </span>
    </Link>
  );
}
