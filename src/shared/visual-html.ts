/**
 * DOMPurify-based HTML fragment sanitizer. DOM-dependent (uses
 * document.createElement), so it is only valid in content-script and
 * editor contexts — not a pure shared utility.
 */
import DOMPurify from 'dompurify';

import { DATA_AI_ID_ATTRIBUTE } from './config';

export interface VisualHtmlSanitizeResult {
  html: string;
  changed: boolean;
  strippedRuntimeArtifacts: string[];
}

const FORBIDDEN_TAGS = [
  'base',
  'embed',
  'iframe',
  'link',
  'meta',
  'object',
  'script',
  'style',
] as const;

const DANGEROUS_URL_ATTRIBUTES = new Set([
  'action',
  'background',
  'formaction',
  'href',
  'poster',
  'src',
  'srcset',
  'xlink:href',
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

const SAFE_DATA_URL_PATTERN = /^data:image\/(?:avif|bmp|gif|jpeg|jpg|png|svg\+xml|webp);/i;

export function sanitizeVisualHtmlFragment(html: string): VisualHtmlSanitizeResult {
  const input = html ?? '';
  const purified = String(DOMPurify.sanitize(input, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: [...FORBIDDEN_TAGS],
    FORBID_ATTR: ['srcdoc'],
    ALLOW_DATA_ATTR: true,
  }));
  const postProcessed = stripUnsafeAndRuntimeArtifacts(purified);

  return {
    html: postProcessed.html,
    changed: postProcessed.html !== input,
    strippedRuntimeArtifacts: postProcessed.strippedArtifacts,
  };
}

function stripUnsafeAndRuntimeArtifacts(html: string): { html: string; strippedArtifacts: string[] } {
  const template = document.createElement('template');
  template.innerHTML = html;
  const strippedArtifacts: string[] = [];

  for (const element of Array.from(template.content.querySelectorAll('*'))) {
    stripElementAttributes(element, strippedArtifacts);
  }

  return {
    html: template.innerHTML,
    strippedArtifacts: Array.from(new Set(strippedArtifacts)),
  };
}

function stripElementAttributes(element: Element, strippedArtifacts: string[]): void {
  for (const attribute of Array.from(element.attributes)) {
    const name = attribute.name.toLowerCase();
    const value = attribute.value;

    if (shouldRemoveAttribute(name, value)) {
      strippedArtifacts.push(describeAttributeArtifact('removed unsafe/runtime attribute', element, name));
      element.removeAttribute(attribute.name);
      continue;
    }

    if (name === 'class') {
      stripRuntimeClassTokens(element, strippedArtifacts);
    }
  }
}

function shouldRemoveAttribute(name: string, value: string): boolean {
  if (name.startsWith('on') || name === 'srcdoc') {
    return true;
  }

  if (name === 'id' && RUNTIME_ID_PREFIXES.some((prefix) => value.startsWith(prefix))) {
    return true;
  }

  if (name !== DATA_AI_ID_ATTRIBUTE && RUNTIME_ATTRIBUTE_PREFIXES.some((prefix) => name.startsWith(prefix))) {
    return true;
  }

  if (DANGEROUS_URL_ATTRIBUTES.has(name) && hasDangerousUrlValue(value, name)) {
    return true;
  }

  return false;
}

function hasDangerousUrlValue(value: string, attributeName: string): boolean {
  const tokens = attributeName === 'srcset'
    ? value.split(',').map((part) => part.trim().split(/\s+/, 1)[0] ?? '')
    : [value];

  return tokens.some((token) => isDangerousUrl(token));
}

function isDangerousUrl(value: string): boolean {
  const normalized = value.trim().replace(/[\u0000-\u001f\u007f\s]+/g, '').toLowerCase();

  if (!normalized) {
    return false;
  }

  if (normalized.startsWith('#') || normalized.startsWith('/') || normalized.startsWith('./') || normalized.startsWith('../')) {
    return false;
  }

  if (normalized.startsWith('data:')) {
    return !SAFE_DATA_URL_PATTERN.test(normalized);
  }

  return normalized.startsWith('javascript:') || normalized.startsWith('vbscript:');
}

function stripRuntimeClassTokens(element: Element, strippedArtifacts: string[]): void {
  const classAttribute = element.getAttribute('class');
  if (!classAttribute) {
    return;
  }

  const tokens = classAttribute.split(/\s+/).map((token) => token.trim()).filter(Boolean);
  const keptTokens = tokens.filter((token) => !RUNTIME_CLASS_PREFIXES.some((prefix) => token.startsWith(prefix)));

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

function describeAttributeArtifact(action: string, element: Element, attribute: string): string {
  return `${action}: ${element.tagName.toLowerCase()}${describeElementIdentity(element)}[${attribute}]`;
}

function describeElementIdentity(element: Element): string {
  const aiId = element.getAttribute(DATA_AI_ID_ATTRIBUTE);
  if (aiId) {
    return `[${DATA_AI_ID_ATTRIBUTE}="${aiId}"]`;
  }

  const id = element.getAttribute('id');
  if (id) {
    return `#${id}`;
  }

  return '';
}
