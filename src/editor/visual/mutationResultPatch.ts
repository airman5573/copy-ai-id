import type { VisualEditRecord } from '../../shared/visual-edits';
import { createVisualEditTargetDescriptor } from '../../shared/visual-targets';
import { useVisualEditStore } from '../stores/useVisualEditStore';
import type { VisualMutationResultMessage } from '../stores/useVisualSelectionStore';

export function createVisualEditRecordPatchForMutationResult(
  message: VisualMutationResultMessage,
): Partial<VisualEditRecord> | undefined {
  if (message.kind !== 'structure' || !message.structure) {
    return undefined;
  }

  if (
    message.operation !== 'delete'
    && message.operation !== 'restore'
    && message.operation !== 'duplicate'
    && message.operation !== 'move-up'
    && message.operation !== 'move-down'
    && message.operation !== 'drag-move'
  ) {
    return undefined;
  }

  const visualEditState = useVisualEditStore.getState();
  const pending = visualEditState.pendingMutations[message.mutationId];
  const record = pending
    ? visualEditState.records.find((candidate) => candidate.id === pending.recordId)
    : null;

  if (!record || record.kind !== 'structure' || record.payload.kind !== 'structure') {
    return undefined;
  }

  const structureRecord = record as VisualEditRecord<'structure'>;
  const currentStructure = structureRecord.payload.structure;
  const before = structureBeforeForMutationResult(message, structureRecord);
  const after = structureAfterForMutationResult(message);
  const duplicatedTarget = message.operation === 'duplicate' && message.duplicateTarget
    ? createVisualEditTargetDescriptor(message.duplicateTarget, { nodeId: message.duplicateNodeId ?? null })
    : currentStructure.duplicatedTarget;
  const dropTarget = message.operation === 'drag-move' && message.dropTarget
    ? createVisualEditTargetDescriptor(message.dropTarget, { nodeId: message.dropNodeId ?? null })
    : currentStructure.dropTarget;

  return {
    payload: {
      kind: 'structure',
      structure: {
        ...currentStructure,
        operation: message.operation,
        before,
        after,
        movedDirection: message.operation === 'move-up'
          ? 'up'
          : message.operation === 'move-down'
            ? 'down'
            : currentStructure.movedDirection,
        dropPosition: message.operation === 'drag-move'
          ? message.position ?? currentStructure.dropPosition
          : currentStructure.dropPosition,
        dropTarget,
        duplicatedTarget,
      },
    },
    before: {
      kind: 'structure',
      structure: { structure: before },
    },
    after: {
      kind: 'structure',
      structure: { structure: after },
    },
  } as Partial<VisualEditRecord>;
}

function structureBeforeForMutationResult(
  message: VisualMutationResultMessage,
  record: VisualEditRecord<'structure'>,
) {
  if (
    message.kind === 'structure'
    && (
      message.operation === 'delete'
      || message.operation === 'duplicate'
      || message.operation === 'move-up'
      || message.operation === 'move-down'
      || message.operation === 'drag-move'
    )
  ) {
    return message.structure ?? null;
  }

  return record.payload.structure.before ?? record.before.structure.structure ?? null;
}

function structureAfterForMutationResult(
  message: VisualMutationResultMessage,
) {
  if (message.kind !== 'structure') {
    return null;
  }

  switch (message.operation) {
    case 'delete':
      return null;
    case 'restore':
      return message.structure ?? null;
    case 'duplicate':
    case 'move-up':
    case 'move-down':
    case 'drag-move':
      return message.afterStructure ?? null;
    default:
      return null;
  }
}
