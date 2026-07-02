import { DATA_AI_ID_ATTRIBUTE, isExtensionOwnedElement } from '../../shared/config';
import {
  EDITOR_MESSAGE_TYPES,
  type BridgeViewportPoint,
  type ClearVisualDragMovePreviewMessage,
  type DeleteVisualElementMessage,
  type DuplicateVisualElementMessage,
  type EditorTarget,
  type EditorTargetReference,
  type MoveVisualElementMessage,
  type PreviewVisualDragMoveMessage,
  type RequestVisualDragMoveMessage,
  type RestoreVisualElementMessage,
  type VisualDropPosition,
  type VisualElementDeletedMessage,
  type VisualElementDuplicatedMessage,
  type VisualElementMovedMessage,
  type VisualElementRestoredMessage,
  type VisualMutationError,
  type VisualMutationRequestBase,
  type VisualStructureMutationSnapshot,
  type VisualStructureOperation,
  type VisualDragMoveCompletedMessage,
} from '../../shared/editor-messages';
import {
  getComposedParentElement,
  getDeepElementFromPoint,
} from '../target/composed-dom';
import { fallbackTargetForElement } from './fallback-target';
import type { BridgePost } from './types';
import {
  instancesOf,
  resolveNodeIdForElement,
  resolveTreeNode,
} from './layout-tree';
import {
  hideVisualDropIndicator,
  showVisualDropIndicator,
} from './overlay';
import { editorTargetForElement as editorTargetForElementWithOptions } from './editor-target';
import {
  nextEditableSibling,
  previousEditableSibling,
} from './lib/dom';
import { stripRuntimeArtifacts } from './runtime-artifacts';
import {
  createVisualMutationResultBase,
  postVisualMutationResult,
  type VisualMutationResultMessage,
} from './visual-mutation-results';
import {
  resolveVisualTarget,
  type VisualTargetResolveSuccess,
} from './visual-targets';

const PROTECTED_STRUCTURE_TAGS = new Set(['html', 'head', 'body']);

interface StructureMutationSuccess {
  resolved: VisualTargetResolveSuccess;
  structure: VisualStructureMutationSnapshot;
  afterStructure?: VisualStructureMutationSnapshot;
  duplicateTarget?: EditorTarget;
  duplicateNodeId?: string | null;
  dropTarget?: EditorTarget;
  dropNodeId?: string | null;
  position?: VisualDropPosition;
}

export function handleDuplicateVisualElement(
  message: DuplicateVisualElementMessage,
  post: BridgePost,
): void {
  const resolved = resolveStructureTarget(message);
  if (!resolved.ok) {
    postStructureFailure(post, message, resolved.error);
    return;
  }

  const validationError = validateStructureTarget(resolved.element, 'duplicate');
  if (validationError) {
    postStructureFailure(post, message, validationError, resolved);
    return;
  }

  const parent = resolved.element.parentElement;
  if (!parent) {
    postStructureFailure(post, message, unsupportedStructureError('The selected element has no editable parent.'), resolved);
    return;
  }

  const structure = createStructureSnapshot(resolved.element, 'duplicate');
  const clone = cloneStructureElement(resolved.element);
  parent.insertBefore(clone, resolved.element.nextSibling);
  const afterStructure = createStructureSnapshot(clone, 'duplicate');
  const duplicateTarget = editorTargetForElement(clone) ?? undefined;
  const duplicateNodeId = resolveNodeIdForElement(clone);

  postStructureSuccess(post, message, {
    resolved,
    structure,
    afterStructure,
    duplicateTarget,
    duplicateNodeId,
  });
}

