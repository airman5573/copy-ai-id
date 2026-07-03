import { useCallback, useMemo } from 'react';

import type { EditorTargetReference } from '../../shared/domain/targets';
import type { VisualMutationError } from '../../shared/domain/visual';
import {
  sanitizeVisualAttributeMutation,
  visualAttributeDefinitionByName,
  type VisualAttributeName,
  type VisualAttributeSanitizeResult,
} from '../../shared/visual-attributes';
import type { VisualEditControlDescriptor, VisualEditSource } from '../../shared/visual-edits';
import { useBreakpointStore } from '../stores/useBreakpointStore';
import { useVisualSelectionStore } from '../stores/useVisualSelectionStore';
import { useSelectedTargetReference } from './useSelectedTargetReference';
import {
  dispatchVisualAttributeMutation,
  type VisualMutationDispatchResult,
} from './visualMutationClient';

export interface CommitAttributeOptions {
  source?: VisualEditSource;
  control?: Partial<VisualEditControlDescriptor>;
  skipIfUnchanged?: boolean;
}

export type AttributeCommitResult =
  | { ok: true; result: VisualMutationDispatchResult<'attribute'> | null }
  | { ok: false; error: VisualMutationError };

export interface AttributeEditApi {
  target: EditorTargetReference | null;
  targetKey: string;
  canEdit: boolean;
  valueOf(name: VisualAttributeName): string;
  sanitizeAttribute(name: VisualAttributeName, value: string | null): VisualAttributeSanitizeResult;
  commitAttribute(name: VisualAttributeName, value: string | null, options?: CommitAttributeOptions): AttributeCommitResult;
}

export function useAttributeEdit(): AttributeEditApi {
  const snapshot = useVisualSelectionStore((state) => state.snapshot);
  const snapshotStatus = useVisualSelectionStore((state) => state.snapshotStatus);
  const activeBreakpointId = useBreakpointStore((state) => state.activeBreakpointId);

  const target = useSelectedTargetReference();

  const targetKey = useMemo(() => targetKeyForReference(target), [target]);

  const valueOf = useCallback((name: VisualAttributeName): string => {
    if (!snapshot) {
      return '';
    }

    return snapshot.attributes[name] ?? '';
  }, [snapshot]);

  const sanitizeAttribute = useCallback((name: VisualAttributeName, value: string | null): VisualAttributeSanitizeResult => (
    sanitizeVisualAttributeMutation({ name, value })
  ), []);

  const commitAttribute = useCallback((
    name: VisualAttributeName,
    value: string | null,
    options: CommitAttributeOptions = {},
  ): AttributeCommitResult => {
    if (!target) {
      return { ok: true, result: null };
    }

    const previousValue = valueOf(name) || null;
    const sanitized = sanitizeVisualAttributeMutation({ name, value, previousValue });
    if (!sanitized.ok) {
      return { ok: false, error: sanitized.error };
    }

    const nextValue = sanitized.attribute.value;
    if (options.skipIfUnchanged !== false && nextValue === previousValue) {
      return { ok: true, result: null };
    }

    const definition = visualAttributeDefinitionByName(name);
    const result = dispatchVisualAttributeMutation({
      reference: target,
      snapshot,
      source: options.source ?? 'floating-panel',
      category: 'content',
      breakpointId: activeBreakpointId,
      control: {
        category: 'content',
        kind: 'content',
        id: `attribute:${name}`,
        label: definition?.label ?? `Attribute: ${name}`,
        ...options.control,
      },
      attribute: sanitized.attribute,
    });

    return { ok: true, result };
  }, [activeBreakpointId, snapshot, target, valueOf]);

  return {
    target,
    targetKey,
    canEdit: Boolean(target) && snapshotStatus !== 'stale' && snapshotStatus !== 'error',
    valueOf,
    sanitizeAttribute,
    commitAttribute,
  };
}

function targetKeyForReference(reference: EditorTargetReference | null): string {
  if (!reference) {
    return 'none';
  }

  const target = reference.target;
  if (target.kind === 'ai-id') {
    return `ai-id:${target.aiId}:${target.instanceIndex}:${reference.nodeId ?? ''}`;
  }

  return `fallback:${target.nodeId}:${target.selector}:${target.path}:${reference.nodeId ?? ''}`;
}
