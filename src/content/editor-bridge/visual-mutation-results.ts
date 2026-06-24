import {
  EDITOR_MESSAGE_TYPES,
  type BridgeToEditorMessage,
  type RequestVisualTargetSnapshotMessage,
  type VisualAttributeUpdatedMessage,
  type VisualDragMoveCompletedMessage,
  type VisualElementDeletedMessage,
  type VisualElementDuplicatedMessage,
  type VisualElementMovedMessage,
  type VisualElementRestoredMessage,
  type VisualFormValueUpdatedMessage,
  type VisualMutationError,
  type VisualMutationKind,
  type VisualMutationRequestBase,
  type VisualMutationResultBase,
  type VisualRichTextUpdatedMessage,
  type VisualStyleUpdatedMessage,
  type VisualTargetSnapshotMessage,
  type VisualTextUpdatedMessage,
} from '../../shared/editor-messages';
import {
  buildAndPostLayoutTreeSnapshot,
  type LayoutTreeBuildResult,
} from './layout-tree';
import {
  refreshHighlightedElement,
  type BridgePost,
} from './highlight';
import { refreshOverlays } from './overlay';
import {
  createVisualTargetSnapshot,
  resolveVisualTargetSnapshot,
  type VisualTargetResolveSuccess,
  type VisualTargetSnapshotOptions,
} from './visual-targets';

export type VisualMutationResultMessage =
  | VisualStyleUpdatedMessage
  | VisualTextUpdatedMessage
  | VisualRichTextUpdatedMessage
  | VisualAttributeUpdatedMessage
  | VisualFormValueUpdatedMessage
  | VisualElementDuplicatedMessage
  | VisualElementMovedMessage
  | VisualElementDeletedMessage
  | VisualElementRestoredMessage
  | VisualDragMoveCompletedMessage;

export interface VisualMutationRefreshOptions {
  layoutTree?: boolean;
  overlays?: boolean;
  highlight?: boolean;
}

export interface VisualMutationRefreshResult {
  layoutTree?: LayoutTreeBuildResult;
}

export interface VisualMutationResultBaseOptions {
  request: VisualMutationRequestBase;
  resolved?: VisualTargetResolveSuccess | null;
  error?: VisualMutationError;
  applied?: boolean;
  snapshotOptions?: VisualTargetSnapshotOptions;
}

export interface VisualMutationErrorMessageOptions {
  mutationId?: number;
  kind?: VisualMutationKind;
  target?: VisualMutationRequestBase['target'];
  nodeId?: string | null;
  error: VisualMutationError;
}

export function handleVisualTargetSnapshotRequest(
  message: RequestVisualTargetSnapshotMessage,
  post: BridgePost,
): void {
  const result = resolveVisualTargetSnapshot(
    {
      target: message.target,
      nodeId: message.nodeId,
    },
    {
      computedStyleProperties: message.includeComputedProperties,
    },
  );

  if (!result.ok) {
    postVisualTargetSnapshot(post, {
      type: EDITOR_MESSAGE_TYPES.visualTargetSnapshot,
      target: message.target,
      nodeId: message.nodeId,
      snapshot: null,
      error: result.error,
    });
    return;
  }

  postVisualTargetSnapshot(post, {
    type: EDITOR_MESSAGE_TYPES.visualTargetSnapshot,
    target: result.snapshot.target,
    nodeId: result.snapshot.nodeId,
    snapshot: result.snapshot,
  });
}

export function postVisualTargetSnapshot(
  post: BridgePost,
  message: VisualTargetSnapshotMessage,
): void {
  post(message);
}

export function createVisualMutationResultBase({
  request,
  resolved,
  error,
  applied,
  snapshotOptions,
}: VisualMutationResultBaseOptions): VisualMutationResultBase {
  const snapshot = resolved && resolved.element.isConnected
    ? createVisualTargetSnapshot(resolved, snapshotOptions)
    : undefined;

  return {
    mutationId: request.mutationId,
    target: snapshot?.target ?? resolved?.target ?? request.target,
    nodeId: snapshot?.nodeId ?? resolved?.nodeId ?? request.nodeId,
    applied: applied ?? !error,
    snapshot,
    error,
  };
}

export function postVisualMutationResult(
  post: BridgePost,
  message: VisualMutationResultMessage,
  refreshOptions: VisualMutationRefreshOptions = {},
): VisualMutationRefreshResult {
  post(message);

  if (!message.applied) {
    return {};
  }

  return refreshAfterVisualMutation(post, refreshOptions);
}

export function postVisualMutationError(
  post: BridgePost,
  options: VisualMutationErrorMessageOptions,
): void {
  post({
    type: EDITOR_MESSAGE_TYPES.visualMutationError,
    mutationId: options.mutationId,
    kind: options.kind,
    target: options.target,
    nodeId: options.nodeId,
    error: options.error,
  });
}

export function refreshAfterVisualMutation(
  post: BridgePost,
  options: VisualMutationRefreshOptions = {},
): VisualMutationRefreshResult {
  const result: VisualMutationRefreshResult = {};

  if (options.layoutTree !== false) {
    result.layoutTree = buildAndPostLayoutTreeSnapshot((message) => post(message));
  }

  if (options.overlays !== false) {
    refreshOverlays();
  }

  if (options.highlight !== false) {
    refreshHighlightedElement(post);
  }

  return result;
}

export function isVisualMutationResultMessage(
  message: BridgeToEditorMessage,
): message is VisualMutationResultMessage {
  switch (message.type) {
    case EDITOR_MESSAGE_TYPES.visualStyleUpdated:
    case EDITOR_MESSAGE_TYPES.visualTextUpdated:
    case EDITOR_MESSAGE_TYPES.visualRichTextUpdated:
    case EDITOR_MESSAGE_TYPES.visualAttributeUpdated:
    case EDITOR_MESSAGE_TYPES.visualFormValueUpdated:
    case EDITOR_MESSAGE_TYPES.visualElementDuplicated:
    case EDITOR_MESSAGE_TYPES.visualElementMoved:
    case EDITOR_MESSAGE_TYPES.visualElementDeleted:
    case EDITOR_MESSAGE_TYPES.visualElementRestored:
    case EDITOR_MESSAGE_TYPES.visualDragMoveCompleted:
      return true;
    default:
      return false;
  }
}