export function handleMoveVisualElement(
  message: MoveVisualElementMessage,
  post: BridgePost,
): void {
  const operation = message.direction === 'up' ? 'move-up' : 'move-down';
  const resolved = resolveStructureTarget(message);
  if (!resolved.ok) {
    postStructureFailure(post, message, resolved.error, null, operation);
    return;
  }

  const validationError = validateStructureTarget(resolved.element, operation);
  if (validationError) {
    postStructureFailure(post, message, validationError, resolved, operation);
    return;
  }

  const parent = resolved.element.parentElement;
  const sibling = message.direction === 'up'
    ? previousEditableSibling(resolved.element)
    : nextEditableSibling(resolved.element);

  if (!parent || !sibling) {
    postStructureFailure(
      post,
      message,
      invalidStructureError(message.direction === 'up'
        ? 'There is no previous sibling to move before.'
        : 'There is no next sibling to move after.'),
      resolved,
      operation,
    );
    return;
  }

  const structure = createStructureSnapshot(resolved.element, operation);
  if (message.direction === 'up') {
    parent.insertBefore(resolved.element, sibling);
  } else {
    parent.insertBefore(resolved.element, sibling.nextSibling);
  }
  const afterStructure = createStructureSnapshot(resolved.element, operation);

  postStructureSuccess(post, message, { resolved, structure, afterStructure });
}

export function handleDeleteVisualElement(
  message: DeleteVisualElementMessage,
  post: BridgePost,
): void {
  const resolved = resolveStructureTarget(message);
  if (!resolved.ok) {
    postStructureFailure(post, message, resolved.error);
    return;
  }

  const validationError = validateStructureTarget(resolved.element, 'delete');
  if (validationError) {
    postStructureFailure(post, message, validationError, resolved);
    return;
  }

  const structure = createStructureSnapshot(resolved.element, 'delete');
  resolved.element.remove();
  postStructureSuccess(post, message, { resolved, structure });
}

export function handleRestoreVisualElement(
  message: RestoreVisualElementMessage,
  post: BridgePost,
): void {
  if (!message.structure.targetHtml) {
    postStructureFailure(post, message, invalidStructureError('No stored HTML is available to restore this element.'));
    return;
  }

  const restoredElement = elementFromHtml(message.structure.targetHtml);
  if (!restoredElement) {
    postStructureFailure(post, message, invalidStructureError('The stored HTML could not be parsed into an element.'));
    return;
  }

  const insertion = getInsertionForRestore(message.structure);
  if (!insertion.ok) {
    postStructureFailure(post, message, insertion.error);
    return;
  }

  insertion.parent.insertBefore(restoredElement, insertion.beforeNode);
  const restoredTarget = editorTargetForElement(restoredElement) ?? message.target;
  const restoredResolved: VisualTargetResolveSuccess = {
    ok: true,
    element: restoredElement,
    nodeId: resolveNodeIdForElement(restoredElement),
    target: restoredTarget,
    resolvedBy: 'node-id',
  };
  postStructureSuccess(post, message, {
    resolved: restoredResolved,
    structure: createStructureSnapshot(restoredElement, 'restore'),
  });
}

export function handleVisualDragMoveRequest(
  message: RequestVisualDragMoveMessage,
  post: BridgePost,
): void {
  hideVisualDropIndicator();

  const resolved = resolveStructureTarget(message);
  if (!resolved.ok) {
    postStructureFailure(post, message, resolved.error, null, 'drag-move');
    return;
  }

  const validationError = validateStructureTarget(resolved.element, 'drag-move');
  if (validationError) {
    postStructureFailure(post, message, validationError, resolved, 'drag-move');
    return;
  }

  const dropResolution = resolveDropTarget(message, resolved.element);
  if (!dropResolution.ok) {
    postStructureFailure(post, message, dropResolution.error, resolved, 'drag-move');
    return;
  }

  const insertion = getInsertionForDrop(dropResolution.element, dropResolution.position);
  if (!insertion.ok) {
    postStructureFailure(post, message, insertion.error, resolved, 'drag-move');
    return;
  }

  const structure = createStructureSnapshot(resolved.element, 'drag-move');
  insertion.parent.insertBefore(resolved.element, insertion.beforeNode);
  const afterStructure = createStructureSnapshot(resolved.element, 'drag-move');
  postStructureSuccess(post, message, {
    resolved,
    structure,
    afterStructure,
    dropTarget: editorTargetForElement(dropResolution.element) ?? undefined,
    dropNodeId: resolveNodeIdForElement(dropResolution.element),
    position: dropResolution.position,
  });
}

