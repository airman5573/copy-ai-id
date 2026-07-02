import {
  PREVIEW_QUICK_ACTION_TOOLBAR_Z_INDEX,
  QUICK_ACTION_BAR_ATTR,
} from '../../shared/config';

export const QUICK_ACTION_BAR_CLASS = 'copy-ai-id-quick-action-bar';
export const QUICK_ACTION_BAR_BUTTON_CLASS = 'copy-ai-id-quick-action-bar__button';
export const QUICK_ACTION_BAR_SEPARATOR_CLASS = 'copy-ai-id-quick-action-bar__separator';

export function toolbarCss(): string {
  return `
[${QUICK_ACTION_BAR_ATTR}] {
  all: initial;
  position: fixed;
  z-index: ${PREVIEW_QUICK_ACTION_TOOLBAR_Z_INDEX};
  display: flex;
  box-sizing: border-box;
  max-width: calc(100vw - 24px);
  align-items: center;
  gap: 4px;
  overflow-x: auto;
  overflow-y: hidden;
  border-radius: 8px;
  background: rgba(17, 24, 39, 0.94);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
  color: #e5e7eb;
  padding: 4px;
  pointer-events: auto;
  scrollbar-width: none;
  user-select: none;
  white-space: nowrap;
  -webkit-overflow-scrolling: touch;
}

[${QUICK_ACTION_BAR_ATTR}],
[${QUICK_ACTION_BAR_ATTR}] *,
[${QUICK_ACTION_BAR_ATTR}] *::before,
[${QUICK_ACTION_BAR_ATTR}] *::after {
  box-sizing: border-box;
}

[${QUICK_ACTION_BAR_ATTR}]::-webkit-scrollbar {
  display: none;
}

.${QUICK_ACTION_BAR_CLASS}--above {
  animation: copy-ai-id-quick-action-enter-above 110ms ease-out;
}

.${QUICK_ACTION_BAR_CLASS}--below {
  animation: copy-ai-id-quick-action-enter-below 110ms ease-out;
}

.${QUICK_ACTION_BAR_BUTTON_CLASS} {
  all: initial;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border: 1px solid rgba(75, 85, 99, 0.8);
  border-radius: 6px;
  background: rgba(31, 41, 55, 0.95);
  color: #e5e7eb;
  cursor: pointer;
  font: 600 11px/1 sans-serif;
  padding: 5px 8px;
  transition: border-color 90ms ease, background 90ms ease, color 90ms ease, opacity 90ms ease;
}

.${QUICK_ACTION_BAR_BUTTON_CLASS}:hover:not(:disabled),
.${QUICK_ACTION_BAR_BUTTON_CLASS}:focus-visible:not(:disabled),
.${QUICK_ACTION_BAR_BUTTON_CLASS}.is-active:not(:disabled) {
  border-color: rgba(96, 165, 250, 0.92);
  background: rgba(37, 99, 235, 0.95);
  color: #ffffff;
  outline: none;
}

.${QUICK_ACTION_BAR_BUTTON_CLASS}:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.${QUICK_ACTION_BAR_BUTTON_CLASS}--icon {
  min-width: 26px;
  padding-left: 6px;
  padding-right: 6px;
}

.${QUICK_ACTION_BAR_BUTTON_CLASS}--grip {
  cursor: grab;
}

.${QUICK_ACTION_BAR_BUTTON_CLASS}--grip.is-dragging {
  border-color: rgba(96, 165, 250, 0.92);
  background: rgba(37, 99, 235, 0.95);
  color: #ffffff;
  cursor: grabbing;
}

.${QUICK_ACTION_BAR_BUTTON_CLASS}--structure {
  min-width: 24px;
  padding-left: 7px;
  padding-right: 7px;
}

.${QUICK_ACTION_BAR_BUTTON_CLASS}--danger:not(:disabled) {
  color: #fca5a5;
}

.${QUICK_ACTION_BAR_SEPARATOR_CLASS} {
  width: 1px;
  align-self: stretch;
  margin: 2px 1px;
  background: rgba(75, 85, 99, 0.7);
}

@keyframes copy-ai-id-quick-action-enter-above {
  from {
    transform: translateY(3px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes copy-ai-id-quick-action-enter-below {
  from {
    transform: translateY(-3px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
`.trim();
}
