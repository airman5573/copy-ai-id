export const APP_NAME = 'Copy AI ID';

export const DEFAULT_ENABLED: boolean = false;

export const DATA_AI_ID_ATTRIBUTE = 'data-ai-id';

export const OVERLAY_HOST_ATTR = 'data-copy-ai-id-overlay-host';

export const EDITOR_HOST_ATTR = 'data-copy-ai-id-editor-host';

export const EDITOR_UI_ATTR = 'data-ai-editor-ui';

export const PREVIEW_OVERLAY_ATTR = 'data-copy-ai-id-preview-overlay';

export const QUICK_ACTION_BAR_ATTR = 'data-copy-ai-id-quick-action-bar';

export const QUICK_ACTION_STYLE_ATTR = 'data-copy-ai-id-quick-action-style';

// Invariant: every runtime element this extension injects into the preview
// page DOM must match this selector (directly or via an ancestor). Overlay
// boxes, the drop indicator, and box-model layers all carry
// PREVIEW_OVERLAY_ATTR; the quick-action toolbar carries
// QUICK_ACTION_BAR_ATTR and its style tag QUICK_ACTION_STYLE_ATTR.
export const EXTENSION_OWNED_DOM_SELECTOR = [
  `[${OVERLAY_HOST_ATTR}]`,
  `[${EDITOR_HOST_ATTR}]`,
  `[${EDITOR_UI_ATTR}]`,
  `[${PREVIEW_OVERLAY_ATTR}]`,
  `[${QUICK_ACTION_BAR_ATTR}]`,
  `style[${QUICK_ACTION_STYLE_ATTR}]`,
].join(', ');

// Layering constants. The editor host lives in the top-frame document while
// the preview overlays/toolbar live in the preview iframe document — the two
// groups are separate stacking contexts and are not ordered against each
// other. Values are load-bearing; do not renumber.
export const EDITOR_HOST_Z_INDEX = 2147483646;
export const PREVIEW_DROP_INDICATOR_Z_INDEX = 2147483647;
export const PREVIEW_BOX_MODEL_HOVER_Z_INDEX = 2147483645;
export const PREVIEW_BOX_MODEL_CONTROL_Z_INDEX = 2147483647;
export const PREVIEW_QUICK_ACTION_TOOLBAR_Z_INDEX = 2147483647;
// Above the hover box-model, below the control/drop-indicator layers.
export const PREVIEW_CHIP_BADGE_Z_INDEX = 2147483646;

export function isExtensionOwnedElement(element: Element): boolean {
  return element.matches(EXTENSION_OWNED_DOM_SELECTOR)
    || element.closest(EXTENSION_OWNED_DOM_SELECTOR) !== null;
}
