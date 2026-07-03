import type { ReactElement } from 'react';

import { getCurrentMessages } from '../../../shared/i18n';

export interface StepperControlProps {
  label: string;
  displayValue: string;
  disabled?: boolean;
  dataAiId: string;
  onStep: (direction: 1 | -1) => void;
}

// `[-] 16px [+]` percent-intent stepper. Pure presentation: base capture,
// percent accumulation, and clamping live in utils/stepperMath.ts.
export function StepperControl({
  label,
  displayValue,
  disabled = false,
  dataAiId,
  onStep,
}: StepperControlProps): ReactElement {
  const messages = getCurrentMessages().visualEditor.quickToolbar;

  return (
    <div
      className="flex h-7 items-stretch overflow-hidden rounded-md border border-gray-600 bg-gray-950/80"
      title={label}
      data-ai-id={dataAiId}
    >
      <StepperButton
        ariaLabel={`${messages.decrease}: ${label}`}
        dataAiId={`${dataAiId}-decrease-button`}
        disabled={disabled}
        onClick={() => onStep(-1)}
      >
        −
      </StepperButton>
      <span
        className="flex min-w-[44px] items-center justify-center px-1 font-mono text-[11px] font-semibold text-gray-100"
        data-ai-id={`${dataAiId}-value-text`}
      >
        {displayValue}
      </span>
      <StepperButton
        ariaLabel={`${messages.increase}: ${label}`}
        dataAiId={`${dataAiId}-increase-button`}
        disabled={disabled}
        onClick={() => onStep(1)}
      >
        +
      </StepperButton>
    </div>
  );
}

function StepperButton({
  ariaLabel,
  dataAiId,
  disabled,
  onClick,
  children,
}: {
  ariaLabel: string;
  dataAiId: string;
  disabled: boolean;
  onClick: () => void;
  children: string;
}): ReactElement {
  return (
    <button
      type="button"
      className="flex w-6 shrink-0 items-center justify-center bg-gray-900 text-sm font-bold text-gray-200 transition hover:bg-blue-600/40 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 disabled:cursor-not-allowed disabled:text-gray-600"
      aria-label={ariaLabel}
      title={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      data-ai-id={dataAiId}
    >
      {children}
    </button>
  );
}
