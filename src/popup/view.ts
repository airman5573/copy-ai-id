import { APP_NAME } from '../shared/config';
import { getCurrentMessages } from '../shared/i18n';
import type { PopupScopeContext } from './active-tab-scope';

export interface PopupView {
  currentScopeKey: string | null;
  renderEnabled(enabled: boolean): void;
  renderUnavailable(): void;
  renderScope(scopeContext: PopupScopeContext | null): void;
  renderFileAccessHint(show: boolean): void;
  setTogglePending(isPending: boolean): void;
  scheduleClose(): void;
  destroy(): void;
}

const POPUP_CLOSE_DELAY_MS = 600;

function queryRequiredPopupElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`${APP_NAME} popup DOM is missing required element: ${selector}`);
  }

  return element;
}

function renderTrustedPopupMarkup(element: HTMLElement, markup: string): void {
  // The popup message markup is intentionally developer-controlled in
  // src/shared/i18n.ts and is limited to small emphasis/code snippets. Do not
  // pass page data, user input, translator-managed remote content, or extension
  // storage values into this helper.
  element.innerHTML = markup;
}

export function createPopupView(): PopupView {
  const messages = getCurrentMessages();
  const card = queryRequiredPopupElement<HTMLElement>('[data-ai-id="popup-card"]');
  const shortcutHint = queryRequiredPopupElement<HTMLElement>('[data-ai-id="popup-shortcut-hint"]');
  const toggleButton = queryRequiredPopupElement<HTMLButtonElement>('[data-ai-id="popup-toggle-button"]');
  const fileAccessHint = document.querySelector<HTMLElement>('[data-ai-id="popup-file-access-hint"]');

  let currentScopeKey: string | null = null;
  let closePopupTimer: number | null = null;

  function clearClosePopupTimer(): void {
    if (closePopupTimer === null) {
      return;
    }

    window.clearTimeout(closePopupTimer);
    closePopupTimer = null;
  }

  function renderStaticText(): void {
    document.documentElement.lang = messages.htmlLang;
    renderTrustedPopupMarkup(shortcutHint, messages.popup.shortcutHintHtml);

    if (fileAccessHint) {
      renderTrustedPopupMarkup(fileAccessHint, messages.popup.fileAccessHintHtml);
    }
  }

  renderStaticText();

  return {
    get currentScopeKey() {
      return currentScopeKey;
    },
    renderEnabled(enabled: boolean) {
      card.dataset.enabled = String(enabled);
      card.dataset.state = enabled ? 'on' : 'off';
      toggleButton.textContent = enabled ? messages.popup.turnOff : messages.popup.turnOn;
      toggleButton.dataset.enabled = String(enabled);
      toggleButton.setAttribute('aria-pressed', String(enabled));
    },
    renderUnavailable() {
      card.dataset.enabled = 'false';
      card.dataset.state = 'error';
      toggleButton.disabled = true;
      toggleButton.textContent = messages.popup.unavailable;
      currentScopeKey = null;
    },
    renderScope(scopeContext) {
      currentScopeKey = scopeContext?.scopeKey ?? null;
    },
    renderFileAccessHint(show: boolean) {
      if (!fileAccessHint) {
        return;
      }

      fileAccessHint.hidden = !show;
    },
    setTogglePending(isPending: boolean) {
      toggleButton.disabled = isPending;
    },
    scheduleClose() {
      clearClosePopupTimer();
      closePopupTimer = window.setTimeout(() => {
        window.close();
      }, POPUP_CLOSE_DELAY_MS);
    },
    destroy() {
      clearClosePopupTimer();
    },
  };
}
