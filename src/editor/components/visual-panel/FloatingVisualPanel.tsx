import { useMemo, type CSSProperties, type ReactElement } from 'react';

import { breakpointById } from '../../../shared/breakpoints';
import type {
  QuickActionCategory,
  VisualMutationError,
  VisualTargetSnapshot,
} from '../../../shared/editor-messages';
import { selectQuickActionCategory } from '../../bridge/bridgeClient';
import { useBreakpointStore } from '../../stores/useBreakpointStore';
import {
  useFloatingVisualPanelStore,
  type FloatingVisualPanelTarget,
} from '../../stores/useFloatingVisualPanelStore';
import {
  useVisualSelectionStore,
  type VisualSelectionStaleReason,
  type VisualSnapshotStatus,
} from '../../stores/useVisualSelectionStore';

const DESKTOP_PANEL_WIDTH_PX = 380;
const MIN_PANEL_WIDTH_PX = 280;
const VIEWPORT_MARGIN_PX = 12;
const RIGHT_SIDEBAR_WIDTH_PX = 360;
const PANEL_GAP_PX = 8;
const DEFAULT_PANEL_TOP_PX = 72;

const QUICK_CATEGORY_TABS: Array<{ category: QuickActionCategory; label: string }> = [
  { category: 'content', label: '콘텐츠' },
  { category: 'layout', label: '레이아웃' },
  { category: 'spacing', label: '간격' },
  { category: 'size', label: '크기' },
  { category: 'style', label: '스타일' },
  { category: 'border', label: '선' },
];

const CATEGORY_META: Record<QuickActionCategory, { label: string; description: string; placeholder: string }> = {
  content: {
    label: '콘텐츠',
    description: '텍스트, 링크, 속성, HTML을 선택 요소 바로 옆에서 조정합니다.',
    placeholder: '텍스트와 HTML 편집 컨트롤이 이 섹션에 표시됩니다.',
  },
  layout: {
    label: '레이아웃',
    description: 'display, flex/grid, 정렬 값을 현재 선택 요소에 적용합니다.',
    placeholder: 'display, flex, grid, 정렬 컨트롤이 이 섹션에 표시됩니다.',
  },
  spacing: {
    label: '간격',
    description: 'padding, margin, gap 값을 캔버스 근처에서 조정합니다.',
    placeholder: 'padding, margin, row/column gap 컨트롤이 이 섹션에 표시됩니다.',
  },
  size: {
    label: '크기',
    description: 'width, height, min/max 크기 값을 바로 수정합니다.',
    placeholder: 'width, height, min/max, object-fit 컨트롤이 이 섹션에 표시됩니다.',
  },
  style: {
    label: '스타일',
    description: '텍스트 스타일, 색상, 배경, 그림자 값을 조정합니다.',
    placeholder: 'typography, color, background, opacity, shadow 컨트롤이 이 섹션에 표시됩니다.',
  },
  border: {
    label: '선',
    description: 'border, radius, outline 계열 값을 선택 요소에 적용합니다.',
    placeholder: 'border width/style/color, radius, outline 컨트롤이 이 섹션에 표시됩니다.',
  },
};

