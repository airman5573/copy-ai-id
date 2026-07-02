import { create } from 'zustand';

import type {
  VisualMutationError,
  VisualMutationKind,
} from '../../shared/domain/visual';
import {
  VISUAL_EDITS_EXPORT_VERSION,
  type VisualEditId,
  type VisualEditJsonDiff,
  type VisualEditRecord,
  type VisualEditStatus,
  type VisualEditWarning,
  type VisualEditsExportDocument,
} from '../../shared/visual-edits';

const MAX_VISUAL_EDIT_HISTORY_DEPTH = 50;
const PREVIEW_ONLY_WARNING: VisualEditWarning = {
  code: 'preview-only',
  message: 'This edit was applied only to the preview DOM and should be recreated in source code by the receiving AI/developer.',
};

export type VisualEditRecordInput = Omit<VisualEditRecord, 'id' | 'order' | 'timestamp' | 'status' | 'jsonDiff'>
  & Partial<Pick<VisualEditRecord, 'id' | 'order' | 'timestamp' | 'status' | 'jsonDiff'>>;

export interface VisualEditPendingMutation {
  mutationId: number;
  recordId: VisualEditId;
  kind: VisualMutationKind;
  startedAt: string;
  summary: string;
}

export interface VisualEditErrorEntry {
  id: string;
  recordId: VisualEditId | null;
  mutationId: number | null;
  error: VisualMutationError;
  occurredAt: string;
}

export interface VisualEditStateSnapshot {
  records: VisualEditRecord[];
  pendingMutations: Record<number, VisualEditPendingMutation>;
  errorMessages: VisualEditErrorEntry[];
  undoStack: VisualEditRecord[][];
  redoStack: VisualEditRecord[][];
  nextOrder: number;
  lastUpdatedAt: string | null;
}

export interface VisualEditStore extends VisualEditStateSnapshot {
  addRecord(input: VisualEditRecordInput, options?: { mutationId?: number }): VisualEditRecord;
  upsertRecord(record: VisualEditRecord, options?: { mutationId?: number }): void;
  markMutationPending(mutationId: number, recordId: VisualEditId): void;
  markMutationApplied(mutationId: number, patch?: Partial<VisualEditRecord>): void;
  markMutationFailed(mutationId: number, error: VisualMutationError): void;
  updateRecordStatus(recordId: VisualEditId, status: VisualEditStatus, error?: VisualMutationError): void;
  removeRecord(recordId: VisualEditId): void;
  undoVisualEditRecordState(): void;
  redoVisualEditRecordState(): void;
  clearVisualEdits(): void;
  resetVisualEditStore(): void;
  hasVisualEdits(): boolean;
  getExportableRecords(): VisualEditRecord[];
  getExportDocument(): VisualEditsExportDocument;
}

export interface VisualEditRuntimeStatusSummary {
  totalCount: number;
  exportableCount: number;
  pendingCount: number;
  failedCount: number;
  latestErrorCode: VisualMutationError['code'] | null;
  hasHiddenPromptText: boolean;
  hasPending: boolean;
  hasErrors: boolean;
}

const initialVisualEditState: VisualEditStateSnapshot = {
  records: [],
  pendingMutations: {},
  errorMessages: [],
  undoStack: [],
  redoStack: [],
  nextOrder: 1,
  lastUpdatedAt: null,
};

