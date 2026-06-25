import type { ReactElement } from 'react';
import { useShallow } from 'zustand/shallow';

import type {
  QuickActionCategory,
  VisualTargetSnapshot,
} from '../../../shared/editor-messages';
import { getCurrentMessages } from '../../../shared/i18n';
import {
  describeVisualSelectionStaleReason,
  selectVisualPanelReadinessSummary,
  useVisualSelectionStore,
  type VisualPanelReadinessSummary,
} from '../../stores/useVisualSelectionStore';
import {
  selectVisualEditRuntimeStatus,
  useVisualEditStore,
  type VisualEditRuntimeStatusSummary,
} from '../../stores/useVisualEditStore';
import type { FloatingVisualPanelTarget } from '../../stores/useFloatingVisualPanelStore';
import { QUICK_ACTION_SECTION_IDS } from '../visual/sectionJump';
import { LayoutControls } from '../controls/LayoutControls';
import { ContentControls } from '../controls/ContentControls';
import { SpacingControls } from '../controls/SpacingControls';
import { SizeControls } from '../controls/SizeControls';
import { BackgroundImageControls } from '../controls/BackgroundImageControls';
import { BorderControls } from '../controls/BorderControls';
import { ColorControls } from '../controls/ColorControls';
import { OpacityControls } from '../controls/OpacityControls';
import { ShadowControls } from '../controls/ShadowControls';
import { TextControls } from '../controls/TextControls';
import { TypographyControls } from '../controls/TypographyControls';
import { VisualSection } from '../visual/VisualSection';

export function getVisualPanelCategoryMeta(category: QuickActionCategory) {
  return getCurrentMessages().visualEditor.categories[category];
}

export interface VisualPanelContentProps {
  category: QuickActionCategory;
  target: FloatingVisualPanelTarget | null;
}

export function VisualPanelContent({ category, target }: VisualPanelContentProps): ReactElement {
  const snapshot = useVisualSelectionStore((state) => state.snapshot);
  const readiness = useVisualSelectionStore(
    useShallow((state) => selectVisualPanelReadinessSummary(state, Boolean(target))),
  );
  const runtimeStatus = useVisualEditStore(useShallow(selectVisualEditRuntimeStatus));
  const messages = getCurrentMessages();
  const meta = messages.visualEditor.categories[category];
  const sectionId = QUICK_ACTION_SECTION_IDS[category];

  return (
    <div
      className="space-y-4"
      data-ai-id="copy-ai-id-editor-visual-panel-content"
      data-ai-editor-visual-panel-category={category}
      data-ai-editor-visual-panel-target-node-id={target?.nodeId ?? ''}
      data-ai-editor-visual-panel-readiness={readiness.status}
    >
      <VisualPanelStateNotice readiness={readiness} />
      <VisualEditRuntimeNotice status={runtimeStatus} />
      <FloatingVisualPanelSelectionSummary target={target} snapshot={snapshot} />
      <VisualSection
        title={meta.label}
        description={meta.description}
        dataAiId={sectionId}
        disabled={!readiness.canShowControls}
        contentProps={{
          'data-visual-panel-section-id': sectionId,
        }}
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
            {readiness.canShowControls
              ? messages.visualEditor.panel.readyStatus
              : messages.visualEditor.panel.waitingStatus}
          </span>
        </div>
        {category === 'content' && readiness.canShowControls ? (
          <ContentControls disabled={!readiness.canShowControls} />
        ) : category === 'layout' && readiness.canShowControls ? (
          <LayoutControls disabled={!readiness.canShowControls} />
        ) : category === 'spacing' && readiness.canShowControls ? (
          <SpacingControls disabled={!readiness.canShowControls} />
        ) : category === 'size' && readiness.canShowControls ? (
          <SizeControls disabled={!readiness.canShowControls} />
        ) : category === 'style' && readiness.canShowControls ? (
          <div className="space-y-4" data-ai-id="copy-ai-id-editor-visual-style-controls">
            <TextControls disabled={!readiness.canShowControls} />
            <TypographyControls disabled={!readiness.canShowControls} />
            <ColorControls disabled={!readiness.canShowControls} />
            <OpacityControls disabled={!readiness.canShowControls} />
            <BackgroundImageControls disabled={!readiness.canShowControls} />
            <ShadowControls disabled={!readiness.canShowControls} />
          </div>
        ) : category === 'border' && readiness.canShowControls ? (
          <BorderControls disabled={!readiness.canShowControls} />
        ) : (
          <p
            className="mt-2 text-xs leading-relaxed text-gray-400"
            data-ai-id={`copy-ai-id-editor-visual-panel-${category}-section-placeholder`}
          >
            {readiness.canShowControls
              ? meta.placeholder
              : messages.visualEditor.panel.controlsWaitingPlaceholder}
          </p>
        )}
      </VisualSection>
    </div>
  );
}

