import type {
  AiIdEditorTarget,
  EditorTarget,
  FallbackEditorTarget,
} from './editor-messages';

export function isAiIdTarget(target: EditorTarget | null | undefined): target is AiIdEditorTarget {
  return target?.kind === 'ai-id';
}

export function isFallbackTarget(target: EditorTarget | null | undefined): target is FallbackEditorTarget {
  return target?.kind === 'fallback';
}

export function targetIdentityKey(target: EditorTarget | null | undefined): string {
  if (!target) {
    return '';
  }

  if (isAiIdTarget(target)) {
    return `ai-id:${target.aiId}:${target.instanceIndex}`;
  }

  return `fallback:${target.nodeId}`;
}

export function hasSameEditorTarget(
  first: EditorTarget | null | undefined,
  second: EditorTarget | null | undefined,
): boolean {
  if (first === second) {
    return true;
  }

  if (!first || !second) {
    return false;
  }

  return targetIdentityKey(first) === targetIdentityKey(second);
}
