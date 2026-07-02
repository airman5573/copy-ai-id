import { formatInlineCode } from '../../lib/format';
import {
  $getRoot,
  $isElementNode,
  $isLineBreakNode,
  $isTextNode,
  type LexicalNode,
} from 'lexical';

import type { EditorTarget } from '../../../shared/domain/targets';
import { $isChipNode, type ChipNode } from './ChipNode';

export interface ExportedChipTarget {
  chipId: string;
  target: EditorTarget;
  nodeId: string | null;
}

export interface NotebookLexicalExport {
  text: string;
  chips: ExportedChipTarget[];
  chipTargetMap: string;
  hasFallbackTargets: boolean;
  isEmpty: boolean;
}

export interface FormatNotebookCopyBodyOptions {
  additionalTargetDetails?: string;
}

const CHIP_MARKER_PATTERN = /\[chip\](el-\d+)\[\/chip\]/g;

export function formatChipMarker(chipId: string): string {
  return `[chip]${chipId}[/chip]`;
}

export function formatNotebookCopyBody(
  value: string,
  chips: readonly ExportedChipTarget[],
  options: FormatNotebookCopyBodyOptions = {},
): string {
  const trimmedValue = value.trimEnd();
  const sections = [
    '## Requests',
    '',
    formatRequestTextForCopy(trimmedValue),
  ];
  const targetDetails = [
    formatChipTargetDetails(chips),
    options.additionalTargetDetails?.trim() ?? '',
  ].filter(Boolean).join('\n\n');

  if (targetDetails) {
    sections.push('', '## Targets', '', targetDetails);
  }

  return sections.join('\n').trimEnd();
}

export function formatChipTargetMap(chips: readonly ExportedChipTarget[]): string {
  if (chips.length === 0) {
    return '';
  }

  return [
    '[chip targets]',
    ...chips.map(formatChipTargetMapLine),
    '[/chip targets]',
  ].join('\n');
}

export function formatChipTargetMapLine(chip: ExportedChipTarget): string {
  return `${chip.chipId}: ${formatChipTargetDescription(chip.target)}`;
}

export function formatChipTargetDescription(target: EditorTarget): string {
  if (target.kind === 'ai-id') {
    const instanceSuffix = target.instanceIndex > 0
      ? ` (instance ${target.instanceIndex + 1})`
      : '';

    return `data-ai-id "${target.aiId}"${instanceSuffix}`;
  }

  return `fallback ${target.label} (${target.selectorKind})`;
}

export function formatRequestTextForCopy(value: string): string {
  return replaceChipMarkersWithMentions(value).trimEnd();
}

export function formatChipTargetDetails(chips: readonly ExportedChipTarget[]): string {
  return chips.map(formatChipTargetDetail).join('\n\n');
}

export function hasFallbackChipTargets(chips: readonly ExportedChipTarget[]): boolean {
  return chips.some((chip) => chip.target.kind === 'fallback');
}

export function $exportNotebookLexicalState(): NotebookLexicalExport {
  const chips: ExportedChipTarget[] = [];
  const seenChipIds = new Set<string>();
  const text = $getRoot()
    .getChildren()
    .map((child) => $exportNodeText(child, chips, seenChipIds))
    .join('\n');

  return {
    text,
    chips,
    chipTargetMap: formatChipTargetMap(chips),
    hasFallbackTargets: hasFallbackChipTargets(chips),
    isEmpty: text.trim().length === 0,
  };
}

function $exportNodeText(
  node: LexicalNode,
  chips: ExportedChipTarget[],
  seenChipIds: Set<string>,
): string {
  if ($isChipNode(node)) {
    return $exportChipNode(node, chips, seenChipIds);
  }

  if ($isLineBreakNode(node)) {
    return '\n';
  }

  if ($isTextNode(node)) {
    return node.getTextContent();
  }

  if ($isElementNode(node)) {
    return node
      .getChildren()
      .map((child) => $exportNodeText(child, chips, seenChipIds))
      .join('');
  }

  return node.getTextContent();
}

function $exportChipNode(
  node: ChipNode,
  chips: ExportedChipTarget[],
  seenChipIds: Set<string>,
): string {
  const chipId = node.getChipId();

  if (!seenChipIds.has(chipId)) {
    chips.push({
      chipId,
      target: node.getTarget(),
      nodeId: node.getNodeId(),
    });
    seenChipIds.add(chipId);
  }

  return formatChipMarker(chipId);
}

function replaceChipMarkersWithMentions(value: string): string {
  return value.replace(CHIP_MARKER_PATTERN, (fullMatch, chipId: string, offset: number, input: string) => {
    const previousCharacter = offset > 0 ? input[offset - 1] : '';
    const nextCharacter = input[offset + fullMatch.length] ?? '';
    const prefix = previousCharacter && !/\s/.test(previousCharacter) ? ' ' : '';
    const suffix = nextCharacter && shouldSeparateMentionFromNextCharacter(nextCharacter) ? ' ' : '';

    return `${prefix}@${chipId}${suffix}`;
  });
}

function shouldSeparateMentionFromNextCharacter(character: string): boolean {
  return !/[\s.,!?;:)\]}]/.test(character);
}

function formatChipTargetDetail(chip: ExportedChipTarget): string {
  const lines = [`### ${formatInlineCode(chip.chipId)}`];
  const { target } = chip;

  if (target.kind === 'ai-id') {
    lines.push('- Kind: stable data-ai-id target');
    lines.push(`- data-ai-id: ${formatInlineCode(target.aiId)}`);

    if (target.instanceIndex > 0) {
      lines.push(`- Instance: ${target.instanceIndex + 1} of the repeated data-ai-id`);
    }

    return lines.join('\n');
  }

  lines.push(`- Kind: fallback target (selector reliability: ${formatInlineCode(target.selectorKind)})`);
  lines.push(`- Element: ${formatInlineCode(target.tagName)} — ${target.label}`);
  lines.push(`- Selector: ${formatInlineCode(target.selector)}`);
  lines.push(`- DOM path: ${formatInlineCode(target.path)}`);

  const context = target.nearbyText || target.textPreview || target.accessibility || target.classTokens.join(' ');
  if (context) {
    lines.push(`- Context: ${context}`);
  }

  return lines.join('\n');
}

