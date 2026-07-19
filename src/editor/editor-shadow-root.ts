import { EDITOR_HOST_ATTR } from '../shared/config';

// The editor shadow root is closed (main.tsx), so window-level listeners
// receive events retargeted to the host element with composedPath() truncated
// there — editor-internal elements are invisible to them. The mounted editor
// retains its ShadowRoot here so those listeners can still resolve which
// editor-internal element an event came from.

let editorShadowRoot: ShadowRoot | null = null;

export function setEditorShadowRoot(shadowRoot: ShadowRoot | null): void {
  editorShadowRoot = shadowRoot;
}

// Effective event element for window-level listeners. Events from the light
// DOM resolve to their real target; events retargeted to the closed editor
// host resolve through the retained ShadowRoot — hit-tested for pointer
// events, the shadow-focused element otherwise (keyboard/input/focus events
// always target the focused element).
export function resolveEditorEventElement(event: Event): Element | null {
  const target = event.target;
  if (!(target instanceof Element)) {
    return null;
  }

  if (!target.hasAttribute(EDITOR_HOST_ATTR)) {
    return target;
  }

  if (!editorShadowRoot) {
    return target;
  }

  if (event instanceof MouseEvent) {
    return editorShadowRoot.elementFromPoint(event.clientX, event.clientY);
  }

  return editorShadowRoot.activeElement;
}
