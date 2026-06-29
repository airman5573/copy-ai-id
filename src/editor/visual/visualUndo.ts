import {
  EDITOR_MESSAGE_TYPES,
  type BridgeToEditorMessage,
  type EditorTargetReference,
  type EditorToBridgeMessage,
  type RequestVisualDragMoveMessage,
  type UpdateVisualAttributeMessage,
  type UpdateVisualFormValueMessage,
  type UpdateVisualRichTextMessage,
  type UpdateVisualStyleMessage,
  type UpdateVisualTextMessage,
  type VisualDropPosition,
  type VisualStructureMutationSnapshot,
} from '../../shared/editor-messages';
import type {
  VisualAttributeEditPayload,
  VisualEditRecord,
  VisualFormValueEditPayload,
  VisualRichTextEditPayload,
  VisualStructureEditPayload,
  VisualStyleEditPayload,
  VisualTextEditPayload,
} from '../../shared/visual-edits';
import { useVisualEditStore } from '../stores/useVisualEditStore';

type VisualMutationResultMessage = Extract<BridgeToEditorMessage, {
  applied: boolean;
  mutationId: number;
}>;

interface PendingVisualUndoMutation {
  mutationId: number;
  recordId: string;
}

const pendingVisualUndoMutations = new Map<number, PendingVisualUndoMutation>();
const pendingVisualUndoRecordIds = new Set<string>();

let nextVisualUndoMutationId = -1;

export function undoLastVisualEdit(
  post: (message: EditorToBridgeMessage) => void,
): boolean {
  const records = useVisualEditStore.getState().records;

  for (let index = records.length - 1; index >= 0; index -= 1) {
    const record = records[index];
    if (record.status === 'pending' || pendingVisualUndoRecordIds.has(record.id)) {
      return false;
    }

    if (record.status !== 'applied') {
      continue;
    }

    const mutationId = getNextVisualUndoMutationId();
    const message = createVisualUndoMessage(record, mutationId);
    if (!message) {
      continue;
    }

    pendingVisualUndoMutations.set(mutationId, {
      mutationId,
      recordId: record.id,
    });
    pendingVisualUndoRecordIds.add(record.id);
    post(message);
    return true;
  }

  return false;
}

export function isVisualUndoMutationResult(mutationId: number): boolean {
  return pendingVisualUndoMutations.has(mutationId);
}

export function handleVisualUndoMutationResult(message: VisualMutationResultMessage): boolean {
  const pending = pendingVisualUndoMutations.get(message.mutationId);
  if (!pending) {
    return false;
  }

  pendingVisualUndoMutations.delete(message.mutationId);
  pendingVisualUndoRecordIds.delete(pending.recordId);

  if (message.applied && !message.error) {
    useVisualEditStore.getState().updateRecordStatus(pending.recordId, 'reverted');
  }

  return true;
}

function getNextVisualUndoMutationId(): number {
  const mutationId = nextVisualUndoMutationId;
  nextVisualUndoMutationId -= 1;
  return mutationId;
}

function createVisualUndoMessage(
  record: VisualEditRecord,
  mutationId: number,
): EditorToBridgeMessage | null {
  const reference = referenceForRecord(record);

  switch (record.kind) {
    case 'style':
      return createStyleUndoMessage(record as VisualEditRecord<'style'>, mutationId, reference);
    case 'text':
      return createTextUndoMessage(record as VisualEditRecord<'text'>, mutationId, reference);
    case 'rich-text':
      return createRichTextUndoMessage(record as VisualEditRecord<'rich-text'>, mutationId, reference);
    case 'attribute':
      return createAttributeUndoMessage(record as VisualEditRecord<'attribute'>, mutationId, reference);
    case 'form-value':
      return createFormValueUndoMessage(record as VisualEditRecord<'form-value'>, mutationId, reference);
    case 'structure':
      return createStructureUndoMessage(record as VisualEditRecord<'structure'>, mutationId, reference);
    default:
      return null;
  }
}

function createStyleUndoMessage(
  record: VisualEditRecord<'style'>,
  mutationId: number,
  reference: EditorTargetReference,
): UpdateVisualStyleMessage | null {
  const payload = record.payload as VisualStyleEditPayload;
  const declarations = payload.declarations.map((declaration) => ({
    property: declaration.property,
    value: declaration.source === 'inline' ? declaration.before ?? '' : '',
    priority: declaration.priority ?? '',
    previousValue: declaration.after,
  }));

  if (declarations.length === 0) {
    return null;
  }

  return {
    type: EDITOR_MESSAGE_TYPES.updateVisualStyle,
    mutationId,
    target: reference.target,
    nodeId: reference.nodeId,
    breakpointId: record.breakpointId,
    declarations,
  };
}

function createTextUndoMessage(
  record: VisualEditRecord<'text'>,
  mutationId: number,
  reference: EditorTargetReference,
): UpdateVisualTextMessage {
  const payload = record.payload as VisualTextEditPayload;

  return {
    type: EDITOR_MESSAGE_TYPES.updateVisualText,
    mutationId,
    target: reference.target,
    nodeId: reference.nodeId,
    breakpointId: record.breakpointId,
    text: {
      value: payload.text.before,
      previousValue: payload.text.after,
    },
  };
}

