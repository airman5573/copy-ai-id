import {
  getEnabledState,
  onEnabledStateChange,
  setEnabledState,
} from '../../shared/enabled-state';
import {
  EDITOR_HOST_ATTR,
  OVERLAY_HOST_ATTR,
  PREVIEW_OVERLAY_ATTR,
} from '../../shared/config';
import {
  createSetTopEditorEnabledMessage,
  isSetTopEditorEnabledMessage,
} from '../../shared/protocol/frame-messages';
import {
  RUNTIME_MESSAGE_TYPES,
  isCopyAiIdRuntimeMessage,
  type RuntimeStateMessageResponse,
} from '../../shared/runtime-messages';
import {
  isCopyAiIdPreviewFrame,
  startPreviewBridge,
  type PreviewBridgeController,
} from '../editor-bridge';
import {
  createEditorShellController,
  type EditorShellController,
} from '../editor-shell/mount';
import { createShiftZSpaceToggleController } from './shift-z-space-toggle';

declare global {
  interface Window {
    __copyAiIdHotkeyCleanup__?: () => void;
    __copyAiIdEditorShellCleanup__?: () => void;
    __copyAiIdPreviewBridgeCleanup__?: () => void;
  }
}

const DESTROY_EVENT_NAME = 'copy-ai-id:destroy-content-script-instance';
const ACTIVE_QUERY_PARAM_NAME = 'copyaiid';
const ACTIVE_QUERY_PARAM_VALUE = 'active';

function isTopFrame(): boolean {
  return window.parent === window;
}

function safelyRunCleanup(cleanup: (() => void) | undefined): void {
  if (!cleanup) {
    return;
  }

  try {
    cleanup();
  } catch {
    // Stale extension contexts can invalidate Chrome APIs during teardown.
  }
}

function removeExtensionOwnedHosts(): void {
  document.querySelector<HTMLElement>(`[${OVERLAY_HOST_ATTR}]`)?.remove();
  document.querySelector<HTMLElement>(`[${EDITOR_HOST_ATTR}]`)?.remove();
  document.querySelectorAll<HTMLElement>(`[${PREVIEW_OVERLAY_ATTR}]`).forEach((node) => node.remove());
}

function supportsActivationQueryParamSync(): boolean {
  return ['http:', 'https:', 'file:'].includes(window.location.protocol);
}

function hasActiveQueryParam(): boolean {
  if (!supportsActivationQueryParamSync()) {
    return false;
  }

  try {
    return new URL(window.location.href).searchParams.get(ACTIVE_QUERY_PARAM_NAME)
      === ACTIVE_QUERY_PARAM_VALUE;
  } catch {
    return false;
  }
}

function syncActiveQueryParam(enabled: boolean): void {
  if (!isTopFrame() || !supportsActivationQueryParamSync()) {
    return;
  }

  try {
    const currentUrl = new URL(window.location.href);
    const currentParamValue = currentUrl.searchParams.get(ACTIVE_QUERY_PARAM_NAME);

    if (enabled) {
      if (currentParamValue === ACTIVE_QUERY_PARAM_VALUE) {
        return;
      }

      currentUrl.searchParams.set(ACTIVE_QUERY_PARAM_NAME, ACTIVE_QUERY_PARAM_VALUE);
    } else if (currentParamValue === ACTIVE_QUERY_PARAM_VALUE) {
      currentUrl.searchParams.delete(ACTIVE_QUERY_PARAM_NAME);
    } else {
      return;
    }

    if (currentUrl.href === window.location.href) {
      return;
    }

    window.history.replaceState(window.history.state, document.title, currentUrl.href);
  } catch (error) {
    console.warn('[Copy AI ID] Failed to sync active query parameter.', error);
  }
}

function destroyPreviousContentScriptInstances(): void {
  window.dispatchEvent(new CustomEvent(DESTROY_EVENT_NAME));
  removeExtensionOwnedHosts();
}


destroyPreviousContentScriptInstances();

const previewBridge: PreviewBridgeController | null = isCopyAiIdPreviewFrame()
  ? startPreviewBridge()
  : null;
const shiftZToggleController = createShiftZSpaceToggleController({
  toggleEnabled: async (nextEnabled) => {
    await setEnabledState(nextEnabled);

    if (!isTopFrame()) {
      window.parent.postMessage(createSetTopEditorEnabledMessage(nextEnabled), '*');
    }
  },
});
const editorShellController: EditorShellController | null = !previewBridge && isTopFrame()
  ? createEditorShellController({
      onRequestClose: () => {
        void setEnabledState(false);
      },
    })
  : null;
