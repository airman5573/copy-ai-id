import {
  EDITOR_MESSAGE_TYPES,
  type BridgeToEditorMessage,
  type EditorToBridgeMessage,
  type EditorKeyboardShortcut,
} from '../../shared/editor-messages';
import { useBridgeStore } from '../stores/useBridgeStore';
import { useBoxModelStore } from '../stores/useBoxModelStore';
import { useHighlightStore } from '../stores/useHighlightStore';
import { useLayoutTreeStore } from '../stores/useLayoutTreeStore';
import { appendTargetReferenceToNotebook, handleEditorShortcutAction } from '../shortcut-actions';
import { useRuntimeStore } from '../stores/useRuntimeStore';
import {
  isNoteEditorHoverProtected,
  onNoteEditorHoverProtectionChange,
} from '../note-hover-guard';
import { suppressHoverUntilMouseMove } from '../keyboard-hover-guard';
import { showMissingDataAiIdToast, showStaleFallbackTargetToast } from '../toast';

const PREVIEW_QUERY_PARAM = 'copy-ai-id-preview';
let previewFrame: HTMLIFrameElement | null = null;

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
  previewFrame = frame;
}

export function postToBridge(message: EditorToBridgeMessage): void {
  previewFrame?.contentWindow?.postMessage(message, '*');
}

export function installBridgeClient(): () => void {
  const cleanupHoverProtection = onNoteEditorHoverProtectionChange((protectedFromHover) => {
    postToBridge({
      type: EDITOR_MESSAGE_TYPES.setHoverHighlightSuppressed,
      suppressed: protectedFromHover,
    });
  });

  const handleMessage = (event: MessageEvent): void => {
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
