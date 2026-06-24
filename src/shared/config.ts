export const APP_NAME = 'Copy AI ID';

export const DEFAULT_ENABLED: boolean = false;

export const DATA_AI_ID_ATTRIBUTE = 'data-ai-id';

export const OVERLAY_HOST_ATTR = 'data-copy-ai-id-overlay-host';

export const EDITOR_HOST_ATTR = 'data-copy-ai-id-editor-host';

export const EDITOR_UI_ATTR = 'data-ai-editor-ui';

export const PREVIEW_OVERLAY_ATTR = 'data-copy-ai-id-preview-overlay';

export const QUICK_ACTION_BAR_ATTR = 'data-copy-ai-id-quick-action-bar';

export const QUICK_ACTION_STYLE_ATTR = 'data-copy-ai-id-quick-action-style';

export const EXTENSION_OWNED_DOM_SELECTOR = [
  `[${OVERLAY_HOST_ATTR}]`,
  `[${EDITOR_HOST_ATTR}]`,
  `[${EDITOR_UI_ATTR}]`,
  `[${PREVIEW_OVERLAY_ATTR}]`,
  `[${QUICK_ACTION_BAR_ATTR}]`,
  `style[${QUICK_ACTION_STYLE_ATTR}]`,
].join(', ');

export const OVERLAY_Z_INDEX = 2147483647;

export function isExtensionOwnedElement(element: Element): boolean {
  return element.matches(EXTENSION_OWNED_DOM_SELECTOR)
    || element.closest(EXTENSION_OWNED_DOM_SELECTOR) !== null;
}
