'use client';

import { STEPPER_FLOWS, activeStepIndex } from '@/lib/utils/statusConfig';
import type { OrderStatus, StepperFlow } from '@/types';

/**
 * Role-specific progress stepper. The three flows differ — student, admin and
 * expert see different milestones — so the flow must be passed explicitly
 * rather than defaulting to one generic sequence.
 */
export function StatusStepper({
  status,
  flow = 'admin',
}: {
  status: OrderStatus | null | undefined;
  flow?: StepperFlow;
}) {
  const steps = STEPPER_FLOWS[flow];

  if (String(status) === 'CANCELLED') {
    return (
      <div style={{ textAlign: 'center', fontSize: '.8rem', color: 'var(--red)', padding: 12 }}>
        🚫 Cancelled
      </div>
    );
  }

  const active = activeStepIndex(status, steps);

  return (
    <div className="stepper" role="list" aria-label="Order progress">
      {steps.map((step, i) => {
        const state = active >= 0 && i < active ? 'done' : i === active ? 'active' : '';
        return (
          <div key={step.k} style={{ display: 'contents' }}>
            <div
              className={`step ${state}`}
              role="listitem"
              aria-current={state === 'active' ? 'step' : undefined}
            >
              <div className="step-dot" aria-hidden="true">
                {state === 'done' ? '✓' : step.i}
              </div>
              <div className="step-label">{step.l}</div>
            </div>
            {i < steps.length - 1 && (
              <div className={`step-line ${state === 'done' ? 'done' : ''}`} aria-hidden="true" />
            )}
          </div>
        );
      })}
    </div>
  );
}
