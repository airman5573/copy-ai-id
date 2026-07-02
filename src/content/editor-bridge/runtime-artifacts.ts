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
  `[${QUICK_ACTION_BAR_ATTR}]`,
  '[data-copy-ai-id-visual-overlay]',
  `style[${QUICK_ACTION_STYLE_ATTR}]`,
].join(', ');

const RUNTIME_ATTRIBUTE_PREFIXES = [
  'data-ai-editor-',
  'data-copy-ai-id-',
] as const;

const RUNTIME_CLASS_PREFIXES = [
  'copy-ai-id-editor-',
  'copy-ai-id-preview-',
  'copy-ai-id-quick-action',
] as const;

/**
 * Return serialized HTML with editor/runtime-only DOM artifacts removed.
 *
 * This intentionally preserves authored `data-ai-id` values while removing
 * overlay nodes, temporary IDs, and preview-only style markers that should
 * never appear in copied rich-text/HTML instructions.
 */
export function stripRuntimeArtifacts(html: string): string {
  const template = document.createElement('template');
  template.innerHTML = html;

  removeRuntimeElements(template.content);
  removeRuntimeAttributesAndClassTokens(template.content);

  return template.innerHTML;
}

function removeRuntimeElements(root: DocumentFragment): void {
  for (const element of queryAllSafe(root, RUNTIME_ELEMENT_SELECTORS)) {
    element.remove();
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
    if (isRuntimeAttribute(name)) {
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

function isRuntimeAttribute(name: string): boolean {
  return RUNTIME_ATTRIBUTE_PREFIXES.some((prefix) => name.startsWith(prefix));
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
