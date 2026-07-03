import type { ReactElement, ReactNode } from 'react';

export interface SegmentOption {
  value: string;
  label: ReactNode;
  // Screen-reader name for icon-only labels. No visual tooltip is rendered —
  // the toolbar is designed to be self-explanatory without hover hints.
  ariaLabel?: string;
}

export interface SegmentControlProps {
  options: readonly SegmentOption[];
  value: string | null;
  ariaLabel: string;
  disabled?: boolean;
  dataAiId: string;
  onChange: (value: string) => void;
}

// Compact segmented buttons for discrete values (text-align, object-fit, …).
export function SegmentControl({
  options,
  value,
  ariaLabel,
  disabled = false,
  dataAiId,
  onChange,
}: SegmentControlProps): ReactElement {
  return (
    <div
      className="flex h-7 items-stretch overflow-hidden rounded-md border border-gray-600 bg-gray-950/80"
      role="group"
      aria-label={ariaLabel}
      data-ai-id={dataAiId}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            className={`flex min-w-6 items-center justify-center px-1.5 text-[11px] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 ${
              active
                ? 'bg-blue-600/50 text-white'
                : 'bg-gray-900 text-gray-300 hover:bg-gray-800 hover:text-gray-100'
            }`}
            aria-pressed={active}
            aria-label={option.ariaLabel ?? undefined}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            data-ai-id={`${dataAiId}-${option.value}-button`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
