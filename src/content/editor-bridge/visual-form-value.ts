import {
  EDITOR_MESSAGE_TYPES,
  type UpdateVisualFormValueMessage,
  type VisualFormValueMutation,
  type VisualFormValueSnapshot,
  type VisualFormValueUpdatedMessage,
  type VisualMutationError,
} from '../../shared/editor-messages';
import {
  dispatchNativeInputEvents,
  isContentEditableElement,
} from './lib/dom';
import type { BridgePost } from './types';
import {
  mutationFailedError as sharedMutationFailedError,
  unsupportedTargetError,
  createVisualMutationResultBase,
  postVisualMutationResult,
} from './visual-mutation-results';
import {
  resolveVisualTarget,
  type VisualTargetResolveSuccess,
} from './visual-targets';

export function handleUpdateVisualFormValue(
  message: UpdateVisualFormValueMessage,
  post: BridgePost,
): void {
  const resolved = resolveVisualTarget({
    target: message.target,
    nodeId: message.nodeId,
    refreshLayoutTreeOnMiss: true,
  });

  if (!resolved.ok) {
    postFormValueFailure(post, message, resolved.error);
    return;
  }

  const previousValue = message.formValue.previousValue ?? currentFormValueForElement(resolved.element);
  if (!previousValue) {
    postFormValueFailure(post, message, unsupportedFormValueError('The selected element is not a supported form value or contenteditable target.'), resolved);
    return;
  }

  const formValue: VisualFormValueMutation = {
    ...message.formValue,
    previousValue,
  };

  try {
    applyFormValue(resolved.element, formValue);
  } catch (error) {
    postFormValueFailure(
      post,
      message,
      mutationFailedError(error instanceof Error ? error.message : 'Failed to apply form value.'),
      resolved,
      formValue,
    );
    return;
  }

  postFormValueSuccess(post, message, resolved, formValue);
}

function postFormValueSuccess(
  post: BridgePost,
  request: UpdateVisualFormValueMessage,
  resolved: VisualTargetResolveSuccess,
  formValue: VisualFormValueMutation,
): void {
  const result: VisualFormValueUpdatedMessage = {
    ...createVisualMutationResultBase({ request, resolved, applied: true }),
    type: EDITOR_MESSAGE_TYPES.visualFormValueUpdated,
    kind: 'form-value',
    formValue,
  };

  postVisualMutationResult(post, result);
}

function postFormValueFailure(
  post: BridgePost,
  request: UpdateVisualFormValueMessage,
  error: VisualMutationError,
  resolved: VisualTargetResolveSuccess | null = null,
  formValue: VisualFormValueMutation = request.formValue,
): void {
  const result: VisualFormValueUpdatedMessage = {
    ...createVisualMutationResultBase({ request, resolved, error, applied: false }),
    type: EDITOR_MESSAGE_TYPES.visualFormValueUpdated,
    kind: 'form-value',
    formValue,
  };

  postVisualMutationResult(post, result, { layoutTree: false, overlays: false, highlight: false });
}

function applyFormValue(element: Element, formValue: VisualFormValueMutation): void {
  if (element instanceof HTMLInputElement) {
    applyInputFormValue(element, formValue);
    return;
  }

  if (element instanceof HTMLTextAreaElement) {
    if (formValue.value !== undefined) {
      element.value = formValue.value;
    }
    dispatchNativeInputEvents(element);
    return;
  }

  if (element instanceof HTMLSelectElement) {
    applySelectFormValue(element, formValue);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }

  if (isContentEditableElement(element)) {
    if (formValue.value !== undefined) {
      element.textContent = formValue.value;
    }
    element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: formValue.value ?? null }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }

  throw new Error('Unsupported form value target.');
}

function applyInputFormValue(element: HTMLInputElement, formValue: VisualFormValueMutation): void {
  if (element.type === 'file') {
    throw new Error('File inputs cannot be edited through visual form controls.');
  }

  if (formValue.value !== undefined) {
    element.value = formValue.value;
  }

  if ((element.type === 'checkbox' || element.type === 'radio') && formValue.checked !== undefined) {
    element.checked = formValue.checked;
  }

  dispatchNativeInputEvents(element);
}

function applySelectFormValue(element: HTMLSelectElement, formValue: VisualFormValueMutation): void {
  if (formValue.selectedValues) {
    const selectedValues = new Set(formValue.selectedValues);
    for (const option of Array.from(element.options)) {
      option.selected = selectedValues.has(option.value);
    }
  }

  if (formValue.selectedIndex !== undefined) {
    element.selectedIndex = normalizeSelectedIndex(formValue.selectedIndex, element.options.length);
  }

  if (formValue.value !== undefined) {
    element.value = formValue.value;
  }
}

function currentFormValueForElement(element: Element): VisualFormValueSnapshot | null {
  if (element instanceof HTMLInputElement) {
    const snapshot: VisualFormValueSnapshot = { value: element.value };
    if (element.type === 'checkbox' || element.type === 'radio') {
      snapshot.checked = element.checked;
    }
    return snapshot;
  }

  if (element instanceof HTMLTextAreaElement) {
    return { value: element.value };
  }

  if (element instanceof HTMLSelectElement) {
    return {
      value: element.value,
      selectedIndex: element.selectedIndex,
      selectedValues: Array.from(element.selectedOptions, (option) => option.value),
    };
  }

  if (isContentEditableElement(element)) {
    return { value: element.textContent ?? '' };
  }

  return null;
}

function normalizeSelectedIndex(index: number, optionCount: number): number {
  if (!Number.isFinite(index)) {
    return -1;
  }

  if (optionCount <= 0) {
    return -1;
  }

  return Math.min(optionCount - 1, Math.max(-1, Math.trunc(index)));
}

function unsupportedFormValueError(detail: string): VisualMutationError {
  return unsupportedTargetError('The selected element cannot be edited with form value controls.', detail);
}

function mutationFailedError(detail: string): VisualMutationError {
  return sharedMutationFailedError('The form value mutation failed.', detail);
}
