import { useCallback, useMemo } from 'react';

import type {
  EditorTargetReference,
  VisualFormValueMutation,
  VisualFormValueSnapshot,
} from '../../shared/editor-messages';
import type { VisualEditControlDescriptor, VisualEditSource } from '../../shared/visual-edits';
import { QUICK_ACTION_SECTION_IDS } from '../components/visual/sectionJump';
import { useBreakpointStore } from '../stores/useBreakpointStore';
import { useVisualSelectionStore } from '../stores/useVisualSelectionStore';
import { useSelectedTargetReference } from './useSelectedTargetReference';
import {
  dispatchVisualFormValueMutation,
  type VisualMutationDispatchResult,
} from './visualMutationClient';

export type FormValueTargetKind = 'input' | 'checkbox' | 'radio' | 'textarea' | 'select' | 'contenteditable' | 'unsupported';

export interface CommitFormValueOptions {
  source?: VisualEditSource;
  control?: Partial<VisualEditControlDescriptor>;
  skipIfUnchanged?: boolean;
}

export interface FormValueEditApi {
  target: EditorTargetReference | null;
  targetKey: string;
  canEdit: boolean;
  targetKind: FormValueTargetKind;
  formValue: VisualFormValueSnapshot | null;
  supportsValue: boolean;
  supportsChecked: boolean;
  supportsSelection: boolean;
  commitFormValue(formValue: VisualFormValueMutation, options?: CommitFormValueOptions): VisualMutationDispatchResult<'form-value'> | null;
}

export function useFormValueEdit(): FormValueEditApi {
  const snapshot = useVisualSelectionStore((state) => state.snapshot);
  const snapshotStatus = useVisualSelectionStore((state) => state.snapshotStatus);
  const activeBreakpointId = useBreakpointStore((state) => state.activeBreakpointId);

  const target = useSelectedTargetReference();

  const targetKey = useMemo(() => targetKeyForReference(target), [target]);
  const targetKind = formValueTargetKind(snapshot?.tagName, snapshot?.attributes, snapshot?.formValue);
  const formValue = snapshot?.formValue ?? null;
  const canEdit = Boolean(target)
    && Boolean(formValue)
    && snapshotStatus !== 'stale'
    && snapshotStatus !== 'error'
    && targetKind !== 'unsupported';

  const commitFormValue = useCallback((
    nextFormValue: VisualFormValueMutation,
    options: CommitFormValueOptions = {},
  ) => {
    if (!target || !formValue) {
      return null;
    }

    const mutation: VisualFormValueMutation = {
      ...nextFormValue,
      previousValue: formValue,
    };

    if (options.skipIfUnchanged !== false && formValueMutationEqualsSnapshot(mutation, formValue)) {
      return null;
    }

    return dispatchVisualFormValueMutation({
      reference: target,
      snapshot,
      source: options.source ?? 'floating-panel',
      category: 'content',
      breakpointId: activeBreakpointId,
      control: {
        category: 'content',
        kind: 'form-value',
        id: 'content:form-value',
        label: 'Form value',
        sectionId: QUICK_ACTION_SECTION_IDS.content,
        ...options.control,
      },
      formValue: mutation,
    });
  }, [activeBreakpointId, formValue, snapshot, target]);

  return {
    target,
    targetKey,
    canEdit,
    targetKind,
    formValue,
    supportsValue: targetKind === 'input' || targetKind === 'checkbox' || targetKind === 'radio' || targetKind === 'textarea' || targetKind === 'select' || targetKind === 'contenteditable',
    supportsChecked: targetKind === 'checkbox' || targetKind === 'radio',
    supportsSelection: targetKind === 'select',
    commitFormValue,
  };
}

function formValueTargetKind(
  tagName: string | undefined,
  attributes: Record<string, string> | undefined,
  formValue: VisualFormValueSnapshot | undefined,
): FormValueTargetKind {
  const normalizedTagName = tagName?.toLowerCase() ?? '';
  const type = attributes?.type?.toLowerCase() ?? '';
  const contentEditable = attributes?.contenteditable?.toLowerCase();

  if (normalizedTagName === 'input') {
    if (type === 'checkbox') {
      return 'checkbox';
    }
    if (type === 'radio') {
      return 'radio';
    }
    return type === 'file' ? 'unsupported' : 'input';
  }

  if (normalizedTagName === 'textarea') {
    return 'textarea';
  }

  if (normalizedTagName === 'select') {
    return 'select';
  }

  if (contentEditable === '' || contentEditable === 'true' || (formValue && attributes?.contenteditable !== undefined)) {
    return 'contenteditable';
  }

  return 'unsupported';
}

function formValueMutationEqualsSnapshot(
  mutation: VisualFormValueMutation,
  snapshot: VisualFormValueSnapshot,
): boolean {
  if (mutation.value !== undefined && mutation.value !== (snapshot.value ?? '')) {
    return false;
  }

  if (mutation.checked !== undefined && mutation.checked !== snapshot.checked) {
    return false;
  }

  if (mutation.selectedIndex !== undefined && mutation.selectedIndex !== snapshot.selectedIndex) {
    return false;
  }

  if (mutation.selectedValues !== undefined && !arrayEquals(mutation.selectedValues, snapshot.selectedValues ?? [])) {
    return false;
  }

  return true;
}

function arrayEquals(first: readonly string[], second: readonly string[]): boolean {
  return first.length === second.length && first.every((value, index) => value === second[index]);
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
