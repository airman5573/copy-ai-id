import type { ReactElement } from 'react';
import { useShallow } from 'zustand/shallow';

import {
  selectVisualPanelReadinessSummary,
  useVisualSelectionStore,
  type VisualPanelReadinessSummary,
  type VisualPanelTargetState,
} from '../../stores/useVisualSelectionStore';
import {
  selectVisualEditRuntimeStatus,
  useVisualEditStore,
  type VisualEditRuntimeStatusSummary,
} from '../../stores/useVisualEditStore';
import type { FloatingVisualPanelCategory } from '../../stores/useFloatingVisualPanelStore';
import { BorderControls } from '../controls/BorderControls';
import { ContentControls } from '../controls/ContentControls';
import { EffectsControls } from '../controls/EffectsControls';
import { ImageControls } from '../controls/ImageControls';
import { LayoutControls } from '../controls/LayoutControls';
import { SizeControls } from '../controls/SizeControls';
import { SpacingControls } from '../controls/SpacingControls';
import { StyleBasicsControls } from '../controls/StyleBasicsControls';
import { TypographyControls } from '../controls/TypographyControls';

export interface VisualPanelContentProps {
  target: VisualPanelTargetState | null;
  category: FloatingVisualPanelCategory;
}

// One category tab at a time, every control included — controls that also
// live on the quick toolbar are duplicated here on purpose so the panel is
// complete on its own.
export function VisualPanelContent({ target, category }: VisualPanelContentProps): ReactElement {
  const readiness = useVisualSelectionStore(
    useShallow((state) => selectVisualPanelReadinessSummary(state, Boolean(target))),
  );
  const runtimeStatus = useVisualEditStore(useShallow(selectVisualEditRuntimeStatus));

  return (
    <div
      className="space-y-3"
      data-ai-id="copy-ai-id-editor-visual-panel-content"
      data-ai-editor-visual-panel-target-node-id={target?.nodeId ?? ''}
      data-ai-editor-visual-panel-readiness={readiness.status}
      data-ai-editor-visual-panel-category={category}
    >
      <VisualPanelStateNotice readiness={readiness} />
      <VisualEditRuntimeNotice status={runtimeStatus} />
      {readiness.canShowControls ? <VisualPanelCategoryContent category={category} /> : null}
    </div>
  );
}

function VisualPanelCategoryContent({ category }: { category: FloatingVisualPanelCategory }): ReactElement {
  switch (category) {
    case 'content':
      return <ContentControls />;
    case 'image':
      return <ImageControls />;
    case 'layout':
      return <LayoutControls />;
    case 'spacing':
      return <SpacingControls />;
    case 'size':
      return <SizeControls />;
    case 'style':
      return (
        <div className="space-y-4" data-ai-id="copy-ai-id-editor-visual-panel-style-tab">
          <StyleBasicsControls />
          <TypographyControls />
          <EffectsControls />
        </div>
      );
    case 'border':
      return <BorderControls />;
    default:
      return exhaustiveCategory(category);
  }
}

function exhaustiveCategory(category: never): never {
  throw new Error(`Unsupported visual panel category: ${category}`);
}

// One-line status: loading / error / stale / empty. Ready renders nothing.
function VisualPanelStateNotice({ readiness }: { readiness: VisualPanelReadinessSummary }): ReactElement | null {
  if (readiness.status === 'ready') {
    return null;
  }

  const isAlert = readiness.tone === 'error' || readiness.tone === 'warning';

  return (
    <div
      className={`truncate rounded-lg px-3 py-2 text-xs font-semibold shadow-sm ${noticeClassNameForTone(readiness.tone)}`}
      data-ai-id={`copy-ai-id-editor-visual-panel-${readiness.status}-notice`}
      data-ai-editor-visual-panel-notice-tone={readiness.tone}
      role={isAlert ? 'alert' : 'status'}
      aria-live={isAlert ? 'assertive' : 'polite'}
    >
      {readiness.title}
    </div>
  );
}

function VisualEditRuntimeNotice({ status }: { status: VisualEditRuntimeStatusSummary }): ReactElement | null {
  if (!status.hasHiddenPromptText && !status.hasPending && !status.hasErrors) {
    return null;
  }

  return (
    <div
      className="rounded-lg border border-gray-700/80 bg-gray-950/60 px-3 py-2 text-xs leading-relaxed text-gray-300 shadow-sm"
      data-ai-id="copy-ai-id-editor-visual-panel-runtime-status-notice"
      role={status.hasErrors ? 'alert' : 'status'}
      aria-live={status.hasErrors ? 'assertive' : 'polite'}
    >
      {status.hasHiddenPromptText ? (
        <span className="block" data-ai-id="copy-ai-id-editor-visual-panel-hidden-prompt-count">
          숨겨진 visual edit 프롬프트: {status.exportableCount}개
        </span>
      ) : null}
      {status.hasPending ? (
        <span className="block" data-ai-id="copy-ai-id-editor-visual-panel-runtime-pending-count">
          적용 중인 visual edit: {status.pendingCount}개
        </span>
      ) : null}
      {status.hasErrors ? (
        <span className="block text-amber-200" data-ai-id="copy-ai-id-editor-visual-panel-runtime-error-count">
          실패한 visual edit: {status.failedCount}개
        </span>
      ) : null}
    </div>
  );
}

function noticeClassNameForTone(tone: VisualPanelReadinessSummary['tone']): string {
  switch (tone) {
    case 'neutral':
      return 'border border-dashed border-gray-700 bg-gray-900/60 text-gray-300 text-center';
    case 'info':
      return 'border border-blue-500/20 bg-blue-500/10 text-blue-100';
    case 'success':
      return 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-100';
    case 'warning':
      return 'border border-amber-500/30 bg-amber-500/10 text-amber-100';
    case 'error':
      return 'border border-red-500/30 bg-red-500/10 text-red-100';
    default:
      return exhaustiveTone(tone);
  }
}

function exhaustiveTone(tone: never): never {
  throw new Error(`Unsupported visual panel notice tone: ${tone}`);
}
