import {
  EDITOR_MESSAGE_TYPES,
  type BridgeToEditorMessage,
  type EditorToBridgeMessage,
} from '../../shared/editor-messages';
import { buildLayoutTreeSnapshot } from './layout-tree';
import { handleBridgeKeyboardShortcut, installBridgeKeyboard } from './keyboard';
import { refreshOverlays, setBoxModelMode, startOverlayTracking } from './overlay';
import {
  handleHoverTreeNode,
  installHoverHighlight,
  revealTreeNode,
  setHoverHighlightSuppressed,
} from './highlight';
import { handleVisualTargetSnapshotRequest } from './visual-mutation-results';

export const COPY_AI_ID_PREVIEW_PARAM = 'copy-ai-id-preview';
const BRIDGE_SOURCE = 'copy-ai-id-preview-bridge';

export interface PreviewBridgeController {
  destroy(): void;
}

export function isCopyAiIdPreviewFrame(locationLike: Location = window.location): boolean {
  if (window.parent === window) {
    return false;
  }

  const searchParams = new URLSearchParams(locationLike.search);
  if (searchParams.get(COPY_AI_ID_PREVIEW_PARAM) === '1') {
    return true;
  }

  // Backward-compatible fallback for preview URLs created by older versions.
  const hash = locationLike.hash.startsWith('#')
    ? locationLike.hash.slice(1)
    : locationLike.hash;
  const hashParams = new URLSearchParams(hash);
  return hashParams.get(COPY_AI_ID_PREVIEW_PARAM) === '1';
}

export function startPreviewBridge(): PreviewBridgeController {
  let destroyed = false;
  const allowedOrigin = window.location.origin;
  const cleanupOverlayTracking = startOverlayTracking();
  const post = (message: BridgeToEditorMessage): void => {
    if (destroyed || window.parent === window) {
      return;
    }

    window.parent.postMessage({
      source: BRIDGE_SOURCE,
      ...message,
    }, targetOriginForPost(allowedOrigin));
  };
  const cleanupHoverHighlight = installHoverHighlight(post);
  const cleanupBridgeKeyboard = installBridgeKeyboard(post);

  const postReady = (): void => {
    const { message: layoutTreeMessage, aiIdCount } = buildLayoutTreeSnapshot();

    post({
      type: EDITOR_MESSAGE_TYPES.bridgeReady,
      url: window.location.href,
      aiIdCount,
    });
    post(layoutTreeMessage);
  };

  const handleMessage = (event: MessageEvent): void => {
    if (destroyed || event.source !== window.parent || !isAllowedOrigin(event.origin, allowedOrigin)) {
      return;
    }

    const message = event.data as EditorToBridgeMessage | null;
    if (!message || typeof message !== 'object' || typeof message.type !== 'string') {
      return;
    }

    route(message, post);
  };

  window.addEventListener('message', handleMessage);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', postReady, { once: true });
  } else {
    postReady();
  }

  return {
    destroy() {
      destroyed = true;
      window.removeEventListener('message', handleMessage);
      document.removeEventListener('DOMContentLoaded', postReady);
      cleanupHoverHighlight();
      cleanupBridgeKeyboard();
      cleanupOverlayTracking();
    },
  };
}

function route(message: EditorToBridgeMessage, post: (message: BridgeToEditorMessage) => void): void {
  switch (message.type) {
    case EDITOR_MESSAGE_TYPES.hoverTreeNode:
      handleHoverTreeNode(message.nodeId, post);
      return;
    case EDITOR_MESSAGE_TYPES.revealTreeNode:
      revealTreeNode(message.nodeId, post);
      return;
    case EDITOR_MESSAGE_TYPES.keyboardShortcut:
      handleBridgeKeyboardShortcut(message.shortcut, post);
      return;
    case EDITOR_MESSAGE_TYPES.setHoverHighlightSuppressed:
      setHoverHighlightSuppressed(message.suppressed);
      return;
    case EDITOR_MESSAGE_TYPES.setCanvasZoom:
      document.documentElement.style.setProperty('--copy-ai-id-preview-canvas-zoom', String(message.zoom));
      refreshOverlays();
      return;
    case EDITOR_MESSAGE_TYPES.setBoxModelMode:
      setBoxModelMode(message.enabled);
      return;
    case EDITOR_MESSAGE_TYPES.requestVisualTargetSnapshot:
      handleVisualTargetSnapshotRequest(message, post);
      return;
    default:
      return;
  }
}

function isAllowedOrigin(eventOrigin: string, allowedOrigin: string): boolean {
  // file:// pages and opaque origins cannot always be compared as normal web
  // origins. The parent frame is still verified by event.source above, so allow
  // those cases for local-file support.
  if (isLocalOrOpaqueOrigin(allowedOrigin) || eventOrigin === 'null') {
    return true;
  }

  return eventOrigin === allowedOrigin;
}

function targetOriginForPost(allowedOrigin: string): string {
  return isLocalOrOpaqueOrigin(allowedOrigin) ? '*' : allowedOrigin;
}

function isLocalOrOpaqueOrigin(origin: string): boolean {
  return origin === 'null' || origin === 'file://';
}
