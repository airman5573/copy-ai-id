import type { EditorTarget } from '../../shared/domain/targets';
import type {
  VisualDropPosition,
  VisualStructureMutationSnapshot,
  VisualStructureOperation,
} from '../../shared/domain/visual';
import {
  EDITOR_MESSAGE_TYPES,
  type DeleteVisualElementMessage,
  type DuplicateVisualElementMessage,
  type MoveVisualElementMessage,
  type RequestVisualDragMoveMessage,
  type RestoreVisualElementMessage,
  type VisualDragMoveCompletedMessage,
  type VisualElementDeletedMessage,
  type VisualElementDuplicatedMessage,
  type VisualElementMovedMessage,
  type VisualElementRestoredMessage,
  type VisualMutationRequestBase,
} from '../../shared/protocol/editor-bridge-messages';
import {
  createVisualMutationResultBase,
  type VisualMutationResultMessage,
} from './visual-mutation-results';
import type { VisualTargetResolveSuccess } from './visual-target-resolver';

// Assembles the typed structure-mutation result messages. The DOM
// operation handlers live in visual-structure.ts.
export interface StructureMutationSuccess {
  resolved: VisualTargetResolveSuccess;
  structure: VisualStructureMutationSnapshot;
  afterStructure?: VisualStructureMutationSnapshot;
  duplicateTarget?: EditorTarget;
  duplicateNodeId?: string | null;
  dropTarget?: EditorTarget;
  dropNodeId?: string | null;
  position?: VisualDropPosition;
}

export function createStructureResult(
  request: DuplicateVisualElementMessage | MoveVisualElementMessage | DeleteVisualElementMessage | RestoreVisualElementMessage | RequestVisualDragMoveMessage,
  success: StructureMutationSuccess,
): VisualMutationResultMessage {
  const base = createVisualMutationResultBase({
    request,
    resolved: success.resolved,
    applied: true,
  });
  const result = structureResultForOperation(
    request,
    base,
    operationForRequest(request),
    success.structure,
    success.afterStructure,
  );

  switch (result.type) {
    case EDITOR_MESSAGE_TYPES.visualElementDuplicated:
      return {
        ...result,
        duplicateTarget: success.duplicateTarget,
        duplicateNodeId: success.duplicateNodeId,
      };
    case EDITOR_MESSAGE_TYPES.visualDragMoveCompleted:
      return {
        ...result,
        dropTarget: success.dropTarget,
        dropNodeId: success.dropNodeId,
        position: success.position,
      };
    default:
      return result;
  }
}

export function structureResultForOperation(
  request: VisualMutationRequestBase,
  base: ReturnType<typeof createVisualMutationResultBase>,
  operation: VisualStructureOperation,
  structure: VisualStructureMutationSnapshot | undefined,
  afterStructure: VisualStructureMutationSnapshot | undefined,
): VisualMutationResultMessage {
  switch (operation) {
    case 'duplicate':
      return {
        ...base,
        type: EDITOR_MESSAGE_TYPES.visualElementDuplicated,
        kind: 'structure',
        operation,
        structure,
        afterStructure,
      } satisfies VisualElementDuplicatedMessage;
    case 'move-up':
    case 'move-down':
      return {
        ...base,
        type: EDITOR_MESSAGE_TYPES.visualElementMoved,
        kind: 'structure',
        operation,
        structure,
        afterStructure,
      } satisfies VisualElementMovedMessage;
    case 'delete':
      return {
        ...base,
        type: EDITOR_MESSAGE_TYPES.visualElementDeleted,
        kind: 'structure',
        operation,
        structure,
      } satisfies VisualElementDeletedMessage;
    case 'restore':
      return {
        ...base,
        type: EDITOR_MESSAGE_TYPES.visualElementRestored,
        kind: 'structure',
        operation,
        structure,
      } satisfies VisualElementRestoredMessage;
    case 'drag-move':
      return {
        ...base,
        type: EDITOR_MESSAGE_TYPES.visualDragMoveCompleted,
        kind: 'structure',
        operation,
        structure,
        afterStructure,
      } satisfies VisualDragMoveCompletedMessage;
    default:
      return exhaustiveStructureOperation(operation);
  }
}

export function operationForRequest(
  request: DuplicateVisualElementMessage | MoveVisualElementMessage | DeleteVisualElementMessage | RestoreVisualElementMessage | RequestVisualDragMoveMessage,
): VisualStructureOperation {
  switch (request.type) {
    case EDITOR_MESSAGE_TYPES.duplicateVisualElement:
      return 'duplicate';
    case EDITOR_MESSAGE_TYPES.moveVisualElement:
      return request.direction === 'up' ? 'move-up' : 'move-down';
    case EDITOR_MESSAGE_TYPES.deleteVisualElement:
      return 'delete';
    case EDITOR_MESSAGE_TYPES.restoreVisualElement:
      return 'restore';
    case EDITOR_MESSAGE_TYPES.requestVisualDragMove:
      return 'drag-move';
    default:
      return exhaustiveRequest(request);
  }
}

function exhaustiveStructureOperation(operation: never): never {
  throw new Error(`Unsupported visual structure operation: ${operation}`);
}

function exhaustiveRequest(request: never): never {
  throw new Error(`Unsupported visual structure request: ${JSON.stringify(request)}`);
}
