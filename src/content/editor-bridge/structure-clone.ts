import { isExtensionOwnedElement } from '../../shared/config';
import { stripRuntimeArtifacts } from './runtime-artifacts';

// Clone/parse helpers for preview-only structure mutations: clones are
// scrubbed of extension runtime artifacts before re-insertion.
export function elementFromHtml(html: string): Element | null {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
}

export function cloneStructureElement(element: Element): Element {
  const cleanedHtml = stripRuntimeArtifacts(element.outerHTML);
  const parsedClone = elementFromHtml(cleanedHtml);

  if (parsedClone && parsedClone.tagName.toLowerCase() === element.tagName.toLowerCase()) {
    return parsedClone;
  }

  const clone = element.cloneNode(true) as Element;
  removeRuntimeArtifactsFromClone(clone);
  return clone;
}

function removeRuntimeArtifactsFromClone(root: Element): void {
  const candidates = [root, ...Array.from(root.querySelectorAll('*'))];

  for (const candidate of candidates) {
    if (candidate !== root && isExtensionOwnedElement(candidate)) {
      candidate.remove();
      continue;
    }

    for (const attribute of Array.from(candidate.attributes)) {
      const name = attribute.name.toLowerCase();
      if (
        name === 'data-ai-temp-id'
        || name.startsWith('data-ai-editor-')
        || name.startsWith('data-copy-ai-id-')
      ) {
        candidate.removeAttribute(attribute.name);
      }
    }
  }
}
