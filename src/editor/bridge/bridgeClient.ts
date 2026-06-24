import {
  EDITOR_MESSAGE_TYPES,
  type BridgeToEditorMessage,
  type EditorToBridgeMessage,
  type EditorKeyboardShortcut,
  type EditorTargetReference,
  type QuickActionCategory,
} from '../../shared/editor-messages';
import {
  bridgeViewportRectToEditorViewportRect,
  getBridgeIframeElement,
  registerBridgeIframeElement,
} from './geometry';
import { useBridgeStore } from '../stores/useBridgeStore';
import { useBoxModelStore } from '../stores/useBoxModelStore';
import { useHighlightStore } from '../stores/useHighlightStore';
import { useLayoutTreeStore } from '../stores/useLayoutTreeStore';
import { useVisualBridgeStore, type VisualMutationResultMessage } from '../stores/useVisualBridgeStore';
import { appendTargetReferenceToNotebook, handleEditorShortcutAction } from '../shortcut-actions';
import { useRuntimeStore } from '../stores/useRuntimeStore';
import {
  isNoteEditorHoverProtected,
  onNoteEditorHoverProtectionChange,
} from '../note-hover-guard';
import { suppressHoverUntilMouseMove } from '../keyboard-hover-guard';
import { showMissingDataAiIdToast, showStaleFallbackTargetToast } from '../toast';

const PREVIEW_QUERY_PARAM = 'copy-ai-id-preview';

export { getBridgeIframeElement } from './geometry';

export function createPreviewUrl(sourceUrl: string): string {
  try {
    const url = new URL(sourceUrl);
    url.searchParams.set(PREVIEW_QUERY_PARAM, '1');
    return url.href;
  } catch {
    return sourceUrl;
  }
}

export function registerPreviewFrame(frame: HTMLIFrameElement | null): void {
  registerBridgeIframeElement(frame);
}

export function postToBridge(message: EditorToBridgeMessage): void {
  getBridgeIframeElement()?.contentWindow?.postMessage(message, '*');
}

export function selectQuickActionCategory(
  reference: EditorTargetReference,
  category: QuickActionCategory,
): void {
  useVisualBridgeStore.getState().setQuickActionCategorySelection({
    target: reference.target,
    nodeId: reference.nodeId,
    category,
  });

  postToBridge({
    type: EDITOR_MESSAGE_TYPES.quickActionCategorySelected,
    target: reference.target,
    nodeId: reference.nodeId,
    category,
  });
}

export function installBridgeClient(): () => void {
  const cleanupHoverProtection = onNoteEditorHoverProtectionChange((protectedFromHover) => {
    postToBridge({
      type: EDITOR_MESSAGE_TYPES.setHoverHighlightSuppressed,
      suppressed: protectedFromHover,
    });
  });

  const handleMessage = (event: MessageEvent): void => {
    const previewFrame = getBridgeIframeElement();

    if (previewFrame?.contentWindow && event.source !== previewFrame.contentWindow) {
      return;
    }

    const message = event.data as (BridgeToEditorMessage & { source?: unknown }) | null;
    if (!message || message.source !== 'copy-ai-id-preview-bridge') {
      return;
    }

    routeBridgeMessage(message);
  };

  window.addEventListener('message', handleMessage);

  return () => {
    window.removeEventListener('message', handleMessage);
    cleanupHoverProtection();
  };
}

function routeBridgeMessage(message: BridgeToEditorMessage): void {
  switch (message.type) {
    case EDITOR_MESSAGE_TYPES.bridgeReady:
      useVisualBridgeStore.getState().resetVisualBridgeState();
      useBridgeStore.getState().markReady(message.url, message.aiIdCount);
      useRuntimeStore.getState().setPreviewUrl(message.url);
      if (useBoxModelStore.getState().enabled) {
        postToBridge({ type: EDITOR_MESSAGE_TYPES.setBoxModelMode, enabled: true });
      }
      if (isNoteEditorHoverProtected()) {
        postToBridge({ type: EDITOR_MESSAGE_TYPES.setHoverHighlightSuppressed, suppressed: true });
      }
      return;
    case EDITOR_MESSAGE_TYPES.layoutTree:
      useLayoutTreeStore.getState().setTree(message.root, message.url);
      useVisualBridgeStore.getState().markLayoutTreeRefreshed();
      return;
    case EDITOR_MESSAGE_TYPES.targetHighlighted:
      if (isNoteEditorHoverProtected()) {
        return;
      }

      useHighlightStore.getState().setHighlightedTarget(message.target, message.nodeId, message.origin ?? 'preview');
      return;
    case EDITOR_MESSAGE_TYPES.targetReferenceRequested:
      appendTargetReferenceToNotebook({
        target: message.target,
        nodeId: message.nodeId,
      });
      return;
    case EDITOR_MESSAGE_TYPES.targetReferenceRejected:
      if (message.reason === 'missing-data-ai-id') {
        showMissingDataAiIdToast();
      } else if (message.reason === 'stale-fallback-target') {
        showStaleFallbackTargetToast();
      }
      return;
    case EDITOR_MESSAGE_TYPES.iframeStatus:
      useBridgeStore.getState().setIframeStatus(message.status, message.message);
      return;
    case EDITOR_MESSAGE_TYPES.quickActionAnchorChanged:
      useVisualBridgeStore.getState().setQuickActionAnchor(
        message,
        message.elementRect ? bridgeViewportRectToEditorViewportRect(message.elementRect) : null,
      );
      return;
    case EDITOR_MESSAGE_TYPES.visualTargetSnapshot:
      useVisualBridgeStore.getState().setVisualTargetSnapshot(
        message,
        message.snapshot ? bridgeViewportRectToEditorViewportRect(message.snapshot.elementRect) : null,
      );
      return;
    case EDITOR_MESSAGE_TYPES.visualStyleUpdated:
    case EDITOR_MESSAGE_TYPES.visualTextUpdated:
    case EDITOR_MESSAGE_TYPES.visualRichTextUpdated:
    case EDITOR_MESSAGE_TYPES.visualAttributeUpdated:
    case EDITOR_MESSAGE_TYPES.visualFormValueUpdated:
    case EDITOR_MESSAGE_TYPES.visualElementDuplicated:
    case EDITOR_MESSAGE_TYPES.visualElementMoved:
    case EDITOR_MESSAGE_TYPES.visualElementDeleted:
    case EDITOR_MESSAGE_TYPES.visualElementRestored:
    case EDITOR_MESSAGE_TYPES.visualDragMoveCompleted:
      useVisualBridgeStore.getState().setVisualMutationResult(
        message as VisualMutationResultMessage,
        message.snapshot ? bridgeViewportRectToEditorViewportRect(message.snapshot.elementRect) : null,
      );
      return;
    case EDITOR_MESSAGE_TYPES.visualMutationError:
      useVisualBridgeStore.getState().setVisualMutationError(message);
      return;
    case EDITOR_MESSAGE_TYPES.keyboardShortcut:
      if (isArrowShortcut(message.shortcut)) {
        suppressHoverUntilMouseMove();
      }

      handleEditorShortcutAction(message.shortcut);
      return;
    default:
      return;
  }
}

function isArrowShortcut(shortcut: EditorKeyboardShortcut): boolean {
  return shortcut === 'arrow-up'
    || shortcut === 'arrow-down'
    || shortcut === 'arrow-left'
    || shortcut === 'arrow-right';
}
