/** Every failed load gets a message and a way out — never a stuck "Loading…". */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="error-state" role="alert">
      <span aria-hidden>⚠️ </span>
      {message}
      {onRetry && (
        <>
          {' — '}
          <button type="button" className="error-retry" onClick={onRetry}>Retry</button>
        </>
      )}
    </div>
  );
}
