import {
  EDITOR_HOST_ATTR,
  EDITOR_UI_ATTR,
  OVERLAY_HOST_ATTR,
  PREVIEW_OVERLAY_ATTR,
} from '../../shared/config';

export interface RuntimeArtifactStripResult {
  html: string;
  strippedArtifacts: string[];
}

const RUNTIME_ELEMENT_SELECTORS = [
  `[${OVERLAY_HOST_ATTR}]`,
  `[${EDITOR_HOST_ATTR}]`,
  `[${EDITOR_UI_ATTR}]`,
  `[${PREVIEW_OVERLAY_ATTR}]`,
  '[data-ai-editor-overlay]',
  '[data-ai-editor-quick-actions]',
  '[data-ai-editor-floating-panel]',
  '[data-copy-ai-id-quick-action-bar]',
  '[data-copy-ai-id-floating-visual-panel]',
  '[data-copy-ai-id-visual-panel]',
  '[data-copy-ai-id-visual-overlay]',
  '[data-copy-ai-id-runtime-element]',
  'style[data-ai-editor-preview-scope]',
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
  'data-copy-ai-id-quick-action-bar',
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
  return stripRuntimeArtifactsWithReport(html).html;
}

export function stripRuntimeArtifactsWithReport(html: string): RuntimeArtifactStripResult {
  const template = document.createElement('template');
  template.innerHTML = html;
  const strippedArtifacts: string[] = [];

  removeRuntimeElements(template.content, strippedArtifacts);
  removeInlineTextEditingState(template.content, strippedArtifacts);
  removeRuntimeAttributesAndClassTokens(template.content, strippedArtifacts);

  return {
    html: template.innerHTML,
    strippedArtifacts: Array.from(new Set(strippedArtifacts)),
  };
}

export function stripRuntimeArtifactsFromElement(element: Element): RuntimeArtifactStripResult {
  return stripRuntimeArtifactsWithReport(element.innerHTML);
}

function removeRuntimeElements(root: DocumentFragment, strippedArtifacts: string[]): void {
  for (const element of queryAllSafe(root, RUNTIME_ELEMENT_SELECTORS)) {
    strippedArtifacts.push(describeElementArtifact('removed element', element));
    element.remove();
  }
}

function removeInlineTextEditingState(root: DocumentFragment, strippedArtifacts: string[]): void {
  for (const element of queryAllSafe(root, INLINE_TEXT_MARKER_SELECTORS)) {
    if (element.hasAttribute('contenteditable')) {
      strippedArtifacts.push(describeAttributeArtifact('removed contenteditable', element, 'contenteditable'));
      element.removeAttribute('contenteditable');
    }
    if (element.hasAttribute('spellcheck')) {
      strippedArtifacts.push(describeAttributeArtifact('removed spellcheck', element, 'spellcheck'));
      element.removeAttribute('spellcheck');
    }
  }
}

function removeRuntimeAttributesAndClassTokens(root: DocumentFragment, strippedArtifacts: string[]): void {
  for (const element of Array.from(root.querySelectorAll('*'))) {
    removeRuntimeAttributes(element, strippedArtifacts);
    removeRuntimeClassTokens(element, strippedArtifacts);
  }
}

function removeRuntimeAttributes(element: Element, strippedArtifacts: string[]): void {
  for (const attribute of Array.from(element.attributes)) {
    const name = attribute.name.toLowerCase();
    if (!isRuntimeAttribute(name, attribute.value)) {
      continue;
    }

    strippedArtifacts.push(describeAttributeArtifact('removed attribute', element, name));
    element.removeAttribute(attribute.name);
  }
}

function removeRuntimeClassTokens(element: Element, strippedArtifacts: string[]): void {
  const classAttribute = element.getAttribute('class');
  if (!classAttribute) {
    return;
  }

  const tokens = classAttribute.split(/\s+/).map((token) => token.trim()).filter(Boolean);
  const keptTokens = tokens.filter((token) => !isRuntimeClassToken(token));

  if (keptTokens.length === tokens.length) {
    return;
  }

  strippedArtifacts.push(describeAttributeArtifact('removed runtime class token', element, 'class'));
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

function describeElementArtifact(action: string, element: Element): string {
  return `${action}: ${element.tagName.toLowerCase()}${describeElementIdentity(element)}`;
}

function describeAttributeArtifact(action: string, element: Element, attribute: string): string {
  return `${action}: ${element.tagName.toLowerCase()}${describeElementIdentity(element)}[${attribute}]`;
}

function describeElementIdentity(element: Element): string {
  const id = element.getAttribute('id');
  if (id) {
    return `#${id}`;
  }

  const dataAiId = element.getAttribute('data-ai-id');
  if (dataAiId) {
    return `[data-ai-id="${dataAiId}"]`;
  }

  const className = element.getAttribute('class')?.split(/\s+/).filter(Boolean)[0];
  return className ? `.${className}` : '';
}
