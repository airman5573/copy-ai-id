import type { ReactElement, ReactNode } from 'react';

export type VisualControlProps = {
  label: string;
  dataAiId: string;
  children: ReactNode;
  // Accepted for API compatibility but intentionally never rendered: the
  // redesigned panel keeps labels only, no helper prose.
  helperText?: string;
  errorText?: string;
  disabled?: boolean;
  actions?: ReactNode;
  layout?: 'stacked' | 'inline';
  leadingLabelControl?: ReactNode;
  inputWrapperClassName?: string;
};

export function VisualControl({
  label,
  dataAiId,
  children,
  helperText: _helperText,
  errorText,
  disabled = false,
  actions,
  layout = 'stacked',
  leadingLabelControl,
  inputWrapperClassName,
}: VisualControlProps): ReactElement {
  const inline = layout === 'inline';
  const headerClassName = inline
    ? 'flex w-20 shrink-0 items-center gap-1.5'
    : 'mb-1.5 flex items-center justify-between gap-2';
  const labelClassName = inline
    ? 'block min-w-0 flex-1 text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400'
    : 'block min-w-0 text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400';
  const resolvedInputWrapperClassName = [inline ? 'min-w-0 flex-1' : '', inputWrapperClassName ?? '']
    .filter(Boolean)
    .join(' ') || undefined;
  const actionControls = actions ? (
    <div className="flex shrink-0 items-center gap-1" data-ai-id={`${dataAiId}-actions`}>
      {actions}
    </div>
  ) : null;
  const body = (
    <>
      <div className={headerClassName} data-ai-id={`${dataAiId}-header`}>
        {leadingLabelControl ? (
          <span className="flex shrink-0 items-center justify-center text-gray-400" data-ai-id={`${dataAiId}-leading-label-control`}>
            {leadingLabelControl}
          </span>
        ) : null}
        <label className={labelClassName} data-ai-id={`${dataAiId}-label`}>
          <span data-ai-id={`${dataAiId}-label-text`}>{label}</span>
        </label>
        {inline ? null : actionControls}
      </div>
      <div className={resolvedInputWrapperClassName} data-ai-id={`${dataAiId}-input-wrapper`}>
        {children}
      </div>
      {inline ? actionControls : null}
    </>
  );

  return (
    <div
      className="min-w-0"
      data-ai-id={dataAiId}
      data-ai-editor-visual-control-disabled={disabled ? '1' : '0'}
    >
      {inline ? (
        <div className="flex min-w-0 items-center gap-2" data-ai-id={`${dataAiId}-inline-row`}>
          {body}
        </div>
      ) : (
        body
      )}
      {errorText ? (
        <p className="mt-1.5 text-[10px] leading-normal text-red-400" data-ai-id={`${dataAiId}-error-text`}>
          {errorText}
        </p>
      ) : null}
    </div>
  );
}

export function VisualResetButton({
  dataAiId,
  label = 'Reset',
  disabled = false,
  onClick,
}: {
  dataAiId: string;
  label?: string;
  disabled?: boolean;
  onClick?: () => void;
}): ReactElement {
  return (
    <button
      type="button"
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-gray-700 bg-gray-950/70 text-gray-500 transition hover:border-blue-500/40 hover:bg-blue-500/10 hover:text-blue-200 disabled:cursor-not-allowed disabled:opacity-50"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      title={label}
      data-ai-id={dataAiId}
    >
      <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" aria-hidden="true" data-ai-id={`${dataAiId}-icon`}>
        <path
          d="M16.25 10a6.25 6.25 0 1 1-1.83-4.42"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          data-ai-id={`${dataAiId}-icon-circle-path`}
        />
        <path
          d="M16.25 4.25v4h-4"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          data-ai-id={`${dataAiId}-icon-arrow-path`}
        />
      </svg>
      <span className="sr-only" data-ai-id={`${dataAiId}-label-text`}>{label}</span>
    </button>
  );
}