export function FloatingVisualPanel(): ReactElement | null {
  const isOpen = useFloatingVisualPanelStore((state) => state.isOpen);
  const activeCategory = useFloatingVisualPanelStore((state) => state.category);
  const target = useFloatingVisualPanelStore((state) => state.target);
  const closePanel = useFloatingVisualPanelStore((state) => state.closePanel);
  const panelStyle = useMemo(() => createInitialPanelStyle(), []);

  if (!isOpen || activeCategory === null) {
    return null;
  }

  const meta = CATEGORY_META[activeCategory];

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[120]"
      data-ai-id="copy-ai-id-editor-floating-visual-panel-layer"
    >
      <section
        className="pointer-events-auto fixed flex min-h-0 flex-col overflow-hidden rounded-2xl border border-blue-500/30 bg-[color:var(--ai-editor-chrome-bg)] text-[color:var(--ai-editor-chrome-text)] shadow-[0_20px_54px_rgba(0,0,0,0.48)] ring-1 ring-white/5 backdrop-blur-md"
        style={panelStyle}
        role="dialog"
        aria-label={`${meta.label} 편집 패널`}
        data-ai-id="copy-ai-id-editor-floating-visual-panel"
        data-ai-editor-floating-visual-panel="1"
        data-ai-editor-floating-panel-category={activeCategory}
        data-ai-editor-floating-panel-placement="shell-static"
        data-ai-editor-floating-panel-target-ai-id={target?.target.kind === 'ai-id' ? target.target.aiId : ''}
      >
        <header
          className="shrink-0 border-b border-[color:var(--ai-editor-chrome-border)] bg-[color:var(--ai-editor-chrome-bg-translucent)] px-3.5 py-3"
          data-ai-id="copy-ai-id-editor-floating-visual-panel-header"
        >
          <div className="flex items-start gap-3" data-ai-id="copy-ai-id-editor-floating-visual-panel-header-row">
            <div className="min-w-0 flex-1" data-ai-id="copy-ai-id-editor-floating-visual-panel-header-copy">
              <div className="flex min-w-0 items-center gap-2" data-ai-id="copy-ai-id-editor-floating-visual-panel-title-row">
                <h2
                  className="truncate text-xs font-bold uppercase tracking-[0.12em] text-gray-50"
                  data-ai-id="copy-ai-id-editor-floating-visual-panel-title-text"
                >
                  {meta.label}
                </h2>
                <VisualPanelBreakpointBadge dataAiId="copy-ai-id-editor-floating-visual-panel-breakpoint-badge" />
              </div>
              <p
                className="mt-1 line-clamp-2 text-xs leading-normal text-gray-400"
                data-ai-id="copy-ai-id-editor-floating-visual-panel-description-text"
              >
                {meta.description}
              </p>
            </div>
            <button
              type="button"
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-gray-700 bg-gray-950/70 text-gray-300 transition hover:border-gray-600 hover:bg-gray-900 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70"
              title="패널 닫기"
              aria-label="패널 닫기"
              onClick={closePanel}
              data-ai-id="copy-ai-id-editor-floating-visual-panel-close-button"
            >
              <span aria-hidden="true" data-ai-id="copy-ai-id-editor-floating-visual-panel-close-icon-text">×</span>
            </button>
          </div>
          <FloatingVisualPanelTabs activeCategory={activeCategory} target={target} />
        </header>

        <div
          className="min-h-0 flex-1 overflow-y-auto bg-[color:var(--ai-editor-panel-body-bg)] p-3.5"
          data-ai-id="copy-ai-id-editor-floating-visual-panel-body"
        >
          <FloatingVisualPanelBody category={activeCategory} target={target} />
        </div>
      </section>
    </div>
  );
}

type FloatingVisualPanelTabsProps = {
  activeCategory: QuickActionCategory;
  target: FloatingVisualPanelTarget | null;
};

function FloatingVisualPanelTabs({ activeCategory, target }: FloatingVisualPanelTabsProps): ReactElement {
  return (
    <div
      className="mt-3 flex gap-1 overflow-x-auto pb-0.5"
      role="tablist"
      aria-label="Visual editing categories"
      data-ai-id="copy-ai-id-editor-floating-visual-panel-category-tabs"
    >
      {QUICK_CATEGORY_TABS.map(({ category, label }) => (
        <FloatingVisualPanelTab
          key={category}
          label={label}
          active={activeCategory === category}
          onClick={() => openCategory(category, target)}
          dataAiId={`copy-ai-id-editor-floating-visual-panel-${category}-tab-button`}
        />
      ))}
    </div>
  );
}

type FloatingVisualPanelTabProps = {
  label: string;
  active: boolean;
  onClick: () => void;
  dataAiId: string;
};

