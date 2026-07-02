import { DATA_AI_ID_ATTRIBUTE } from '../../shared/config';
import type { EditorTarget } from '../../shared/editor-messages';
import { fallbackTargetForElement } from './fallback-target';
import { instancesOf, resolveNodeIdForElement } from './layout-tree';

export interface EditorTargetForElementOptions {
  /**
   * Resolves the instance index for a data-ai-id element. Defaults to the
   * layout-tree registry; structure mutations pass a live-DOM resolver because
   * freshly inserted clones are not registered until the next tree rebuild.
   */
  resolveInstanceIndex?: (aiId: string, element: Element) => number;
}

export function editorTargetForElement(
  element: Element,
  options: EditorTargetForElementOptions = {},
): EditorTarget | null {
  const aiId = element.getAttribute(DATA_AI_ID_ATTRIBUTE)?.trim() ?? '';
  if (aiId) {
    const resolveInstanceIndex = options.resolveInstanceIndex ?? registeredAiIdInstanceIndex;
    return {
      kind: 'ai-id',
      aiId,
      instanceIndex: resolveInstanceIndex(aiId, element),
    };
  }

  return fallbackTargetForElement(element, resolveNodeIdForElement(element));
}

export function registeredAiIdInstanceIndex(aiId: string, element: Element): number {
  return Math.max(0, instancesOf(aiId).indexOf(element));
}
