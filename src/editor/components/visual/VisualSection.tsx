import {
  useEffect,
  useId,
  useState,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react';

import { getCurrentMessages } from '../../../shared/i18n';
import { useVisualSelectionStore } from '../../stores/useVisualSelectionStore';

export type VisualSectionProps = {
  title: string;
  dataAiId: string;
  children: ReactNode;
  actions?: ReactNode;
  disabled?: boolean;
  defaultOpen?: boolean;
  onReset?: () => void;
  resetLabel?: string;
  contentProps?: Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'id' | 'hidden' | 'data-ai-id'> & {
    [key: `data-${string}`]: string | number | boolean | undefined;
  };
};

// Collapsible panel section: a title-only header (no prose) with a body that
// re-collapses to its default whenever the selected target changes.
export function VisualSection({
  title,
  dataAiId,
  children,
  actions,
  disabled = false,
  defaultOpen = true,
  onReset,
  resetLabel,
  contentProps,
}: VisualSectionProps): ReactElement {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();
  const messages = getCurrentMessages().visualEditor.panel;
  const targetKey = useVisualSelectionStore((state) => targetKeyFromPanelTarget(state.panelTarget));

  useEffect(() => {
    setOpen(defaultOpen);
  }, [dataAiId, defaultOpen, targetKey]);

  const { className: extraContentClassName, ...contentAttributes } = contentProps ?? {};
  const contentClassName = [
    'space-y-3 border-t border-blue-500/20 bg-gray-950/25 p-4',
    extraContentClassName,
  ]
    .filter(Boolean)
    .join(' ');

  const sectionClassName = `relative rounded-xl border text-gray-200 transition duration-200 ${
    open
      ? 'overflow-visible border-blue-500/55 bg-gradient-to-br from-blue-950/35 via-gray-900/90 to-indigo-950/25 shadow-lg shadow-blue-950/20'
      : 'overflow-hidden border-gray-700/80 bg-gray-900/45 shadow-none hover:border-gray-600/90 hover:bg-gray-900/65'
  }`;

  const headerClassName = `flex items-stretch justify-between gap-2 overflow-hidden rounded-t-[11px] transition duration-200 ${
    open ? 'bg-blue-500/10' : 'bg-gray-950/10'
  }`;

  const tabButtonClassName = `flex min-w-0 flex-1 items-center gap-3 rounded-t-[11px] px-4 py-2.5 text-left transition focus:outline-none focus:ring-2 focus:ring-inset ${
    open ? 'hover:bg-blue-500/10 focus:ring-blue-500/50' : 'hover:bg-gray-800/70 focus:ring-gray-800/60'
  }`;

  const titleClassName = `block text-xs font-bold uppercase tracking-[0.1em] transition ${
    open ? 'text-blue-50' : 'text-gray-200'
  }`;

  const iconClassName = `flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition ${
    open
      ? 'border-blue-400/50 bg-blue-400/15 text-blue-100 shadow-sm shadow-blue-500/20 ring-1 ring-blue-300/20'
      : 'border-gray-700 bg-gray-950/60 text-gray-400'
  }`;

  const toggleTitle = open ? messages.sectionCollapse : messages.sectionExpand;

  return (
    <section
      className={sectionClassName}
      data-ai-id={dataAiId}
      data-ai-editor-visual-section-collapsible="1"
      data-ai-editor-visual-section-disabled={disabled ? '1' : '0'}
      data-ai-editor-visual-section-open={open ? '1' : '0'}
    >
      <div className={headerClassName} data-ai-id={`${dataAiId}-header`}>
        <button
          type="button"
          className={tabButtonClassName}
          aria-controls={contentId}
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          data-ai-id={`${dataAiId}-tab-button`}
        >
          <span className="min-w-0 flex-1" data-ai-id={`${dataAiId}-header-copy`}>
            <span className={titleClassName} data-ai-id={`${dataAiId}-title-text`}>
              {title}
            </span>
          </span>
          <span
            className={iconClassName}
            title={toggleTitle}
            data-ai-id={`${dataAiId}-tab-state-text`}
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden="true" data-ai-id={`${dataAiId}-tab-state-icon`}>
              <path
                d={open ? 'M5 12.5 10 7.5l5 5' : 'M5 7.5l5 5 5-5'}
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                data-ai-id={`${dataAiId}-tab-state-icon-path`}
              />
            </svg>
            <span className="sr-only" data-ai-id={`${dataAiId}-tab-state-label-text`}>
              {toggleTitle}
            </span>
          </span>
        </button>
        {actions || onReset ? (
          <div className="flex shrink-0 items-center gap-1.5 py-2.5 pr-4" data-ai-id={`${dataAiId}-actions`}>
            {actions}
            {onReset ? (
              <button
                type="button"
                className="rounded-md border border-gray-600 bg-gray-950/70 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-gray-300 transition hover:border-blue-500/40 hover:text-blue-200 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={disabled}
                onClick={onReset}
                data-ai-id={`${dataAiId}-reset-button`}
              >
                <span data-ai-id={`${dataAiId}-reset-button-label-text`}>{resetLabel ?? messages.sectionReset}</span>
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      <div
        {...contentAttributes}
        id={contentId}
        className={contentClassName}
        hidden={!open}
        data-ai-id={`${dataAiId}-content`}
      >
        {children}
      </div>
    </section>
  );
}

function targetKeyFromPanelTarget(target: ReturnType<typeof useVisualSelectionStore.getState>['panelTarget']): string {
  if (!target) {
    return '';
  }

  if (target.target.kind === 'ai-id') {
    return `ai-id:${target.target.aiId}:${target.target.instanceIndex}:${target.nodeId ?? ''}`;
  }

  return `fallback:${target.target.nodeId}:${target.target.selector}:${target.nodeId ?? ''}`;
}