let unsubscribeEnabledStateChange = () => {};
let runtimeMessageCleanup = () => {};
let childFrameMessageCleanup = () => {};
let destroyed = false;

const destroyCurrentContentScriptInstance = (): void => {
  if (destroyed) {
    return;
  }

  destroyed = true;
  window.removeEventListener(DESTROY_EVENT_NAME, destroyCurrentContentScriptInstance);
  window.removeEventListener('pagehide', destroyCurrentContentScriptInstance);
  safelyRunCleanup(unsubscribeEnabledStateChange);
  safelyRunCleanup(runtimeMessageCleanup);
  safelyRunCleanup(childFrameMessageCleanup);
  safelyRunCleanup(window.__copyAiIdHotkeyCleanup__);
  safelyRunCleanup(window.__copyAiIdEditorShellCleanup__);
  safelyRunCleanup(window.__copyAiIdPreviewBridgeCleanup__);
  safelyRunCleanup(() => previewBridge?.destroy());

  if (window.__copyAiIdHotkeyCleanup__) {
    window.__copyAiIdHotkeyCleanup__ = undefined;
  }

  if (window.__copyAiIdEditorShellCleanup__) {
    window.__copyAiIdEditorShellCleanup__ = undefined;
  }

  if (window.__copyAiIdPreviewBridgeCleanup__) {
    window.__copyAiIdPreviewBridgeCleanup__ = undefined;
  }
};

window.addEventListener(DESTROY_EVENT_NAME, destroyCurrentContentScriptInstance);
window.addEventListener('pagehide', destroyCurrentContentScriptInstance);

function syncEnabledState(enabled: boolean): void {
  if (destroyed) {
    return;
  }

  shiftZToggleController.syncEnabled(enabled);
  editorShellController?.setEnabled(enabled);
  syncActiveQueryParam(enabled);
}

async function createRuntimeStateResponse(): Promise<RuntimeStateMessageResponse> {
  return {
    enabled: await getEnabledState(),
    available: editorShellController !== null,
  };
}

function attachRuntimeMessageListener(): () => void {
  if (
    !isTopFrame()
    || typeof chrome === 'undefined'
    || typeof chrome.runtime?.onMessage === 'undefined'
  ) {
    return () => {};
  }

  const handleRuntimeMessage = (
    message: unknown,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response?: RuntimeStateMessageResponse) => void,
  ): true | undefined => {
    if (!isCopyAiIdRuntimeMessage(message)) {
      return undefined;
    }

    void (async () => {
      switch (message.type) {
        case RUNTIME_MESSAGE_TYPES.setEnabled:
          await setEnabledState(message.enabled);
          break;
        case RUNTIME_MESSAGE_TYPES.getState:
          break;
      }

      sendResponse(await createRuntimeStateResponse());
    })();

    return true;
  };

  chrome.runtime.onMessage.addListener(handleRuntimeMessage);

  return () => {
    chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
  };
}

function attachChildFrameMessageListener(): () => void {
  if (!isTopFrame()) {
    return () => {};
  }

  const handleMessage = (event: MessageEvent): void => {
    if (!isSetTopEditorEnabledMessage(event.data)) {
      return;
    }

    void setEnabledState(event.data.enabled);
  };

  window.addEventListener('message', handleMessage);

  return () => {
    window.removeEventListener('message', handleMessage);
  };
}

function attachHotkeyListeners(): void {
  if (previewBridge) {
    return;
  }

  shiftZToggleController.attach();
  window.__copyAiIdHotkeyCleanup__ = () => {
    shiftZToggleController.destroy();
  };
}

async function bootstrap(): Promise<void> {
  if (previewBridge) {
    window.__copyAiIdPreviewBridgeCleanup__ = () => {
      previewBridge.destroy();
    };
    return;
  }

  attachHotkeyListeners();
  runtimeMessageCleanup = attachRuntimeMessageListener();
  childFrameMessageCleanup = attachChildFrameMessageListener();
  window.__copyAiIdEditorShellCleanup__ = () => {
    editorShellController?.destroy();
  };

  try {
    if (hasActiveQueryParam()) {
      await setEnabledState(true);
    }

    syncEnabledState(await getEnabledState());
  } catch (error) {
    console.error('[Copy AI ID] Failed to read initial enabled state.', error);
    syncEnabledState(false);
  }

  unsubscribeEnabledStateChange = onEnabledStateChange((enabled) => {
    syncEnabledState(enabled);
  });
}

void bootstrap();
