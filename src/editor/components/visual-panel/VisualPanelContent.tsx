import type { ReactElement } from 'react';
import { useShallow } from 'zustand/shallow';

import { getCurrentMessages } from '../../../shared/i18n';
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
import { VisualSection } from '../visual/VisualSection';
import { BorderControls } from '../controls/BorderControls';
import { ContentControls } from '../controls/ContentControls';
import { EffectsControls } from '../controls/EffectsControls';
import { ImageControls } from '../controls/ImageControls';
import { LayoutControls } from '../controls/LayoutControls';
import { SizeControls } from '../controls/SizeControls';
import { TypographyControls } from '../controls/TypographyControls';

export interface VisualPanelContentProps {
  target: VisualPanelTargetState | null;
}

// "Everything not on the quick toolbar": one scroll of collapsible sections
// driven by the snapshot intents (image section first when present). Spacing,
// width/height, font-size/weight/align, text/background color, and uniform
// radius live on the toolbar and are intentionally absent here.
export function VisualPanelContent({ target }: VisualPanelContentProps): ReactElement {
  const snapshot = useVisualSelectionStore((state) => state.snapshot);
  const readiness = useVisualSelectionStore(
    useShallow((state) => selectVisualPanelReadinessSummary(state, Boolean(target))),
  );
  const runtimeStatus = useVisualEditStore(useShallow(selectVisualEditRuntimeStatus));
  const sections = getCurrentMessages().visualEditor.panel.sections;
  const hasImageIntent = snapshot?.intents.includes('image') ?? false;

  return (
    <div
      className="space-y-3"
      data-ai-id="copy-ai-id-editor-visual-panel-content"
      data-ai-editor-visual-panel-target-node-id={target?.nodeId ?? ''}
      data-ai-editor-visual-panel-readiness={readiness.status}
    >
      <VisualPanelStateNotice readiness={readiness} />
      <VisualEditRuntimeNotice status={runtimeStatus} />
      {readiness.canShowControls ? (
        <>
          {hasImageIntent ? (
            <VisualSection
              title={sections.image}
              dataAiId="copy-ai-id-editor-visual-panel-image-section"
              defaultOpen
            >
              <ImageControls />
            </VisualSection>
          ) : null}
          <VisualSection
            title={sections.content}
            dataAiId="copy-ai-id-editor-visual-panel-content-section"
            defaultOpen={false}
          >
            <ContentControls />
          </VisualSection>
          <VisualSection
            title={sections.layout}
            dataAiId="copy-ai-id-editor-visual-panel-layout-section"
            defaultOpen={false}
          >
            <LayoutControls />
          </VisualSection>
          <VisualSection
            title={sections.size}
            dataAiId="copy-ai-id-editor-visual-panel-size-section"
            defaultOpen={false}
          >
            <SizeControls />
          </VisualSection>
          <VisualSection
            title={sections.typography}
            dataAiId="copy-ai-id-editor-visual-panel-typography-section"
            defaultOpen={false}
          >
            <TypographyControls />
          </VisualSection>
          <VisualSection
            title={sections.effects}
            dataAiId="copy-ai-id-editor-visual-panel-effects-section"
            defaultOpen={false}
          >
            <EffectsControls />
          </VisualSection>
          <VisualSection
            title={sections.border}
            dataAiId="copy-ai-id-editor-visual-panel-border-section"
            defaultOpen={false}
          >
            <BorderControls />
          </VisualSection>
        </>
      ) : null}
    </div>
  );
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

  const panelMessages = getCurrentMessages().visualEditor.panel;

  return (
    <div
      className="rounded-lg border border-gray-700/80 bg-gray-950/60 px-3 py-2 text-xs leading-relaxed text-gray-300 shadow-sm"
      data-ai-id="copy-ai-id-editor-visual-panel-runtime-status-notice"
      role={status.hasErrors ? 'alert' : 'status'}
      aria-live={status.hasErrors ? 'assertive' : 'polite'}
    >
      {status.hasHiddenPromptText ? (
        <span className="block" data-ai-id="copy-ai-id-editor-visual-panel-hidden-prompt-count">
          {panelMessages.hiddenPromptLabel}: {status.exportableCount}{panelMessages.countSuffix}
        </span>
      ) : null}
      {status.hasPending ? (
        <span className="block" data-ai-id="copy-ai-id-editor-visual-panel-runtime-pending-count">
          {panelMessages.pendingLabel}: {status.pendingCount}{panelMessages.countSuffix}
        </span>
      ) : null}
      {status.hasErrors ? (
        <span className="block text-amber-200" data-ai-id="copy-ai-id-editor-visual-panel-runtime-error-count">
          {panelMessages.failedLabel}: {status.failedCount}{panelMessages.countSuffix}
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