export function handlePreviewVisualDragMove(
  message: PreviewVisualDragMoveMessage,
): void {
  const resolved = resolveStructureTarget(message);
  if (!resolved.ok || validateStructureTarget(resolved.element, 'drag-move')) {
    hideVisualDropIndicator();
    return;
  }

  const dropResolution = resolveDropTarget(message, resolved.element);
  if (!dropResolution.ok) {
    hideVisualDropIndicator();
    return;
  }

  showVisualDropIndicator(dropResolution.element, dropResolution.position);
}

export function handleClearVisualDragMovePreview(
  _message?: ClearVisualDragMovePreviewMessage,
): void {
  hideVisualDropIndicator();
}

function resolveStructureTarget(message: EditorTargetReference) {
  return resolveVisualTarget({
    target: message.target,
    nodeId: message.nodeId,
    refreshLayoutTreeOnMiss: true,
  });
}

function postStructureSuccess(
  post: BridgePost,
  request: DuplicateVisualElementMessage | MoveVisualElementMessage | DeleteVisualElementMessage | RestoreVisualElementMessage | RequestVisualDragMoveMessage,
  success: StructureMutationSuccess,
): void {
  const result = createStructureResult(request, success);
  postVisualMutationResult(post, result);
}

function postStructureFailure(
  post: BridgePost,
  request: DuplicateVisualElementMessage | MoveVisualElementMessage | DeleteVisualElementMessage | RestoreVisualElementMessage | RequestVisualDragMoveMessage,
  error: VisualMutationError,
  resolved: VisualTargetResolveSuccess | null = null,
  forcedOperation?: VisualStructureOperation,
): void {
  const operation = forcedOperation ?? operationForRequest(request);
  const base = createVisualMutationResultBase({ request, resolved, error, applied: false });
  const result = structureResultForOperation(request, base, operation, undefined, undefined);
  postVisualMutationResult(post, result, { layoutTree: false, overlays: false, highlight: false });
}