function VisualPanelStateNotice({ readiness }: { readiness: VisualPanelReadinessSummary }): ReactElement | null {
  if (readiness.status === 'ready') {
    return null;
  }

  const messages = getCurrentMessages();
  const toneClassName = noticeClassNameForTone(readiness.tone);

  return (
    <div
      className={`rounded-xl px-3.5 py-3 text-xs leading-relaxed shadow-sm ${toneClassName}`}
      data-ai-id={`copy-ai-id-editor-visual-panel-${readiness.status}-notice`}
      data-ai-editor-visual-panel-notice-tone={readiness.tone}
      role={readiness.tone === 'error' || readiness.tone === 'warning' ? 'alert' : 'status'}
      aria-live={readiness.tone === 'error' || readiness.tone === 'warning' ? 'assertive' : 'polite'}
    >
      <strong className="block text-[11px] font-bold text-current" data-ai-id={`copy-ai-id-editor-visual-panel-${readiness.status}-notice-title`}>
        {readiness.title}
      </strong>
      <span className="mt-1 block opacity-85" data-ai-id={`copy-ai-id-editor-visual-panel-${readiness.status}-notice-message`}>
        {readiness.message}
      </span>
      {readiness.staleReason ? (
        <span className="mt-1 block opacity-75" data-ai-id={`copy-ai-id-editor-visual-panel-${readiness.status}-notice-reason`}>
          {messages.visualEditor.panel.reasonLabel}: {describeVisualSelectionStaleReason(readiness.staleReason)}
        </span>
      ) : null}
      {readiness.errorCode ? (
        <span className="mt-1 block font-mono text-[10px] opacity-75" data-ai-id={`copy-ai-id-editor-visual-panel-${readiness.status}-notice-code`}>
          {messages.visualEditor.panel.codeLabel}: {readiness.errorCode}
        </span>
      ) : null}
    </div>
  );
}

function VisualEditRuntimeNotice({ status }: { status: VisualEditRuntimeStatusSummary }): ReactElement | null {
  if (!status.hasHiddenPromptText && !status.hasPending && !status.hasErrors) {
    return null;
  }

  const messages = getCurrentMessages();
  const panelMessages = messages.visualEditor.panel;

  return (
    <div
      className="rounded-xl border border-gray-700/80 bg-gray-950/60 px-3.5 py-2.5 text-xs leading-relaxed text-gray-300 shadow-sm"
      data-ai-id="copy-ai-id-editor-visual-panel-runtime-status-notice"
      role={status.hasErrors ? 'alert' : 'status'}
      aria-live={status.hasErrors ? 'assertive' : 'polite'}
    >
      {status.hasHiddenPromptText ? (
        <span className="block" data-ai-id="copy-ai-id-editor-visual-panel-hidden-prompt-count">
          {panelMessages.hiddenPromptLabel}: {status.hiddenPromptCount}{panelMessages.countSuffix} · {panelMessages.copyOnlySuffix}
        </span>
      ) : null}
      {status.hasPending ? (
        <span className="block" data-ai-id="copy-ai-id-editor-visual-panel-runtime-pending-count">
          {panelMessages.pendingLabel}: {status.pendingCount}{panelMessages.countSuffix}
        </span>
      ) : null}
      {status.hasErrors ? (
        <span className="block text-amber-200" data-ai-id="copy-ai-id-editor-visual-panel-runtime-error-count">
          {panelMessages.failedLabel}: {status.failedCount}{panelMessages.countSuffix}{status.latestErrorCode ? ` · ${panelMessages.latestCodeLabel}: ${status.latestErrorCode}` : ''}
        </span>
      ) : null}
    </div>
  );
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

function getTargetLabel(target: FloatingVisualPanelTarget | null): string {
  if (!target) {
    return getCurrentMessages().visualEditor.panel.selectedElementFallback;
  }

  if (target.target.kind === 'ai-id') {
    return target.target.aiId;
  }

  return target.target.label || target.target.selector || target.target.tagName;
}

function noticeClassNameForTone(tone: VisualPanelReadinessSummary['tone']): string {
  switch (tone) {
    case 'neutral':
      return 'border border-dashed border-gray-800 bg-gray-900/60 text-gray-500 text-center';
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
