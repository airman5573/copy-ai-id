import {
  getNotebookChipIndex,
  isNotebookChipId,
  normalizeNextNotebookChipIndex,
} from './lexical/chip-ids';
import type { EditorTarget, FallbackSelectorKind } from '../../shared/domain/targets';
import type { ExportedChipTarget } from './lexical/chip-export';

const NOTEBOOK_DRAFT_STORAGE_KEY_PREFIX = 'copy-ai-id:notebook-draft:v1:';
const NOTEBOOK_DRAFT_SESSION_VERSION = 2;
const SERIALIZED_CHIP_NODE_TYPE = 'copy-ai-id-chip';
const FALLBACK_SELECTOR_KINDS = new Set<FallbackSelectorKind>([
  'unique-semantic-tag',
  'id',
  'unique-class',
  'nth-child',
  'shadow-path',
]);

export interface NotebookDraftSessionPersistence {
  read(): NotebookDraftSessionSnapshot | null;
  write(snapshot: NotebookDraftSessionSnapshot): void;
}

export interface NotebookDraftSessionSnapshot {
  draft: string;
  editorStateJson: string | null;
  nextChipIndex: number;
}

interface PersistedNotebookDraftSessionPayload extends Record<string, unknown> {
  version: typeof NOTEBOOK_DRAFT_SESSION_VERSION;
  draft: string;
  editorStateJson: string | null;
  nextChipIndex: number;
}

