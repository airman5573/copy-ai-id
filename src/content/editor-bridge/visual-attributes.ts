import {
  EDITOR_MESSAGE_TYPES,
  type UpdateVisualAttributeMessage,
  type VisualAttributeMutation,
  type VisualAttributeUpdatedMessage,
  type VisualMutationError,
} from '../../shared/editor-messages';
import { sanitizeVisualAttributeMutation } from '../../shared/visual-attributes';
import { type BridgePost } from './highlight';
import {
  mutationFailedError as sharedMutationFailedError,
  createVisualMutationResultBase,
  postVisualMutationResult,
} from './visual-mutation-results';
import {
  resolveVisualTarget,
  type VisualTargetResolveSuccess,
} from './visual-targets';

export function handleUpdateVisualAttribute(
  message: UpdateVisualAttributeMessage,
  post: BridgePost,
): void {
  const resolved = resolveVisualTarget({
    target: message.target,
    nodeId: message.nodeId,
    refreshLayoutTreeOnMiss: true,
  });

  if (!resolved.ok) {
    postAttributeFailure(post, message, resolved.error);
    return;
  }

  const sanitized = sanitizeVisualAttributeMutation(message.attribute);
  if (!sanitized.ok) {
    postAttributeFailure(post, message, sanitized.error, resolved);
    return;
  }

  const previousValue = message.attribute.previousValue ?? resolved.element.getAttribute(sanitized.attribute.name);
  const attribute: VisualAttributeMutation = {
    ...sanitized.attribute,
    previousValue,
  };

  try {
    applyAttribute(resolved.element, attribute);
  } catch (error) {
    postAttributeFailure(
      post,
      message,
      mutationFailedError(error instanceof Error ? error.message : 'Failed to apply attribute.'),
      resolved,
      attribute,
    );
    return;
  }

  postAttributeSuccess(post, message, resolved, attribute);
}

function postAttributeSuccess(
  post: BridgePost,
  request: UpdateVisualAttributeMessage,
  resolved: VisualTargetResolveSuccess,
  attribute: VisualAttributeMutation,
): void {
  const result: VisualAttributeUpdatedMessage = {
    ...createVisualMutationResultBase({ request, resolved, applied: true }),
    type: EDITOR_MESSAGE_TYPES.visualAttributeUpdated,
    kind: 'attribute',
    attribute,
  };

  postVisualMutationResult(post, result);
}

function postAttributeFailure(
  post: BridgePost,
  request: UpdateVisualAttributeMessage,
  error: VisualMutationError,
  resolved: VisualTargetResolveSuccess | null = null,
  attribute: VisualAttributeMutation = request.attribute,
): void {
  const result: VisualAttributeUpdatedMessage = {
    ...createVisualMutationResultBase({ request, resolved, error, applied: false }),
    type: EDITOR_MESSAGE_TYPES.visualAttributeUpdated,
    kind: 'attribute',
    attribute,
  };

  postVisualMutationResult(post, result, { layoutTree: false, overlays: false, highlight: false });
}

function applyAttribute(element: Element, attribute: VisualAttributeMutation): void {
  if (attribute.value === null) {
    element.removeAttribute(attribute.name);
    return;
  }

  element.setAttribute(attribute.name, attribute.value);
}

function mutationFailedError(detail: string): VisualMutationError {
  return sharedMutationFailedError('The attribute mutation failed.', detail);
}
