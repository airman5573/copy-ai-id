import {
  EDITOR_HOST_ATTR,
  EDITOR_UI_ATTR,
  OVERLAY_HOST_ATTR,
  PREVIEW_OVERLAY_ATTR,
  QUICK_ACTION_BAR_ATTR,
  QUICK_ACTION_STYLE_ATTR,
} from '../../shared/config';

const RUNTIME_ELEMENT_SELECTORS = [
  `[${OVERLAY_HOST_ATTR}]`,
  `[${EDITOR_HOST_ATTR}]`,
  `[${EDITOR_UI_ATTR}]`,
  `[${PREVIEW_OVERLAY_ATTR}]`,
  '[data-ai-editor-overlay]',
  '[data-ai-editor-quick-actions]',
  '[data-ai-editor-floating-panel]',
  `[${QUICK_ACTION_BAR_ATTR}]`,
  '[data-copy-ai-id-floating-visual-panel]',
  '[data-copy-ai-id-visual-panel]',
  '[data-copy-ai-id-visual-overlay]',
  '[data-copy-ai-id-runtime-element]',
  'style[data-ai-editor-preview-scope]',
  `style[${QUICK_ACTION_STYLE_ATTR}]`,
  'style[data-copy-ai-id-preview-style]',
  'style[data-copy-ai-id-runtime-style]',
].join(', ');

const INLINE_TEXT_MARKER_SELECTORS = [
  '[data-ai-editor-inline-text-active]',
  '[data-ai-editor-inline-text-protected]',
  '[data-copy-ai-id-inline-text-active]',
  '[data-copy-ai-id-inline-text-protected]',
  '.ai-editor-inline-text-active',
  '.ai-editor-inline-text-protected',
  '.copy-ai-id-inline-text-active',
  '.copy-ai-id-inline-text-protected',
].join(', ');

const RUNTIME_ONLY_ATTRIBUTES = new Set([
  'data-ai-temp-id',
  'data-ai-editor-overlay',
  'data-ai-editor-preview-scope',
  'data-ai-editor-inline-text-active',
  'data-ai-editor-inline-text-protected',
  'data-ai-editor-quick-actions',
  'data-ai-editor-floating-panel',
  'data-copy-ai-id-temp-id',
  'data-copy-ai-id-preview-scope',
  'data-copy-ai-id-preview-style',
  'data-copy-ai-id-preview-mutation',
  'data-copy-ai-id-inline-text-active',
  'data-copy-ai-id-inline-text-protected',
  QUICK_ACTION_BAR_ATTR,
  QUICK_ACTION_STYLE_ATTR,
  'data-copy-ai-id-floating-visual-panel',
  'data-copy-ai-id-visual-panel',
  'data-copy-ai-id-visual-overlay',
  'data-copy-ai-id-runtime',
  'data-copy-ai-id-runtime-element',
  'data-copy-ai-id-runtime-style',
  'data-copy-ai-id-tree-node-id',
  'data-copy-ai-id-chip-id',
]);

const RUNTIME_ATTRIBUTE_PREFIXES = [
  'data-ai-editor-',
  'data-copy-ai-id-',
] as const;

const RUNTIME_CLASS_PREFIXES = [
  'ai-editor-preview-',
  'ai-editor-overlay',
  'ai-editor-quick-action',
  'copy-ai-id-editor-',
  'copy-ai-id-preview-',
  'copy-ai-id-quick-action',
  'copy-ai-id-visual-panel',
  'copy-ai-id-floating-visual-panel',
  'copy-ai-id-inline-text-',
] as const;

const RUNTIME_ID_PREFIXES = [
  'ai-editor-preview-',
  'copy-ai-id-editor-',
  'copy-ai-id-preview-',
  'copy-ai-id-quick-action-',
  'copy-ai-id-visual-panel-',
] as const;

/**
 * Return serialized HTML with editor/runtime-only DOM artifacts removed.
 *
 * This intentionally preserves authored `data-ai-id` values while removing
 * overlay nodes, temporary IDs, inline-editing markers, and preview-only style
 * markers that should never appear in copied rich-text/HTML instructions.
 */
export function stripRuntimeArtifacts(html: string): string {
  const template = document.createElement('template');
  template.innerHTML = html;

  removeRuntimeElements(template.content);
  removeInlineTextEditingState(template.content);
  removeRuntimeAttributesAndClassTokens(template.content);

  return template.innerHTML;
}

function removeRuntimeElements(root: DocumentFragment): void {
  for (const element of queryAllSafe(root, RUNTIME_ELEMENT_SELECTORS)) {
    element.remove();
  }
}

function removeInlineTextEditingState(root: DocumentFragment): void {
  for (const element of queryAllSafe(root, INLINE_TEXT_MARKER_SELECTORS)) {
    element.removeAttribute('contenteditable');
    element.removeAttribute('spellcheck');
  }
}

function removeRuntimeAttributesAndClassTokens(root: DocumentFragment): void {
  for (const element of Array.from(root.querySelectorAll('*'))) {
    removeRuntimeAttributes(element);
    removeRuntimeClassTokens(element);
  }
}

function removeRuntimeAttributes(element: Element): void {
  for (const attribute of Array.from(element.attributes)) {
    const name = attribute.name.toLowerCase();
    if (isRuntimeAttribute(name, attribute.value)) {
      element.removeAttribute(attribute.name);
    }
  }
}

function removeRuntimeClassTokens(element: Element): void {
  const classAttribute = element.getAttribute('class');
  if (!classAttribute) {
    return;
  }

  const tokens = classAttribute.split(/\s+/).map((token) => token.trim()).filter(Boolean);
  const keptTokens = tokens.filter((token) => !isRuntimeClassToken(token));

  if (keptTokens.length === tokens.length) {
    return;
  }

  if (keptTokens.length > 0) {
    element.setAttribute('class', keptTokens.join(' '));
  } else {
    element.removeAttribute('class');
  }
}

function isRuntimeAttribute(name: string, value: string): boolean {
  if (RUNTIME_ONLY_ATTRIBUTES.has(name)) {
    return true;
  }

  if (RUNTIME_ATTRIBUTE_PREFIXES.some((prefix) => name.startsWith(prefix))) {
    return true;
  }

  if (name === 'id') {
    return RUNTIME_ID_PREFIXES.some((prefix) => value.startsWith(prefix));
  }

  return false;
}

function isRuntimeClassToken(token: string): boolean {
  return RUNTIME_CLASS_PREFIXES.some((prefix) => token.startsWith(prefix));
}

function queryAllSafe(root: DocumentFragment, selector: string): Element[] {
  try {
    return Array.from(root.querySelectorAll(selector));
  } catch {
    return [];
  }
}
