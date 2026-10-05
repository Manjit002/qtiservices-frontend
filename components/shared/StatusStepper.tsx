'use client';

import { Check, Ban } from 'lucide-react';
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
      <div className="t-sm" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--danger)', padding: 'var(--s3)' }}>
        <Ban size={14} aria-hidden /> This order was cancelled.
      </div>
    );
  }

  const active = activeStepIndex(status, steps);

  return (
    <ol className="flow" aria-label="Order progress" style={{ listStyle: 'none', margin: 0 }}>
      {steps.map((step, i) => {
        const state = active >= 0 && i < active ? 'done' : i === active ? 'now' : '';
        return (
          <li key={step.k} style={{ display: 'contents' }}>
            <div className={`flow-step ${state}`} aria-current={state === 'now' ? 'step' : undefined}>
              <div className="flow-dot" aria-hidden="true">
                {state === 'done' ? <Check size={12} strokeWidth={3} /> : i + 1}
              </div>
              <div className="flow-label">{step.l}</div>
            </div>
            {i < steps.length - 1 && <div className={`flow-line${state === 'done' ? ' done' : ''}`} aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}