export const useVisualEditStore = create<VisualEditStore>((set, get) => ({
  ...initialVisualEditState,
  addRecord: (input, options = {}) => {
    const record = createVisualEditRecord(input, get());

    set((state) => ({
      records: [...state.records, record],
      pendingMutations: options.mutationId !== undefined
        ? {
          ...state.pendingMutations,
          [options.mutationId]: createPendingMutation(options.mutationId, record),
        }
        : state.pendingMutations,
      undoStack: pushHistorySnapshot(state.undoStack, state.records),
      redoStack: [],
      nextOrder: Math.max(state.nextOrder, record.order + 1),
      lastUpdatedAt: new Date().toISOString(),
    }));

    return record;
  },
  upsertRecord: (record, options = {}) => set((state) => {
    const normalizedRecord = normalizeVisualEditRecord(record);
    const existingIndex = state.records.findIndex((candidate) => candidate.id === normalizedRecord.id);
    const records = existingIndex >= 0
      ? state.records.map((candidate, index) => (index === existingIndex ? normalizedRecord : candidate))
      : [...state.records, normalizedRecord];

    return {
      records,
      pendingMutations: options.mutationId !== undefined
        ? {
          ...state.pendingMutations,
          [options.mutationId]: createPendingMutation(options.mutationId, normalizedRecord),
        }
        : state.pendingMutations,
      undoStack: pushHistorySnapshot(state.undoStack, state.records),
      redoStack: [],
      nextOrder: Math.max(state.nextOrder, normalizedRecord.order + 1),
      lastUpdatedAt: new Date().toISOString(),
    };
  }),
  markMutationPending: (mutationId, recordId) => set((state) => {
    const record = state.records.find((candidate) => candidate.id === recordId);
    if (!record) {
      return state;
    }

    return {
      pendingMutations: {
        ...state.pendingMutations,
        [mutationId]: createPendingMutation(mutationId, record),
      },
      records: state.records.map((candidate) => (
        candidate.id === recordId ? updateRecordStatus(candidate, 'pending') : candidate
      )),
      lastUpdatedAt: new Date().toISOString(),
    };
  }),
  markMutationApplied: (mutationId, patch = {}) => set((state) => {
    const pending = state.pendingMutations[mutationId];
    if (!pending) {
      return state;
    }

    const { [mutationId]: _removed, ...pendingMutations } = state.pendingMutations;
    const records = state.records.map((record) => {
      if (record.id !== pending.recordId) {
        return record;
      }

      return normalizeVisualEditRecord({
        ...record,
        ...patch,
        status: 'applied',
        error: undefined,
      });
    });

    return {
      records,
      pendingMutations,
      lastUpdatedAt: new Date().toISOString(),
    };
  }),
  markMutationFailed: (mutationId, error) => set((state) => {
    const pending = state.pendingMutations[mutationId];
    const { [mutationId]: _removed, ...pendingMutations } = state.pendingMutations;
    const now = new Date().toISOString();
    const recordId = pending?.recordId ?? null;

    return {
      records: recordId
        ? state.records.map((record) => (
          record.id === recordId ? updateRecordStatus(record, 'failed', error) : record
        ))
        : state.records,
      pendingMutations,
      errorMessages: [
        ...state.errorMessages,
        createErrorEntry(error, recordId, mutationId, now),
      ],
      lastUpdatedAt: now,
    };
  }),
  updateRecordStatus: (recordId, status, error = undefined) => set((state) => ({
    records: state.records.map((record) => (
      record.id === recordId ? updateRecordStatus(record, status, error) : record
    )),
    undoStack: pushHistorySnapshot(state.undoStack, state.records),
    redoStack: [],
    lastUpdatedAt: new Date().toISOString(),
  })),
  removeRecord: (recordId) => set((state) => ({
    records: state.records.filter((record) => record.id !== recordId),
    pendingMutations: Object.fromEntries(
      Object.entries(state.pendingMutations)
        .filter(([, pending]) => pending.recordId !== recordId),
    ) as Record<number, VisualEditPendingMutation>,
    undoStack: pushHistorySnapshot(state.undoStack, state.records),
    redoStack: [],
    lastUpdatedAt: new Date().toISOString(),
  })),
  undoVisualEditRecordState: () => set((state) => {
    const previousRecords = state.undoStack[state.undoStack.length - 1];
    if (!previousRecords) {
      return state;
    }

    return {
      records: previousRecords,
      undoStack: state.undoStack.slice(0, -1),
      redoStack: pushHistorySnapshot(state.redoStack, state.records),
      lastUpdatedAt: new Date().toISOString(),
    };
  }),
  redoVisualEditRecordState: () => set((state) => {
    const nextRecords = state.redoStack[state.redoStack.length - 1];
    if (!nextRecords) {
      return state;
    }

    return {
      records: nextRecords,
      undoStack: pushHistorySnapshot(state.undoStack, state.records),
      redoStack: state.redoStack.slice(0, -1),
      lastUpdatedAt: new Date().toISOString(),
    };
  }),
  clearVisualEdits: () => set({
    records: [],
    pendingMutations: {},
    errorMessages: [],
    undoStack: [],
    redoStack: [],
    nextOrder: 1,
    lastUpdatedAt: new Date().toISOString(),
  }),
  resetVisualEditStore: () => set({ ...initialVisualEditState }),
  hasVisualEdits: () => selectHasVisualEdits(get()),
  getExportableRecords: () => selectExportableVisualEditRecords(get()),
  getExportDocument: () => createVisualEditsExportDocument(selectExportableVisualEditRecords(get())),
}));

export function selectHasVisualEdits(state: Pick<VisualEditStateSnapshot, 'records'>): boolean {
  return selectExportableVisualEditRecords(state).length > 0;
}

export function selectExportableVisualEditRecords(
  state: Pick<VisualEditStateSnapshot, 'records'>,
): VisualEditRecord[] {
  return state.records.filter((record) => record.status !== 'failed' && record.status !== 'reverted');
}

