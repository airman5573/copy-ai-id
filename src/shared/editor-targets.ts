import type {
  AiIdEditorTarget,
  EditorTarget,
  FallbackEditorTarget,
} from './editor-messages';
import { getCurrentMessages } from './i18n';

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

export function formatEditorTargetReference(target: EditorTarget): string {
  // Legacy plain-text target format. New notebook insertions are represented as
  // Lexical ChipNode instances; this formatter is intentionally kept only for
  // old raw drafts that may still be loaded or copied as ordinary text.
  if (isAiIdTarget(target)) {
    return `\`[${target.aiId}]\``;
  }

  const messages = getCurrentMessages();
  const lines = [
    '[fallback target]',
    `Element: ${target.label}`,
    `Selector: ${target.selector}`,
    `${messages.editor.fallbackSelectorType}: ${target.selectorKind}`,
    `Path: ${target.path}`,
    target.nearbyText || target.textPreview ? `Context: ${target.nearbyText || target.textPreview}` : '',
    '[/fallback target]',
  ].filter(Boolean);

  return lines.join('\n');
}