function FloatingVisualPanelTab({ label, active, onClick, dataAiId }: FloatingVisualPanelTabProps): ReactElement {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 ${
        active
          ? 'border-blue-400/70 bg-blue-500/25 text-blue-50 shadow-sm shadow-blue-950/30'
          : 'border-gray-700 bg-gray-950/40 text-gray-400 hover:border-gray-600 hover:bg-gray-900 hover:text-gray-100'
      }`}
      onClick={onClick}
      data-ai-id={dataAiId}
    >
      {label}
    </button>
  );
}

type FloatingVisualPanelBodyProps = {
  category: QuickActionCategory;
  target: FloatingVisualPanelTarget | null;
};

function FloatingVisualPanelBody({ category, target }: FloatingVisualPanelBodyProps): ReactElement {
  const snapshotStatus = useVisualSelectionStore((state) => state.snapshotStatus);
  const snapshot = useVisualSelectionStore((state) => state.snapshot);
  const snapshotError = useVisualSelectionStore((state) => state.snapshotError);
  const staleReason = useVisualSelectionStore((state) => state.staleReason);
  const meta = CATEGORY_META[category];

  return (
    <div
      className="space-y-4"
      data-ai-id="copy-ai-id-editor-visual-panel-content"
      data-ai-editor-visual-panel-category={category}
      data-ai-editor-visual-panel-target-node-id={target?.nodeId ?? ''}
    >
      <FloatingVisualPanelStateNotice
        snapshotStatus={snapshotStatus}
        snapshotError={snapshotError}
        staleReason={staleReason}
        hasSnapshot={Boolean(snapshot)}
      />
      <FloatingVisualPanelSelectionSummary target={target} snapshot={snapshot} />
      <section
        className="rounded-xl border border-gray-800 bg-gray-900/60 p-3.5 shadow-sm"
        data-ai-id={`copy-ai-id-editor-visual-panel-${category}-section`}
        data-visual-panel-section-id={category}
      >
        <div className="flex items-center justify-between gap-3" data-ai-id={`copy-ai-id-editor-visual-panel-${category}-section-header`}>
          <h3
            className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-300"
            data-ai-id={`copy-ai-id-editor-visual-panel-${category}-section-title`}
          >
            {meta.label}
          </h3>
          <span
            className="rounded-full border border-gray-700 bg-gray-950/70 px-2 py-0.5 text-[10px] font-bold text-gray-400"
            data-ai-id={`copy-ai-id-editor-visual-panel-${category}-section-status`}
          >
            준비 중
          </span>
        </div>
        <p
          className="mt-2 text-xs leading-relaxed text-gray-400"
          data-ai-id={`copy-ai-id-editor-visual-panel-${category}-section-placeholder`}
        >
          {meta.placeholder}
        </p>
      </section>
    </div>
  );
}

function VisualPanelBreakpointBadge({ dataAiId }: { dataAiId: string }): ReactElement {
  const activeBreakpointId = useBreakpointStore((state) => state.activeBreakpointId);
  const activeBreakpoint = breakpointById(activeBreakpointId);

  return (
    <span
      className="shrink-0 rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-bold text-blue-300 shadow-sm"
      data-ai-id={dataAiId}
    >
      {activeBreakpoint.label}
    </span>
  );
}

function FloatingVisualPanelStateNotice({
  snapshotStatus,
  snapshotError,
  staleReason,
  hasSnapshot,
}: {
  snapshotStatus: VisualSnapshotStatus;
  snapshotError: VisualMutationError | null;
  staleReason: VisualSelectionStaleReason | null;
  hasSnapshot: boolean;
}): ReactElement | null {
  if (snapshotStatus === 'loading') {
    return (
      <div
        className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-3.5 py-2.5 text-xs leading-relaxed text-blue-100 shadow-sm"
        data-ai-id="copy-ai-id-editor-visual-panel-loading-notice"
      >
        선택 요소 정보를 불러오는 중입니다.
      </div>
    );
  }

  if (snapshotStatus === 'error') {
    return (
      <div
        className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs leading-relaxed text-red-100 shadow-sm"
        data-ai-id="copy-ai-id-editor-visual-panel-error-notice"
      >
        선택 요소 정보를 불러오지 못했습니다{snapshotError?.message ? `: ${snapshotError.message}` : '.'}
      </div>
    );
  }

  if (snapshotStatus === 'stale') {
    return (
      <div
        className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs leading-relaxed text-amber-100 shadow-sm"
        data-ai-id="copy-ai-id-editor-visual-panel-stale-notice"
      >
        선택 요소가 변경되었습니다{staleReason ? ` (${describeStaleReason(staleReason)})` : ''}. 다시 hover해서 선택해 주세요.
      </div>
    );
  }

  if (!hasSnapshot) {
    return (
      <div
        className="rounded-xl border border-dashed border-gray-800 bg-gray-900/60 px-3.5 py-6 text-center text-xs leading-relaxed text-gray-500"
        data-ai-id="copy-ai-id-editor-visual-panel-empty-hint"
      >
        캔버스에서 요소를 선택하면 편집 섹션이 표시됩니다.
      </div>
    );
  }

  return null;
}

function FloatingVisualPanelSelectionSummary({
  target,
  snapshot,
}: {
  target: FloatingVisualPanelTarget | null;
  snapshot: VisualTargetSnapshot | null;
}): ReactElement | null {
  if (!target && !snapshot) {
    return null;
  }

  const tagName = snapshot?.tagName ? snapshot.tagName.toLowerCase() : target?.target.kind === 'fallback' ? target.target.tagName.toLowerCase() : null;
  const label = snapshot?.label ?? getTargetLabel(target);
  const textPreview = snapshot?.textValue ?? snapshot?.fallback?.textPreview ?? (target?.target.kind === 'fallback' ? target.target.textPreview : undefined);

  return (
    <section
      className="rounded-xl border border-gray-800 bg-gray-950/50 p-3.5 text-xs text-gray-300 shadow-sm"
      data-ai-id="copy-ai-id-editor-visual-panel-selection-summary"
    >
      <div className="flex min-w-0 items-center gap-2" data-ai-id="copy-ai-id-editor-visual-panel-selection-summary-row">
        {tagName ? (
          <span
            className="shrink-0 rounded-md border border-gray-700 bg-gray-900 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-gray-300"
            data-ai-id="copy-ai-id-editor-visual-panel-selection-summary-tag"
          >
            {tagName}
          </span>
        ) : null}
        <strong
          className="min-w-0 truncate text-xs font-bold text-gray-100"
          data-ai-id="copy-ai-id-editor-visual-panel-selection-summary-label"
        >
          {label}
        </strong>
      </div>
      {textPreview ? (
        <p
          className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-gray-500"
          data-ai-id="copy-ai-id-editor-visual-panel-selection-summary-preview"
        >
          {textPreview}
        </p>
      ) : null}
    </section>
  );
}

function openCategory(category: QuickActionCategory, target: FloatingVisualPanelTarget | null): void {
  if (!target) {
    useFloatingVisualPanelStore.getState().setCategory(category);
    return;
  }

  selectQuickActionCategory({
    target: target.target,
    nodeId: target.nodeId,
  }, category, {
    elementRect: target.elementRect,
    editorRect: target.editorRect,
  });
}

function createInitialPanelStyle(): CSSProperties {
  const viewportWidth = typeof window === 'undefined' ? 1280 : Math.max(1, window.innerWidth || 1);
  const width = Math.min(
    DESKTOP_PANEL_WIDTH_PX,
    Math.max(MIN_PANEL_WIDTH_PX, viewportWidth - VIEWPORT_MARGIN_PX * 2),
  );
  const preferredLeft = viewportWidth - RIGHT_SIDEBAR_WIDTH_PX - PANEL_GAP_PX - width;
  const left = clampNumber(preferredLeft, VIEWPORT_MARGIN_PX, viewportWidth - width - VIEWPORT_MARGIN_PX);

  return {
    left: `${left}px`,
    top: `${DEFAULT_PANEL_TOP_PX}px`,
    width: `${width}px`,
    maxHeight: `min(560px, calc(100vh - ${VIEWPORT_MARGIN_PX * 2 + DEFAULT_PANEL_TOP_PX}px))`,
  };
}

function getTargetLabel(target: FloatingVisualPanelTarget | null): string {
  if (!target) {
    return '선택 요소';
  }

  if (target.target.kind === 'ai-id') {
    return target.target.aiId;
  }

  return target.target.label || target.target.selector || target.target.tagName;
}

function describeStaleReason(reason: VisualSelectionStaleReason): string {
  switch (reason) {
    case 'bridge-reset':
      return 'preview 재연결';
    case 'cleared':
      return '선택 해제';
    case 'disconnected':
      return 'DOM 연결 끊김';
    case 'hidden':
      return '숨김';
    case 'protected-target':
      return '보호 요소';
    case 'stale-target':
      return '오래된 대상';
    case 'snapshot-error':
      return '스냅샷 오류';
    case 'mutation-error':
      return '변경 오류';
    case 'deleted':
      return '삭제됨';
    default:
      return exhaustiveStaleReason(reason);
  }
}

function clampNumber(value: number, min: number, max: number): number {
  if (max < min) {
    return min;
  }
  return Math.round(Math.min(Math.max(value, min), max));
}

function exhaustiveStaleReason(reason: never): never {
  throw new Error(`Unsupported stale reason: ${reason}`);
}
