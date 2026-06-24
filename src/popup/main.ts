import './styles.css';

import {
  RUNTIME_MESSAGE_TYPES,
  type CopyAiIdRuntimeMessage,
  type RuntimeStateMessageResponse,
} from '../shared/runtime-messages';
import {
  type PopupScopeContext,
  resolveActiveTabScopeContext,
} from './active-tab-scope';
import { createPopupView } from './view';

const popupView = createPopupView();
let currentScopeContext: PopupScopeContext | null = null;
let currentRuntimeState: RuntimeStateMessageResponse = {
  enabled: false,
  available: false,
};

async function sendRuntimeMessageToActiveTab(
  message: CopyAiIdRuntimeMessage,
): Promise<RuntimeStateMessageResponse> {
  if (
    !currentScopeContext
    || typeof chrome === 'undefined'
    || typeof chrome.tabs?.sendMessage !== 'function'
  ) {
    throw new Error('Copy AI ID active tab messaging is unavailable.');
  }

  const tabId = currentScopeContext.tabId;
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response?: RuntimeStateMessageResponse) => {
      const lastError = chrome.runtime?.lastError;
      if (lastError) {
        reject(new Error(lastError.message));
        return;
      }

      if (
        !response
        || typeof response.enabled !== 'boolean'
        || typeof response.available !== 'boolean'
      ) {
        reject(new Error('Copy AI ID active tab returned an invalid runtime state.'));
        return;
      }

      resolve(response);
    });
  });
}

function renderRuntimeState(state: RuntimeStateMessageResponse): void {
  currentRuntimeState = state;
  if (!state.available) {
    popupView.renderUnavailable();
    return;
  }

  popupView.renderEnabled(state.enabled);
}

async function refreshRuntimeState(): Promise<void> {
  currentScopeContext = await resolveActiveTabScopeContext();
  popupView.renderScope(currentScopeContext);

  if (!currentScopeContext) {
    popupView.renderUnavailable();
    return;
  }

  renderRuntimeState(await sendRuntimeMessageToActiveTab({
    type: RUNTIME_MESSAGE_TYPES.getState,
  }));
}

async function refreshFileAccessHint(): Promise<void> {
  if (typeof chrome === 'undefined' || typeof chrome.extension?.isAllowedFileSchemeAccess !== 'function') {
    popupView.renderFileAccessHint(false);
    return;
  }

  try {
    const hasFileAccess = await chrome.extension.isAllowedFileSchemeAccess();
    popupView.renderFileAccessHint(!hasFileAccess);
  } catch {
    popupView.renderFileAccessHint(false);
  }
}

async function toggleEnabledFromPopup(): Promise<void> {
  if (!currentScopeContext) {
    popupView.renderUnavailable();
    return;
  }

  popupView.setTogglePending(true);

  try {
    renderRuntimeState(await sendRuntimeMessageToActiveTab({
      type: RUNTIME_MESSAGE_TYPES.setEnabled,
      enabled: !currentRuntimeState.enabled,
    }));
    popupView.scheduleClose();
  } catch (error) {
    popupView.setTogglePending(false);
    throw error;
  }
}

function bindPopupEvents(): () => void {
  const handleToggleClick = (): void => {
    void toggleEnabledFromPopup();
  };

  const handleWindowFocus = (): void => {
    void refreshFileAccessHint();
  };

  const toggleButton = document.querySelector<HTMLButtonElement>('[data-ai-id="popup-toggle-button"]');
  if (!toggleButton) {
    throw new Error('Copy AI ID popup toggle button is missing.');
  }

  toggleButton.addEventListener('click', handleToggleClick);
  window.addEventListener('focus', handleWindowFocus);

  return () => {
    toggleButton.removeEventListener('click', handleToggleClick);
    window.removeEventListener('focus', handleWindowFocus);
  };
}

async function bootstrap(): Promise<void> {
  await Promise.all([
    refreshRuntimeState(),
    refreshFileAccessHint(),
  ]);

  const cleanupPopupEvents = bindPopupEvents();

  window.addEventListener('pagehide', () => {
    popupView.destroy();
    cleanupPopupEvents();
  });
}

void bootstrap().catch((error) => {
  console.error('Copy AI ID popup failed to initialize', error);
  popupView.renderUnavailable();
});
