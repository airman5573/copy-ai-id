import type {
  BridgeViewportPoint,
  EditorTargetReference,
  QuickActionStructureOperation,
} from '../../shared/editor-messages';
import { EDITOR_MESSAGE_TYPES } from '../../shared/editor-messages';
import { postToBridge } from '../bridge/bridgeClient';
import { editorViewportPointToBridgeViewportPoint } from '../bridge/geometry';
import { showEditorToast } from '../toast';
import { dispatchVisualStructureMutation } from './visualMutationClient';

export type { QuickActionStructureOperation } from '../../shared/editor-messages';

export interface EditorViewportPointLike {
  x: number;
  y: number;
}

export function dispatchQuickActionStructureOperation(
  reference: EditorTargetReference,
  operation: QuickActionStructureOperation,
): void {
  try {
    dispatchVisualStructureMutation({
      reference,
      operation,
      source: 'quick-action-bar',
      category: 'layout',
    });
  } catch (error) {
    showEditorToast(error instanceof Error ? error.message : '구조 편집을 시작할 수 없습니다.', 'error');
  }
}

export function dispatchQuickActionDragMoveFromEditorPoint(
  reference: EditorTargetReference,
  point: EditorViewportPointLike,
): void {
  const dropPoint = editorViewportPointToBridgeViewportPoint(point);

  if (!dropPoint) {
    showEditorToast('드래그 위치를 미리보기 좌표로 변환할 수 없습니다.', 'error');
    return;
  }

  dispatchQuickActionDragMoveFromBridgePoint(reference, dropPoint);
}

export function dispatchQuickActionDragMoveFromBridgePoint(
  reference: EditorTargetReference,
  dropPoint: BridgeViewportPoint,
): void {
  try {
    dispatchVisualStructureMutation({
      reference,
      operation: 'drag-move',
      dropPoint,
      source: 'drag-and-drop',
      category: 'layout',
    });
  } catch (error) {
    showEditorToast(error instanceof Error ? error.message : '드래그 이동을 시작할 수 없습니다.', 'error');
  }
}

export function previewQuickActionDragMoveFromEditorPoint(
  reference: EditorTargetReference,
  point: EditorViewportPointLike,
): void {
  const dropPoint = editorViewportPointToBridgeViewportPoint(point);

  if (!dropPoint) {
    clearQuickActionDragMovePreview();
    return;
  }

  previewQuickActionDragMoveFromBridgePoint(reference, dropPoint);
}

export function previewQuickActionDragMoveFromBridgePoint(
  reference: EditorTargetReference,
  dropPoint: BridgeViewportPoint,
): void {
  postToBridge({
    type: EDITOR_MESSAGE_TYPES.previewVisualDragMove,
    target: reference.target,
    nodeId: reference.nodeId,
    dropPoint,
  });
}

export function clearQuickActionDragMovePreview(): void {
  postToBridge({
    type: EDITOR_MESSAGE_TYPES.clearVisualDragMovePreview,
  });
}
