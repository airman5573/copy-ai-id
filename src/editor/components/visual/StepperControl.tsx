import { useEffect, useRef, useState, type ReactElement } from 'react';

import { parseStepperInputValue } from '../../utils/stepperMath';
import { selectTextInputValue } from './inputSelection';

// Typed values apply after a short pause instead of per keystroke, so a
// partially typed number (the "1" of "16") never hits the preview layout.
export const STEPPER_INPUT_COMMIT_DELAY_MS = 600;

export interface StepperControlProps {
  label: string;
  displayValue: string;
  disabled?: boolean;
  dataAiId: string;
  onStep: (direction: 1 | -1) => void;
  // Typed-value commit (px for lengths, percentage points for opacity).
  // When provided, the value text becomes a directly editable input.
  onCommitValue?: (value: number) => void;
}

// `[-] 16px [+]` percent-intent stepper. Pure presentation: base capture,
// percent accumulation, and clamping live in utils/stepperMath.ts. No hover
// tooltips by design — meaning comes from the visible label next to it.
export function StepperControl({
  label,
  displayValue,
  disabled = false,
  dataAiId,
  onStep,
  onCommitValue,
}: StepperControlProps): ReactElement {
  return (
    <div
      className="flex h-7 items-stretch overflow-hidden rounded-md border border-gray-600 bg-gray-950/80"
      data-ai-id={dataAiId}
    >
      <StepperButton
        ariaLabel={`줄이기: ${label}`}
        dataAiId={`${dataAiId}-decrease-button`}
        disabled={disabled}
        onClick={() => onStep(-1)}
      >
        −
      </StepperButton>
      {onCommitValue ? (
        <StepperValueInput
          label={label}
          displayValue={displayValue}
          disabled={disabled}
          dataAiId={dataAiId}
          onCommitValue={onCommitValue}
        />
      ) : (
        <span
          className="flex min-w-[44px] items-center justify-center px-1 font-mono text-[11px] font-semibold text-gray-100"
          data-ai-id={`${dataAiId}-value-text`}
        >
          {displayValue}
        </span>
      )}
      <StepperButton
        ariaLabel={`늘리기: ${label}`}
        dataAiId={`${dataAiId}-increase-button`}
        disabled={disabled}
        onClick={() => onStep(1)}
      >
        +
      </StepperButton>
    </div>
  );
}

// While focused the input shows a local draft so incoming snapshot updates
// (including the ones triggered by our own debounced commits) don't clobber
// what the user is typing. Escape only reverts the draft — values already
// committed by the debounce stay applied (undo handles those).
function StepperValueInput({
  label,
  displayValue,
  disabled,
  dataAiId,
  onCommitValue,
}: {
  label: string;
  displayValue: string;
  disabled: boolean;
  dataAiId: string;
  onCommitValue: (value: number) => void;
}): ReactElement {
  const [draft, setDraft] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const lastCommittedRef = useRef<string | null>(null);
  // Escape must not let the blur it triggers flush the cancelled draft — the
  // blur handler still closes over the pre-cancel draft state.
  const cancelledRef = useRef(false);

  const cancelPendingCommit = (): void => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => cancelPendingCommit, []);

  const commitText = (text: string): void => {
    if (text === lastCommittedRef.current) {
      return;
    }

    const value = parseStepperInputValue(text);
    if (value === null) {
      return;
    }

    lastCommittedRef.current = text;
    onCommitValue(value);
  };

  const scheduleCommit = (text: string): void => {
    cancelPendingCommit();
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      commitText(text);
    }, STEPPER_INPUT_COMMIT_DELAY_MS);
  };

  const flushCommit = (text: string): void => {
    cancelPendingCommit();
    commitText(text);
  };

  const shown = draft ?? displayValue;

  return (
    <input
      type="text"
      inputMode="decimal"
      className="min-w-[44px] bg-transparent px-1 text-center font-mono text-[11px] font-semibold text-gray-100 outline-none transition focus:bg-blue-500/15 disabled:cursor-not-allowed disabled:text-gray-600"
      style={{ width: `${Math.max(shown.length, 4)}ch` }}
      value={shown}
      disabled={disabled}
      aria-label={`직접 입력: ${label}`}
      data-ai-id={`${dataAiId}-value-text`}
      onFocus={(event) => {
        lastCommittedRef.current = null;
        setDraft(displayValue);
        selectTextInputValue(event.currentTarget);
      }}
      onChange={(event) => {
        const text = event.currentTarget.value;
        setDraft(text);
        scheduleCommit(text);
      }}
      onBlur={() => {
        if (!cancelledRef.current && draft !== null) {
          flushCommit(draft);
        }
        cancelledRef.current = false;
        setDraft(null);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          event.currentTarget.blur();
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          cancelPendingCommit();
          cancelledRef.current = true;
          setDraft(null);
          event.currentTarget.blur();
        }
      }}
    />
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
      disabled={disabled}
      onClick={onClick}
      data-ai-id={dataAiId}
    >
      {children}
    </button>
  );
}
