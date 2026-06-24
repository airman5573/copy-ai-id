import {
  useEffect,
  useId,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react';

import { useFloatingVisualPanelStore } from '../../stores/useFloatingVisualPanelStore';
import { useSectionJumpStore } from '../../stores/useSectionJumpStore';
import type { VisualPanelSectionId } from './sectionJump';

const JUMP_FOCUS_DELAY_MS = 150;
const JUMP_FLASH_DURATION_MS = 1200;
const JUMP_FOCUSABLE_SELECTOR =
  'input:not([type="hidden"]):not(:disabled), textarea:not(:disabled), select:not(:disabled), button:not(:disabled), [contenteditable="true"]';

export type VisualSectionProps = {
  title: string;
  description?: string;
  dataAiId: VisualPanelSectionId | string;
  children: ReactNode;
  actions?: ReactNode;
  disabled?: boolean;
  defaultOpen?: boolean;
  onReset?: () => void;
  resetLabel?: string;
  hasResponsiveIndicator?: boolean;
  contentProps?: Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'id' | 'hidden' | 'data-ai-id'> & {
    [key: `data-${string}`]: string | number | boolean | undefined;
  };
};

export function VisualSection({
  title,
  description,
  dataAiId,
  children,
  actions,
  disabled = false,
  defaultOpen = true,
  onReset,
  resetLabel = '초기화',
  hasResponsiveIndicator = false,
  contentProps,
}: VisualSectionProps): ReactElement {
  const [open, setOpen] = useState(defaultOpen);
  const [flash, setFlash] = useState(false);
  const sectionRef = useRef<HTMLElement | null>(null);
  const contentId = useId();
  const targetKey = useFloatingVisualPanelStore((state) => targetKeyFromPanelTarget(state.target));
  const jumpRequest = useSectionJumpStore((state) => (
    state.pendingJump?.sectionId === dataAiId ? state.pendingJump : null
  ));

  useEffect(() => {
    setOpen(defaultOpen);
  }, [dataAiId, defaultOpen, targetKey]);

  useEffect(() => {
    if (!jumpRequest) {
      return undefined;
    }

    setOpen(true);
    setFlash(true);

    const section = sectionRef.current;
    const scrollFrame = window.requestAnimationFrame(() => {
      section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    const focusTimer = window.setTimeout(() => {
      section?.querySelector<HTMLElement>(JUMP_FOCUSABLE_SELECTOR)?.focus({ preventScroll: true });
    }, JUMP_FOCUS_DELAY_MS);
    const doneTimer = window.setTimeout(() => {
      useSectionJumpStore.getState().consumeSectionJump(jumpRequest.id);
      setFlash(false);
    }, JUMP_FLASH_DURATION_MS);

    return () => {
      window.cancelAnimationFrame(scrollFrame);
      window.clearTimeout(focusTimer);
      window.clearTimeout(doneTimer);
      setFlash(false);
    };
  }, [dataAiId, jumpRequest]);

  useEffect(() => () => {
    const pending = useSectionJumpStore.getState().pendingJump;
    if (pending?.sectionId === dataAiId) {
      useSectionJumpStore.getState().consumeSectionJump(pending.id);
    }
  }, [dataAiId]);

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
      : 'overflow-hidden border-gray-800/80 bg-gray-900/45 shadow-none hover:border-gray-700/90 hover:bg-gray-900/65'
  } ${flash ? 'ring-2 ring-blue-400/70' : ''}`;

  const headerClassName = `flex items-stretch justify-between gap-2 overflow-hidden rounded-t-[11px] transition duration-200 ${
    open ? 'bg-blue-500/10' : 'bg-gray-950/10'
  }`;

  const tabButtonClassName = `flex min-w-0 flex-1 items-center gap-3 rounded-t-[11px] px-4 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-inset ${
    open ? 'hover:bg-blue-500/10 focus:ring-blue-500/50' : 'hover:bg-gray-800/70 focus:ring-gray-800/60'
  }`;

  const titleClassName = `block text-xs font-bold uppercase tracking-[0.1em] transition ${
    open ? 'text-blue-50' : 'text-gray-200'
  }`;

  const descriptionClassName = `mt-1 block text-xs leading-normal transition ${
    open ? 'text-blue-100/75' : 'text-gray-400'
  }`;

  const iconClassName = `flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition ${
    open
      ? 'border-blue-400/50 bg-blue-400/15 text-blue-100 shadow-sm shadow-blue-500/20 ring-1 ring-blue-300/20'
      : 'border-gray-800 bg-gray-950/60 text-gray-600'
  }`;

  return (
    <section
      ref={sectionRef}
      className={sectionClassName}
      data-ai-id={dataAiId}
      data-ai-editor-visual-section-flash={flash ? '1' : '0'}
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
              {hasResponsiveIndicator ? (
                <span
                  className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-300 align-middle shadow-[0_0_0_2px_rgba(17,24,39,0.8)]"
                  title="화면 크기별로 다른 스타일 값이 있습니다."
                  data-ai-id={`${dataAiId}-responsive-indicator`}
                />
              ) : null}
            </span>
            {description ? (
              <span className={descriptionClassName} data-ai-id={`${dataAiId}-description-text`}>
                {description}
              </span>
            ) : null}
          </span>
          <span
            className={iconClassName}
            title={open ? '닫기' : '열기'}
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
              {open ? '닫기' : '열기'}
            </span>
          </span>
        </button>
        {actions || onReset ? (
          <div className="flex shrink-0 items-center gap-1.5 py-3 pr-4" data-ai-id={`${dataAiId}-actions`}>
            {actions}
            {onReset ? (
              <button
                type="button"
                className="rounded-md border border-gray-700 bg-gray-950/70 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-gray-400 transition hover:border-blue-500/40 hover:text-blue-200 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={disabled}
                onClick={onReset}
                data-ai-id={`${dataAiId}-reset-button`}
              >
                <span data-ai-id={`${dataAiId}-reset-button-label-text`}>{resetLabel}</span>
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

function targetKeyFromPanelTarget(target: ReturnType<typeof useFloatingVisualPanelStore.getState>['target']): string {
  if (!target) {
    return '';
  }

  if (target.target.kind === 'ai-id') {
    return `ai-id:${target.target.aiId}:${target.target.instanceIndex}:${target.nodeId ?? ''}`;
  }

  return `fallback:${target.target.nodeId}:${target.target.selector}:${target.nodeId ?? ''}`;
}