function createStructureResult(
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

function structureResultForOperation(
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

function operationForRequest(
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

function validateStructureTarget(element: Element, operation: VisualStructureOperation): VisualMutationError | null {
  if (isExtensionOwnedElement(element) || PROTECTED_STRUCTURE_TAGS.has(element.tagName.toLowerCase())) {
    return {
      code: 'protected-target',
      message: 'This element is protected and cannot be structurally edited in the preview.',
      detail: `Operation: ${operation}; tag: ${element.tagName.toLowerCase()}`,
    };
  }

  if (!element.parentElement && operation !== 'restore') {
    return unsupportedStructureError('This element is not in an editable light-DOM parent.');
  }

  return null;
}

function createStructureSnapshot(
  element: Element,
  operation: VisualStructureOperation,
): VisualStructureMutationSnapshot {
  const previousSibling = previousEditableSibling(element);
  const nextSibling = nextEditableSibling(element);

  return {
    operation,
    parentNodeId: element.parentElement ? resolveNodeIdForElement(element.parentElement) : null,
    childElementIndex: editableElementIndex(element),
    previousSiblingNodeId: previousSibling ? resolveNodeIdForElement(previousSibling) : null,
    nextSiblingNodeId: nextSibling ? resolveNodeIdForElement(nextSibling) : null,
    targetHtml: stripRuntimeArtifacts(element.outerHTML),
  };
}

function editableElementIndex(element: Element): number | null {
  const parent = element.parentElement;
  if (!parent) {
    return null;
  }

  return editableElementChildren(parent).indexOf(element);
}

function editableElementChildren(parent: Element): Element[] {
  return Array.from(parent.children).filter((child) => !isExtensionOwnedElement(child));
}

interface DropTargetResolution {
  ok: true;
  element: Element;
  position: VisualDropPosition;
}

interface DropTargetFailure {
  ok: false;
  error: VisualMutationError;
}

type VisualDragDropRequest = Pick<
  RequestVisualDragMoveMessage,
  'dropPoint' | 'dropTarget' | 'dropNodeId' | 'position'
>;

function resolveDropTarget(
  message: VisualDragDropRequest,
  draggedElement: Element,
): DropTargetResolution | DropTargetFailure {
  if (message.dropPoint) {
    return resolveDropTargetFromPoint(message.dropPoint, draggedElement);
  }

  if (!message.dropTarget) {
    if (message.dropNodeId) {
      const dropElement = resolveTreeNode(message.dropNodeId);
      if (!dropElement) {
        return {
          ok: false,
          error: invalidStructureError('The original drop target could not be found.'),
        };
      }

      if (isInvalidDropElement(dropElement, draggedElement)) {
        return {
          ok: false,
          error: invalidStructureError('Cannot drop an element onto itself or one of its descendants.'),
        };
      }

      return {
        ok: true,
        element: dropElement,
        position: message.position ?? 'after',
      };
    }

    return {
      ok: false,
      error: invalidStructureError('No drop target or drop point was provided.'),
    };
  }

  const resolvedDropTarget = resolveVisualTarget({
    target: message.dropTarget,
    nodeId: message.dropNodeId ?? null,
    refreshLayoutTreeOnMiss: true,
  });

  if (!resolvedDropTarget.ok) {
    return { ok: false, error: resolvedDropTarget.error };
  }

  if (isInvalidDropElement(resolvedDropTarget.element, draggedElement)) {
    return {
      ok: false,
      error: invalidStructureError('Cannot drop an element onto itself or one of its descendants.'),
    };
  }

  return {
    ok: true,
    element: resolvedDropTarget.element,
    position: message.position ?? 'after',
  };
}

function resolveDropTargetFromPoint(
  point: BridgeViewportPoint,
  draggedElement: Element,
): DropTargetResolution | DropTargetFailure {
  let candidate = getDeepElementFromPoint(point.x, point.y);

  while (candidate && isInvalidDropElement(candidate, draggedElement)) {
    candidate = getComposedParentElement(candidate);
  }

  if (!candidate) {
    return {
      ok: false,
      error: invalidStructureError('No editable drop target exists at the drag release point.'),
    };
  }

  if (candidate === document.body) {
    return {
      ok: true,
      element: candidate,
      position: 'inside-end',
    };
  }

  const rect = candidate.getBoundingClientRect();
  return {
    ok: true,
    element: candidate,
    position: point.y < rect.top + (rect.height / 2) ? 'before' : 'after',
  };
}

function isInvalidDropElement(candidate: Element, draggedElement: Element): boolean {
  return candidate === draggedElement
    || draggedElement.contains(candidate)
    || isExtensionOwnedElement(candidate)
    || candidate.tagName.toLowerCase() === 'html'
    || candidate.tagName.toLowerCase() === 'head';
}

interface DropInsertionSuccess {
  ok: true;
  parent: Element;
  beforeNode: ChildNode | null;
}

interface DropInsertionFailure {
  ok: false;
  error: VisualMutationError;
}

function getInsertionForRestore(
  structure: VisualStructureMutationSnapshot,
): DropInsertionSuccess | DropInsertionFailure {
  const parent = structure.parentNodeId
    ? resolveParentByNodeId(structure.parentNodeId)
    : null;

  if (!parent) {
    return {
      ok: false,
      error: invalidStructureError('The original parent could not be found for restore.'),
    };
  }

  if (isExtensionOwnedElement(parent) || parent.tagName.toLowerCase() === 'html' || parent.tagName.toLowerCase() === 'head') {
    return {
      ok: false,
      error: invalidStructureError('The original parent is protected and cannot receive restored elements.'),
    };
  }

  const previousSibling = structure.previousSiblingNodeId
    ? resolveTreeNode(structure.previousSiblingNodeId)
    : null;
  if (previousSibling?.parentElement === parent && !isExtensionOwnedElement(previousSibling)) {
    return {
      ok: true,
      parent,
      beforeNode: previousSibling.nextSibling,
    };
  }

  const indexedBeforeNode = beforeNodeForEditableElementIndex(parent, structure.childElementIndex);
  if (indexedBeforeNode) {
    return {
      ok: true,
      parent,
      beforeNode: indexedBeforeNode,
    };
  }

  const nextSibling = structure.nextSiblingNodeId
    ? resolveTreeNode(structure.nextSiblingNodeId)
    : null;
  if (nextSibling?.parentElement === parent && !isExtensionOwnedElement(nextSibling)) {
    return {
      ok: true,
      parent,
      beforeNode: nextSibling,
    };
  }

  return {
    ok: true,
    parent,
    beforeNode: null,
  };
}

function beforeNodeForEditableElementIndex(
  parent: Element,
  childElementIndex: number | null | undefined,
): Element | null {
  if (childElementIndex === null || childElementIndex === undefined || childElementIndex < 0) {
    return null;
  }

  return editableElementChildren(parent)[childElementIndex] ?? null;
}

function getInsertionForDrop(
  dropElement: Element,
  position: VisualDropPosition,
): DropInsertionSuccess | DropInsertionFailure {
  if (position === 'inside-start' || position === 'inside-end') {
    if (PROTECTED_STRUCTURE_TAGS.has(dropElement.tagName.toLowerCase()) && dropElement !== document.body) {
      return { ok: false, error: invalidStructureError('Cannot insert inside this protected drop target.') };
    }

    return {
      ok: true,
      parent: dropElement,
      beforeNode: position === 'inside-start' ? dropElement.firstChild : null,
    };
  }

  const parent = dropElement.parentElement;
  if (!parent) {
    return { ok: false, error: invalidStructureError('The drop target has no editable parent.') };
  }

  return {
    ok: true,
    parent,
    beforeNode: position === 'before' ? dropElement : dropElement.nextSibling,
  };
}

function editorTargetForElement(element: Element): EditorTarget | null {
  return editorTargetForElementWithOptions(element, {
    resolveInstanceIndex: resolveAiIdInstanceIndex,
  });
}

function resolveAiIdInstanceIndex(aiId: string, element: Element): number {
  const knownIndex = instancesOf(aiId).indexOf(element);
  if (knownIndex >= 0) {
    return knownIndex;
  }

  const liveIndex = liveAiIdInstances(aiId).indexOf(element);
  return Math.max(0, liveIndex);
}

function liveAiIdInstances(aiId: string): Element[] {
  return Array.from(document.querySelectorAll(`[${DATA_AI_ID_ATTRIBUTE}]`))
    .filter((candidate) => (
      !isExtensionOwnedElement(candidate)
      && candidate.getAttribute(DATA_AI_ID_ATTRIBUTE)?.trim() === aiId
    ));
}

function elementFromHtml(html: string): Element | null {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
}

function cloneStructureElement(element: Element): Element {
  const cleanedHtml = stripRuntimeArtifacts(element.outerHTML);
  const parsedClone = elementFromHtml(cleanedHtml);

  if (parsedClone && parsedClone.tagName.toLowerCase() === element.tagName.toLowerCase()) {
    return parsedClone;
  }

  const clone = element.cloneNode(true) as Element;
  removeRuntimeArtifactsFromClone(clone);
  return clone;
}

function removeRuntimeArtifactsFromClone(root: Element): void {
  const candidates = [root, ...Array.from(root.querySelectorAll('*'))];

  for (const candidate of candidates) {
    if (candidate !== root && isExtensionOwnedElement(candidate)) {
      candidate.remove();
      continue;
    }

    for (const attribute of Array.from(candidate.attributes)) {
      const name = attribute.name.toLowerCase();
      if (
        name === 'data-ai-temp-id'
        || name.startsWith('data-ai-editor-')
        || name.startsWith('data-copy-ai-id-')
      ) {
        candidate.removeAttribute(attribute.name);
      }
    }
  }
}

function resolveParentByNodeId(nodeId: string): Element | null {
  return resolveTreeNode(nodeId);
}

function unsupportedStructureError(detail: string): VisualMutationError {
  return {
    code: 'unsupported-target',
    message: 'This structure operation is not supported for the selected element.',
    detail,
  };
}

function invalidStructureError(detail: string): VisualMutationError {
  return {
    code: 'invalid-value',
    message: 'The requested structure operation cannot be applied at this location.',
    detail,
  };
}

function exhaustiveStructureOperation(operation: never): never {
  throw new Error(`Unsupported visual structure operation: ${operation}`);
}

function exhaustiveRequest(request: never): never {
  throw new Error(`Unsupported visual structure request: ${JSON.stringify(request)}`);
}