function createRichTextUndoMessage(
  record: VisualEditRecord<'rich-text'>,
  mutationId: number,
  reference: EditorTargetReference,
): UpdateVisualRichTextMessage {
  const payload = record.payload as VisualRichTextEditPayload;

  return {
    type: EDITOR_MESSAGE_TYPES.updateVisualRichText,
    mutationId,
    target: reference.target,
    nodeId: reference.nodeId,
    breakpointId: record.breakpointId,
    richText: {
      html: payload.richText.beforeHtml,
      previousHtml: payload.richText.afterHtml,
    },
  };
}

function createAttributeUndoMessage(
  record: VisualEditRecord<'attribute'>,
  mutationId: number,
  reference: EditorTargetReference,
): UpdateVisualAttributeMessage | null {
  const payload = record.payload as VisualAttributeEditPayload;
  const attribute = payload.attributes[0];
  if (!attribute) {
    return null;
  }

  return {
    type: EDITOR_MESSAGE_TYPES.updateVisualAttribute,
    mutationId,
    target: reference.target,
    nodeId: reference.nodeId,
    breakpointId: record.breakpointId,
    attribute: {
      name: attribute.name,
      value: attribute.before,
      previousValue: attribute.after,
    },
  };
}

function createFormValueUndoMessage(
  record: VisualEditRecord<'form-value'>,
  mutationId: number,
  reference: EditorTargetReference,
): UpdateVisualFormValueMessage {
  const payload = record.payload as VisualFormValueEditPayload;

  return {
    type: EDITOR_MESSAGE_TYPES.updateVisualFormValue,
    mutationId,
    target: reference.target,
    nodeId: reference.nodeId,
    breakpointId: record.breakpointId,
    formValue: {
      ...payload.formValue.before,
      previousValue: payload.formValue.after,
    },
  };
}

function createStructureUndoMessage(
  record: VisualEditRecord<'structure'>,
  mutationId: number,
  reference: EditorTargetReference,
): EditorToBridgeMessage | null {
  const payload = record.payload as VisualStructureEditPayload;
  const structure = payload.structure;

  switch (structure.operation) {
    case 'delete': {
      const before = structure.before ?? record.before.structure.structure;
      if (!before) {
        return null;
      }

      return {
        type: EDITOR_MESSAGE_TYPES.restoreVisualElement,
        mutationId,
        target: reference.target,
        nodeId: reference.nodeId,
        breakpointId: record.breakpointId,
        structure: before,
      };
    }
    case 'duplicate': {
      const duplicatedTarget = structure.duplicatedTarget;
      if (!duplicatedTarget) {
        return null;
      }

      return {
        type: EDITOR_MESSAGE_TYPES.deleteVisualElement,
        mutationId,
        target: duplicatedTarget.target,
        nodeId: duplicatedTarget.nodeId ?? null,
        breakpointId: record.breakpointId,
      };
    }
    case 'move-up':
    case 'move-down':
    case 'drag-move': {
      const before = structure.before ?? record.before.structure.structure;
      if (!before) {
        return null;
      }

      return createMoveBackToStructureMessage(record, mutationId, reference, before);
    }
    case 'restore':
      return {
        type: EDITOR_MESSAGE_TYPES.deleteVisualElement,
        mutationId,
        target: reference.target,
        nodeId: reference.nodeId,
        breakpointId: record.breakpointId,
      };
    default:
      return null;
  }
}

function createMoveBackToStructureMessage(
  record: VisualEditRecord<'structure'>,
  mutationId: number,
  reference: EditorTargetReference,
  before: VisualStructureMutationSnapshot,
): RequestVisualDragMoveMessage | null {
  const drop = createOriginalPositionDrop(before);
  if (!drop) {
    return null;
  }

  return {
    type: EDITOR_MESSAGE_TYPES.requestVisualDragMove,
    mutationId,
    target: reference.target,
    nodeId: reference.nodeId,
    breakpointId: record.breakpointId,
    dropNodeId: drop.dropNodeId,
    position: drop.position,
  };
}

function createOriginalPositionDrop(
  before: VisualStructureMutationSnapshot,
): { dropNodeId: string; position: VisualDropPosition } | null {
  if (before.previousSiblingNodeId) {
    return {
      dropNodeId: before.previousSiblingNodeId,
      position: 'after',
    };
  }

  if (before.nextSiblingNodeId) {
    return {
      dropNodeId: before.nextSiblingNodeId,
      position: 'before',
    };
  }

  if (before.parentNodeId) {
    return {
      dropNodeId: before.parentNodeId,
      position: before.childElementIndex === 0 ? 'inside-start' : 'inside-end',
    };
  }

  return null;
}

function referenceForRecord(record: VisualEditRecord): EditorTargetReference {
  return {
    target: record.target.target,
    nodeId: record.target.nodeId ?? record.target.fallback?.nodeId ?? null,
  };
}
