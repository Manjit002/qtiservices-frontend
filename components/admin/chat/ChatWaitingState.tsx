'use client';

/**
 * Waiting state for a conversation that is still connecting.
 *
 * Two presentations, chosen by whether history has loaded:
 *
 *   PENDING + no history → this full card, replacing the thread. Showing an
 *                          empty message list here would read as "this student
 *                          has never written", which is a different and wrong
 *                          statement.
 *   PENDING + history    → the slim ConnectionBanner instead, with the
 *                          messages left visible and readable.
 *
 * Announced as role="status" / aria-live="polite": a connection notice should
 * reach a screen reader without interrupting whatever is being read.
 */
export function ChatWaitingState({ label = 'Connecting to conversation…' }: { label?: string }) {
  return (
    <div className="ch-wait" role="status" aria-live="polite">
      <div className="ch-wait-card">
        <div className="ch-wait-ring" aria-hidden>
          <span className="ch-wait-dots">
            <i /><i /><i />
          </span>
        </div>
        <div className="ch-wait-label">{label}</div>
        <div className="ch-wait-sub">Messages will appear as soon as the connection is ready.</div>
      </div>
    </div>
  );
}
