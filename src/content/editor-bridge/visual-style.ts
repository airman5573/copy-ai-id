import {
  type VisualMutationError,
  type VisualStyleDeclarationMutation,
} from '../../shared/domain/visual';
import {
  EDITOR_MESSAGE_TYPES,
  type UpdateVisualStyleMessage,
  type VisualStyleUpdatedMessage,
} from '../../shared/protocol/editor-bridge-messages';
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

export function handleUpdateVisualStyle(
  message: UpdateVisualStyleMessage,
  post: BridgePost,
): void {
  const resolved = resolveVisualTarget({
    target: message.target,
    nodeId: message.nodeId,
    refreshLayoutTreeOnMiss: true,
  });

  if (!resolved.ok) {
    postStyleFailure(post, message, resolved.error);
    return;
  }

  const style = inlineStyleForElement(resolved.element);
  if (!style) {
    postStyleFailure(post, message, unsupportedStyleError('The selected element does not support inline styles.'), resolved);
    return;
  }

  if (message.declarations.length === 0) {
    postStyleFailure(post, message, invalidStyleError('No CSS declarations were provided.'), resolved);
    return;
  }

  const declarations = normalizeDeclarations(message.declarations, style);
  const invalidDeclaration = declarations.find((declaration) => declaration.property === '');
  if (invalidDeclaration) {
    postStyleFailure(post, message, invalidStyleError('A CSS property name is empty.'), resolved);
    return;
  }

  let appliedCount = 0;
  try {
    for (const declaration of declarations) {
      applyDeclaration(style, declaration);
      appliedCount += 1;
    }
  } catch (error) {
    postStyleFailure(
      post,
      message,
      mutationFailedError(error instanceof Error ? error.message : 'Failed to apply inline style declaration.'),
      resolved,
      declarations,
      appliedCount,
    );
    return;
  }

  postStyleSuccess(post, message, resolved, declarations, appliedCount);
}

function postStyleSuccess(
  post: BridgePost,
  request: UpdateVisualStyleMessage,
  resolved: VisualTargetResolveSuccess,
  declarations: VisualStyleDeclarationMutation[],
  appliedCount: number,
): void {
  const base = createVisualMutationResultBase({
    request,
    resolved,
    applied: true,
  });
  const result: VisualStyleUpdatedMessage = {
    ...base,
    type: EDITOR_MESSAGE_TYPES.visualStyleUpdated,
    kind: 'style',
    declarations,
    appliedCount,
  };

  postVisualMutationResult(post, result);
}

function postStyleFailure(
  post: BridgePost,
  request: UpdateVisualStyleMessage,
  error: VisualMutationError,
  resolved: VisualTargetResolveSuccess | null = null,
  declarations: VisualStyleDeclarationMutation[] = request.declarations,
  appliedCount = 0,
): void {
  const base = createVisualMutationResultBase({
    request,
    resolved,
    error,
    applied: false,
  });
  const result: VisualStyleUpdatedMessage = {
    ...base,
    type: EDITOR_MESSAGE_TYPES.visualStyleUpdated,
    kind: 'style',
    declarations,
    appliedCount,
  };

  postVisualMutationResult(post, result, { layoutTree: false, overlays: false, highlight: false });
}

function normalizeDeclarations(
  declarations: readonly VisualStyleDeclarationMutation[],
  style: CSSStyleDeclaration,
): VisualStyleDeclarationMutation[] {
  return declarations.map((declaration) => {
    const property = declaration.property.trim();
    const previousInlineValue = property ? style.getPropertyValue(property) : '';

    return {
      property,
      value: declaration.value,
      priority: declaration.priority === 'important' ? 'important' : '',
      previousValue: declaration.previousValue ?? (previousInlineValue === '' ? null : previousInlineValue),
    };
  });
}

function applyDeclaration(style: CSSStyleDeclaration, declaration: VisualStyleDeclarationMutation): void {
  if (declaration.value === '') {
    style.removeProperty(declaration.property);
    return;
  }

  style.setProperty(declaration.property, declaration.value, declaration.priority ?? '');
}

function inlineStyleForElement(element: Element): CSSStyleDeclaration | null {
  const candidate = element as Element & { style?: CSSStyleDeclaration };
  if (!candidate.style || typeof candidate.style.setProperty !== 'function') {
    return null;
  }

  return candidate.style;
}

function invalidStyleError(detail: string): VisualMutationError {
  return {
    code: 'invalid-value',
    message: 'The inline style mutation is invalid.',
    detail,
  };
}

function unsupportedStyleError(detail: string): VisualMutationError {
  return unsupportedTargetError('The selected element cannot be styled.', detail);
}

function mutationFailedError(detail: string): VisualMutationError {
  return sharedMutationFailedError('The inline style mutation failed.', detail);
}