export function selectVisualEditRuntimeStatus(
  state: Pick<VisualEditStateSnapshot, 'records' | 'pendingMutations' | 'errorMessages'>,
): VisualEditRuntimeStatusSummary {
  const latestError = state.errorMessages[state.errorMessages.length - 1] ?? null;
  const exportableCount = selectExportableVisualEditRecords(state).length;
  const pendingCount = Object.keys(state.pendingMutations).length;
  const failedCount = state.errorMessages.length;

  return {
    totalCount: state.records.length,
    exportableCount,
    pendingCount,
    failedCount,
    latestErrorCode: latestError?.error.code ?? null,
    hasHiddenPromptText: exportableCount > 0,
    hasPending: pendingCount > 0,
    hasErrors: failedCount > 0,
  };
}

export function createVisualEditsExportDocument(records: VisualEditRecord[]): VisualEditsExportDocument {
  return {
    version: VISUAL_EDITS_EXPORT_VERSION,
    generatedAt: new Date().toISOString(),
    edits: records.map((record) => record.jsonDiff),
  };
}

function createVisualEditRecord(input: VisualEditRecordInput, state: VisualEditStateSnapshot): VisualEditRecord {
  const order = input.order ?? state.nextOrder;
  const id = input.id ?? formatVisualEditRecordId(order);
  const timestamp = input.timestamp ?? new Date().toISOString();

  return normalizeVisualEditRecord({
    ...input,
    id,
    order,
    timestamp,
    status: input.status ?? 'pending',
  } as VisualEditRecord);
}

function normalizeVisualEditRecord(record: VisualEditRecord): VisualEditRecord {
  const warnings = ensurePreviewOnlyWarning(record.warnings);
  const jsonDiff = record.jsonDiff ?? createJsonDiff({ ...record, warnings });

  return {
    ...record,
    warnings,
    jsonDiff: {
      ...jsonDiff,
      version: VISUAL_EDITS_EXPORT_VERSION,
      id: record.id,
      order: record.order,
      timestamp: record.timestamp,
      kind: record.kind,
      source: record.source,
      target: record.target,
      snapshot: record.targetSnapshot,
      control: record.control,
      breakpointId: record.breakpointId,
      payload: record.payload as VisualEditJsonDiff['payload'],
      before: record.before as VisualEditJsonDiff['before'],
      after: record.after as VisualEditJsonDiff['after'],
      summary: record.humanSummary,
      warnings,
    } as VisualEditJsonDiff,
  };
}

function createJsonDiff(record: VisualEditRecord): VisualEditJsonDiff {
  return {
    version: VISUAL_EDITS_EXPORT_VERSION,
    id: record.id,
    order: record.order,
    timestamp: record.timestamp,
    kind: record.kind,
    source: record.source,
    target: record.target,
    snapshot: record.targetSnapshot,
    control: record.control,
    breakpointId: record.breakpointId,
    payload: record.payload as VisualEditJsonDiff['payload'],
    before: record.before as VisualEditJsonDiff['before'],
    after: record.after as VisualEditJsonDiff['after'],
    summary: record.humanSummary,
    warnings: ensurePreviewOnlyWarning(record.warnings),
  } as VisualEditJsonDiff;
}

function updateRecordStatus(
  record: VisualEditRecord,
  status: VisualEditStatus,
  error?: VisualMutationError,
): VisualEditRecord {
  return normalizeVisualEditRecord({
    ...record,
    status,
    error,
  });
}

function createPendingMutation(mutationId: number, record: VisualEditRecord): VisualEditPendingMutation {
  return {
    mutationId,
    recordId: record.id,
    kind: record.kind,
    startedAt: new Date().toISOString(),
    summary: record.humanSummary,
  };
}

function createErrorEntry(
  error: VisualMutationError,
  recordId: VisualEditId | null,
  mutationId: number | null,
  occurredAt: string,
): VisualEditErrorEntry {
  return {
    id: `visual-edit-error-${occurredAt}-${mutationId ?? recordId ?? 'unknown'}`,
    recordId,
    mutationId,
    error,
    occurredAt,
  };
}

function ensurePreviewOnlyWarning(warnings: readonly VisualEditWarning[] | null | undefined): VisualEditWarning[] {
  const existingWarnings = warnings ? Array.from(warnings) : [];
  if (existingWarnings.some((warning) => warning.code === PREVIEW_ONLY_WARNING.code)) {
    return existingWarnings;
  }

  return [...existingWarnings, PREVIEW_ONLY_WARNING];
}

function pushHistorySnapshot(history: VisualEditRecord[][], records: VisualEditRecord[]): VisualEditRecord[][] {
  return [...history, records].slice(-MAX_VISUAL_EDIT_HISTORY_DEPTH);
}

function formatVisualEditRecordId(order: number): VisualEditId {
  return `visual-edit-${order}`;
}
