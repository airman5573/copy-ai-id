import {
  DATA_AI_ID_ATTRIBUTE,
  isExtensionOwnedElement,
} from '../../shared/config';
import {
  elementOwnText,
  tokenizeClassValue,
} from './lib/text';
import {
  EDITOR_MESSAGE_TYPES,
  type LayoutTreeMessage,
  type LayoutTreeNode,
} from '../../shared/editor-messages';
import { getComposedChildElements } from '../target/composed-dom';
import { fallbackMetadataForElement } from './fallback-target';

const TREE_TEXT_PREVIEW_LENGTH = 60;
const SKIPPED_TAGS = new Set(['script', 'style', 'link', 'meta', 'noscript', 'template']);

let nodeElements = new Map<string, Element>();
let aiIdInstances = new Map<string, Element[]>();
let elementNodeIds = new WeakMap<Element, string>();

export interface LayoutTreeBuildResult {
  message: LayoutTreeMessage;
  aiIdCount: number;
}

export type LayoutTreePost = (message: LayoutTreeMessage) => void;

export function resolveTreeNode(nodeId: string): Element | null {
  const element = nodeElements.get(nodeId) ?? null;
  return element && element.isConnected ? element : null;
}

export function resolveNodeIdForElement(element: Element): string | null {
  return elementNodeIds.get(element) ?? null;
}

export function instancesOf(aiId: string): Element[] {
  return aiIdInstances.get(aiId) ?? [];
}

export function resolveAiTarget(aiId: string, instanceIndex: number): Element | null {
  const element = instancesOf(aiId)[instanceIndex] ?? null;
  return element && element.isConnected ? element : null;
}

export function buildAndPostLayoutTreeSnapshot(post: LayoutTreePost): LayoutTreeBuildResult {
  const result = buildLayoutTreeSnapshot();
  post(result.message);
  return result;
}

export function buildLayoutTreeSnapshot(): LayoutTreeBuildResult {
  nodeElements = new Map();
  elementNodeIds = new WeakMap();
  aiIdInstances = new Map();
  const root = document.body ? buildNode(document.body, '0') : null;

  if (root) {
    applyDuplicateCounts(root);
  }

  return {
    message: {
      type: EDITOR_MESSAGE_TYPES.layoutTree,
      url: window.location.href,
      root,
    },
    aiIdCount: countUsableAiIdInstances(),
  };
}

function buildNode(element: Element, nodeId: string): LayoutTreeNode {
  nodeElements.set(nodeId, element);
  elementNodeIds.set(element, nodeId);

  const aiId = normalizeAiId(element.getAttribute(DATA_AI_ID_ATTRIBUTE));
  const instanceIndex = aiId ? registerAiIdInstance(aiId, element) : 0;
  const rect = element.getBoundingClientRect();
  const tagName = element.tagName.toLowerCase();
  const classTokens = tokenizeClassValue(element.getAttribute('class') ?? '');
  const textPreview = directTextPreview(element);
  const children: LayoutTreeNode[] = [];

  for (const child of getComposedChildElements(element)) {
    if (shouldSkip(child)) {
      continue;
    }

    children.push(buildNode(child, `${nodeId}/${children.length}`));
  }

  return {
    nodeId,
    tagName,
    aiId,
    instanceIndex,
    duplicateCount: aiId ? 1 : 0,
    classTokens,
    textPreview,
    fallback: aiId ? null : fallbackMetadataForElement(element),
    isVisible: rect.width > 0 && rect.height > 0,
    children,
  };
}

function registerAiIdInstance(aiId: string, element: Element): number {
  const bucket = aiIdInstances.get(aiId) ?? [];
  const instanceIndex = bucket.length;
  bucket.push(element);
  aiIdInstances.set(aiId, bucket);
  return instanceIndex;
}

function applyDuplicateCounts(node: LayoutTreeNode): void {
  if (node.aiId) {
    node.duplicateCount = instancesOf(node.aiId).length;
  }

  for (const child of node.children) {
    applyDuplicateCounts(child);
  }
}

function countUsableAiIdInstances(): number {
  let count = 0;
  for (const instances of aiIdInstances.values()) {
    count += instances.length;
  }
  return count;
}

function shouldSkip(element: Element): boolean {
  const tagName = element.tagName.toLowerCase();
  return SKIPPED_TAGS.has(tagName) || isExtensionOwnedElement(element);
}

function normalizeAiId(value: string | null): string | null {
  const normalized = value?.trim() ?? '';
  return normalized.length > 0 ? normalized : null;
}

function directTextPreview(element: Element): string {
  return trimPreview(elementOwnText(element));
}

function trimPreview(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > TREE_TEXT_PREVIEW_LENGTH
    ? `${normalized.slice(0, TREE_TEXT_PREVIEW_LENGTH)}…`
    : normalized;
}
