import {
  EDITOR_MESSAGE_TYPES,
  type UpdateVisualRichTextMessage,
  type UpdateVisualTextMessage,
  type VisualMutationError,
  type VisualRichTextMutation,
  type VisualRichTextUpdatedMessage,
  type VisualTextMutation,
  type VisualTextUpdatedMessage,
} from '../../shared/editor-messages';
import { sanitizeVisualHtmlFragment } from '../../shared/visual-html';
import { type BridgePost } from './highlight';
import {
  createVisualMutationResultBase,
  postVisualMutationResult,
} from './visual-mutation-results';
import {
  resolveVisualTarget,
  type VisualTargetResolveSuccess,
} from './visual-targets';

export function handleUpdateVisualText(
  message: UpdateVisualTextMessage,
  post: BridgePost,
): void {
  const resolved = resolveVisualTarget({
    target: message.target,
    nodeId: message.nodeId,
    refreshLayoutTreeOnMiss: true,
  });

  if (!resolved.ok) {
    postTextFailure(post, message, resolved.error);
    return;
  }

  const value = message.text.value ?? '';
  const previousValue = message.text.previousValue ?? currentTextValue(resolved.element);
  const text: VisualTextMutation = {
    ...message.text,
    value,
    previousValue,
  };

  try {
    applyTextValue(resolved.element, value);
  } catch (error) {
    postTextFailure(
      post,
      message,
      mutationFailedError(error instanceof Error ? error.message : 'Failed to apply text content.'),
      resolved,
      text,
    );
    return;
  }

  postTextSuccess(post, message, resolved, text);
}

export function handleUpdateVisualRichText(
  message: UpdateVisualRichTextMessage,
  post: BridgePost,
): void {
  const resolved = resolveVisualTarget({
    target: message.target,
    nodeId: message.nodeId,
    refreshLayoutTreeOnMiss: true,
  });

  if (!resolved.ok) {
    postRichTextFailure(post, message, resolved.error);
    return;
  }

  if (!supportsRichHtmlMutation(resolved.element)) {
    postRichTextFailure(post, message, unsupportedContentError('The selected element cannot receive rich HTML. Use plain text for form fields.'), resolved);
    return;
  }

  const previousHtml = message.richText.previousHtml ?? resolved.element.innerHTML;
  const sanitized = sanitizeVisualHtmlFragment(message.richText.html ?? '');
  const richText: VisualRichTextMutation = {
    ...message.richText,
    html: sanitized.html,
    previousHtml,
  };

  try {
    resolved.element.innerHTML = sanitized.html;
  } catch (error) {
    postRichTextFailure(
      post,
      message,
      mutationFailedError(error instanceof Error ? error.message : 'Failed to apply rich HTML.'),
      resolved,
      richText,
    );
    return;
  }

  postRichTextSuccess(post, message, resolved, richText);
}

function postTextSuccess(
  post: BridgePost,
  request: UpdateVisualTextMessage,
  resolved: VisualTargetResolveSuccess,
  text: VisualTextMutation,
): void {
  const result: VisualTextUpdatedMessage = {
    ...createVisualMutationResultBase({ request, resolved, applied: true }),
    type: EDITOR_MESSAGE_TYPES.visualTextUpdated,
    kind: 'text',
    text,
  };

  postVisualMutationResult(post, result);
}

function postTextFailure(
  post: BridgePost,
  request: UpdateVisualTextMessage,
  error: VisualMutationError,
  resolved: VisualTargetResolveSuccess | null = null,
  text: VisualTextMutation = request.text,
): void {
  const result: VisualTextUpdatedMessage = {
    ...createVisualMutationResultBase({ request, resolved, error, applied: false }),
    type: EDITOR_MESSAGE_TYPES.visualTextUpdated,
    kind: 'text',
    text,
  };

  postVisualMutationResult(post, result, { layoutTree: false, overlays: false, highlight: false });
}

function postRichTextSuccess(
  post: BridgePost,
  request: UpdateVisualRichTextMessage,
  resolved: VisualTargetResolveSuccess,
  richText: VisualRichTextMutation,
): void {
  const result: VisualRichTextUpdatedMessage = {
    ...createVisualMutationResultBase({ request, resolved, applied: true }),
    type: EDITOR_MESSAGE_TYPES.visualRichTextUpdated,
    kind: 'rich-text',
    richText,
  };

  postVisualMutationResult(post, result);
}

function postRichTextFailure(
  post: BridgePost,
  request: UpdateVisualRichTextMessage,
  error: VisualMutationError,
  resolved: VisualTargetResolveSuccess | null = null,
  richText: VisualRichTextMutation = request.richText,
): void {
  const result: VisualRichTextUpdatedMessage = {
    ...createVisualMutationResultBase({ request, resolved, error, applied: false }),
    type: EDITOR_MESSAGE_TYPES.visualRichTextUpdated,
    kind: 'rich-text',
    richText,
  };

  postVisualMutationResult(post, result, { layoutTree: false, overlays: false, highlight: false });
}

function applyTextValue(element: Element, value: string): void {
  if (element instanceof HTMLInputElement) {
    if (element.type === 'file') {
      throw new Error('File inputs cannot be edited through text content controls.');
    }
    element.value = value;
    dispatchNativeInputEvents(element);
    return;
  }

  if (element instanceof HTMLTextAreaElement) {
    element.value = value;
    dispatchNativeInputEvents(element);
    return;
  }

  if (element instanceof HTMLSelectElement) {
    element.value = value;
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }

  element.textContent = value;
}

function currentTextValue(element: Element): string {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
    return element.value;
  }

  return element.textContent ?? '';
}

function supportsRichHtmlMutation(element: Element): boolean {
  return !(element instanceof HTMLInputElement)
    && !(element instanceof HTMLTextAreaElement)
    && !(element instanceof HTMLSelectElement)
    && !(element instanceof HTMLImageElement)
    && !(element instanceof HTMLVideoElement)
    && !(element instanceof HTMLAudioElement)
    && 'innerHTML' in element;
}

function dispatchNativeInputEvents(element: HTMLElement): void {
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

function unsupportedContentError(detail: string): VisualMutationError {
  return {
    code: 'unsupported-target',
    message: 'The selected element cannot be edited with this content control.',
    detail,
  };
}

function mutationFailedError(detail: string): VisualMutationError {
  return {
    code: 'mutation-failed',
    message: 'The content mutation failed.',
    detail,
  };
}