function createNotebookDraftScopeKey(sourceUrl: string): string | null {
  try {
    const url = new URL(sourceUrl);

    if (url.protocol === 'file:') {
      return 'file://';
    }

    if (!url.host) {
      return null;
    }

    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

function getNotebookDraftStorageKey(sourceUrl: string): string | null {
  const scopeKey = createNotebookDraftScopeKey(sourceUrl);
  return scopeKey ? `${NOTEBOOK_DRAFT_STORAGE_KEY_PREFIX}${scopeKey}` : null;
}

function getSessionStorage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function createNotebookDraftSessionPersistence(
  sourceUrl: string,
): NotebookDraftSessionPersistence {
  const storageKey = getNotebookDraftStorageKey(sourceUrl);

  return {
    read() {
      if (!storageKey) {
        return null;
      }

      try {
        const value = getSessionStorage()?.getItem(storageKey);
        return value && value.length > 0
          ? normalizeNotebookDraftSessionValue(value)
          : null;
      } catch {
        return null;
      }
    },

    write(snapshot: NotebookDraftSessionSnapshot) {
      if (!storageKey) {
        return;
      }

      try {
        const storage = getSessionStorage();
        if (!storage) {
          return;
        }

        if (snapshot.draft.length > 0) {
          storage.setItem(storageKey, JSON.stringify({
            version: NOTEBOOK_DRAFT_SESSION_VERSION,
            draft: snapshot.draft,
            editorStateJson: snapshot.editorStateJson,
            nextChipIndex: normalizeNextNotebookChipIndex(snapshot.nextChipIndex),
          } satisfies PersistedNotebookDraftSessionPayload));
          return;
        }

        storage.removeItem(storageKey);
      } catch {
        // Some pages/origins can deny sessionStorage access. Draft persistence is
        // best-effort so the editor remains usable without storage access.
      }
    },
  };
}

// Extracts the chip set from a restored serialized Lexical state so the store
// can hydrate activeChipTargets before (or without) a Lexical editor mount —
// the mount-time reconciliation is tagged history-merge and never re-exports.
export function collectNotebookChipTargetsFromSerializedEditorState(
  editorStateJson: string | null,
): ExportedChipTarget[] {
  if (!editorStateJson) {
    return [];
  }

  const parsedState = parseJsonRecord(editorStateJson);
  if (!parsedState || !isRecord(parsedState.root)) {
    return [];
  }

  const chips: ExportedChipTarget[] = [];
  collectSerializedNodeChipTargets(parsedState.root, chips, new Set<string>());
  return chips;
}

function collectSerializedNodeChipTargets(
  value: unknown,
  chips: ExportedChipTarget[],
  seenChipIds: Set<string>,
): void {
  if (!isRecord(value)) {
    return;
  }

  if (
    value.type === SERIALIZED_CHIP_NODE_TYPE
    && typeof value.chipId === 'string'
    && !seenChipIds.has(value.chipId)
    && getValidSerializedChipIndex(value) !== null
  ) {
    chips.push({
      chipId: value.chipId,
      target: value.target as EditorTarget,
      nodeId: (value.nodeId ?? null) as string | null,
    });
    seenChipIds.add(value.chipId);
  }

  if (Array.isArray(value.children)) {
    for (const child of value.children) {
      collectSerializedNodeChipTargets(child, chips, seenChipIds);
    }
  }
}

function normalizeNotebookDraftSessionValue(value: string): NotebookDraftSessionSnapshot | null {
  const parsedValue = parseJsonRecord(value);

  if (!isPersistedNotebookDraftSessionPayloadRecord(parsedValue)) {
    return null;
  }

  const editorState = normalizeNotebookEditorStateJson(parsedValue.editorStateJson);
  if (editorState.editorStateJson === null) {
    // Only drafts with a valid serialized Lexical state are restored; a draft
    // whose chip state failed validation would otherwise resurrect as raw text.
    return null;
  }

  const minimumNextChipIndex = editorState.maxChipIndex + 1;

  return {
    draft: parsedValue.draft,
    editorStateJson: editorState.editorStateJson,
    nextChipIndex: Math.max(
      normalizeNextNotebookChipIndex(parsedValue.nextChipIndex),
      minimumNextChipIndex,
    ),
  };
}

function isPersistedNotebookDraftSessionPayloadRecord(
  value: Record<string, unknown> | null,
): value is PersistedNotebookDraftSessionPayload {
  return Boolean(
    value
    && value.version === NOTEBOOK_DRAFT_SESSION_VERSION
    && typeof value.draft === 'string',
  );
}

function normalizeNotebookEditorStateJson(value: unknown): {
  editorStateJson: string | null;
  maxChipIndex: number;
} {
  if (typeof value !== 'string' || value.length === 0) {
    return {
      editorStateJson: null,
      maxChipIndex: 0,
    };
  }

  const parsedState = parseJsonRecord(value);
  if (!parsedState) {
    return {
      editorStateJson: null,
      maxChipIndex: 0,
    };
  }

  const maxChipIndex = getValidSerializedEditorStateMaxChipIndex(parsedState);
  if (maxChipIndex === null) {
    return {
      editorStateJson: null,
      maxChipIndex: 0,
    };
  }

  return {
    editorStateJson: value,
    maxChipIndex,
  };
}

function getValidSerializedEditorStateMaxChipIndex(value: Record<string, unknown>): number | null {
  if (
    !isRecord(value.root)
    || value.root.type !== 'root'
    || !Array.isArray(value.root.children)
  ) {
    return null;
  }

  return getValidSerializedNodeMaxChipIndex(value.root);
}

function getValidSerializedNodeMaxChipIndex(value: unknown): number | null {
  if (!isRecord(value) || typeof value.type !== 'string') {
    return null;
  }

  const ownChipIndex = value.type === SERIALIZED_CHIP_NODE_TYPE
    ? getValidSerializedChipIndex(value)
    : 0;

  if (ownChipIndex === null) {
    return null;
  }

  if (!('children' in value)) {
    return ownChipIndex;
  }

  if (!Array.isArray(value.children)) {
    return null;
  }

  let maxChipIndex = ownChipIndex;
  for (const child of value.children) {
    const childMaxChipIndex = getValidSerializedNodeMaxChipIndex(child);
    if (childMaxChipIndex === null) {
      return null;
    }

    maxChipIndex = Math.max(maxChipIndex, childMaxChipIndex);
  }

  return maxChipIndex;
}

function getValidSerializedChipIndex(value: Record<string, unknown>): number | null {
  if (!isNotebookChipId(value.chipId)) {
    return null;
  }

  if (!isEditorTarget(value.target)) {
    return null;
  }

  if (value.nodeId !== null && typeof value.nodeId !== 'string') {
    return null;
  }

  return getNotebookChipIndex(value.chipId);
}

function isEditorTarget(value: unknown): boolean {
  if (!isRecord(value) || typeof value.kind !== 'string') {
    return false;
  }

  if (value.kind === 'ai-id') {
    return typeof value.aiId === 'string'
      && typeof value.instanceIndex === 'number'
      && Number.isSafeInteger(value.instanceIndex)
      && value.instanceIndex >= 0;
  }

  if (value.kind !== 'fallback') {
    return false;
  }

  return typeof value.nodeId === 'string'
    && typeof value.tagName === 'string'
    && typeof value.label === 'string'
    && typeof value.selector === 'string'
    && isFallbackSelectorKind(value.selectorKind)
    && typeof value.path === 'string'
    && isOptionalString(value.fullPath)
    && isOptionalString(value.textPreview)
    && isOptionalString(value.nearbyText)
    && isStringArray(value.classTokens)
    && isOptionalString(value.accessibility);
}

function isFallbackSelectorKind(value: unknown): value is FallbackSelectorKind {
  return typeof value === 'string'
    && FALLBACK_SELECTOR_KINDS.has(value as FallbackSelectorKind);
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}

function isStringArray(value: unknown): boolean {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function parseJsonRecord(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
