import { type VisualMutationError } from '../../shared/domain/visual';
import {
  EDITOR_MESSAGE_TYPES,
  type RequestVisualTargetSnapshotMessage,
  type VisualAttributeUpdatedMessage,
  type VisualDragMoveCompletedMessage,
  type VisualElementDeletedMessage,
  type VisualElementDuplicatedMessage,
  type VisualElementMovedMessage,
  type VisualElementRestoredMessage,
  type VisualFormValueUpdatedMessage,
  type VisualMutationRequestBase,
  type VisualMutationResultBase,
  type VisualRichTextUpdatedMessage,
  type VisualStyleUpdatedMessage,
  type VisualTargetSnapshotMessage,
  type VisualTextUpdatedMessage,
} from '../../shared/protocol/editor-bridge-messages';
import {
  buildAndPostLayoutTreeSnapshot,
  type LayoutTreeBuildResult,
} from './layout-tree';
import {
  refreshHighlightedElement,
} from './highlight';
import type { BridgePost } from './types';
import { refreshOverlays } from './overlay';
import {
  createVisualTargetSnapshot,
  resolveVisualTargetSnapshot,
  type VisualTargetResolveSuccess,
  type VisualTargetSnapshotOptions,
} from './visual-target-resolver';

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

export function mutationFailedError(message: string, detail: string): VisualMutationError {
  return {
    code: 'mutation-failed',
    message,
    detail,
  };
}

export function unsupportedTargetError(message: string, detail: string): VisualMutationError {
  return {
    code: 'unsupported-target',
    message,
    detail,
  };
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
    refreshHighlightedElement(post, { force: true });
  }

  return result;
}
