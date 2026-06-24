import { getNotebookBreakpointScopeSuffix } from './breakpoint-scope';
import { getCurrentMessages } from '../../shared/i18n';
import type { NotebookSuffixSettings } from './suffix-settings';

interface NotebookSuffixContext {
  hasAiIdTargets?: boolean;
  hasFallbackTargets?: boolean;
}

export function appendNotebookSuffixes(
  value: string,
  suffixSettings: NotebookSuffixSettings,
  context: NotebookSuffixContext = {},
): string {
  const messages = getCurrentMessages();
  const suffixLines = [
    getViewportScopeSuffix(suffixSettings),
    suffixSettings.tailwindEnabled ? messages.notebook.tailwindSuffix : '',
    getTargetNoticeSuffix(value, suffixSettings, context),
  ].filter((line) => line.trim().length > 0);

  const trimmedValue = value.trimEnd();
  if (suffixLines.length === 0) {
    return trimmedValue;
  }

  return `${trimmedValue}\n\n## Rules\n\n${suffixLines.join('\n')}`;
}

function getViewportScopeSuffix(suffixSettings: NotebookSuffixSettings): string {
  if (suffixSettings.breakpointMode !== 'manual') {
    return '';
  }

  return getNotebookBreakpointScopeSuffix(suffixSettings.breakpointScopes);
}

function getTargetNoticeSuffix(
  value: string,
  suffixSettings: NotebookSuffixSettings,
  context: NotebookSuffixContext,
): string {
  const messages = getCurrentMessages();
  const targetNotice = suffixSettings.targetNotice.trimEnd();
  const fallbackNotice = messages.notebook.fallbackTargetNotice.trimEnd();
  const hasAiIdTargets = context.hasAiIdTargets || hasStableDataAiIdReference(value);
  const hasFallbackTargets = context.hasFallbackTargets || hasFallbackReferenceBlock(value);
  const noticeLines: string[] = [];

  if (hasAiIdTargets && targetNotice) {
    noticeLines.push(targetNotice);
  }

  if (
    hasFallbackTargets
    && fallbackNotice
    && !noticeLines.some((line) => line.includes(fallbackNotice))
  ) {
    noticeLines.push(fallbackNotice);
  }

  return noticeLines.join('\n');
}

function hasStableDataAiIdReference(value: string): boolean {
  return /^- Kind: stable data-ai-id target$/m.test(value) || /^- data-ai-id:/m.test(value);
}

function hasFallbackReferenceBlock(value: string): boolean {
  return /^\[fallback target\][\s\S]*?^\[\/fallback target\]/m.test(value)
    || /^- Kind: fallback target /m.test(value);
}
