import { useCallback, useMemo } from 'react';

import type {
  EditorTargetReference,
  VisualTextMutation,
} from '../../shared/editor-messages';
import { sanitizeVisualHtmlFragment } from '../../shared/visual-html';
import type { VisualEditControlDescriptor, VisualEditSource } from '../../shared/visual-edits';
import { QUICK_ACTION_SECTION_IDS } from '../components/visual/sectionJump';
import { useBreakpointStore } from '../stores/useBreakpointStore';
import { useVisualSelectionStore } from '../stores/useVisualSelectionStore';
import { useSelectedTargetReference } from './useSelectedTargetReference';
import {
  dispatchVisualRichTextMutation,
  dispatchVisualTextMutation,
  type VisualMutationDispatchResult,
} from './visualMutationClient';

export interface CommitContentOptions {
  source?: VisualEditSource;
  control?: Partial<VisualEditControlDescriptor>;
  skipIfUnchanged?: boolean;
}

export interface ContentEditApi {
  target: EditorTargetReference | null;
  targetKey: string;
  canEdit: boolean;
  textValue: string;
  richHtml: string;
  commitText(value: string, options?: CommitContentOptions): VisualMutationDispatchResult<'text'> | null;
  commitRichHtml(html: string, options?: CommitContentOptions): VisualMutationDispatchResult<'rich-text'> | null;
}

export function useContentEdit(): ContentEditApi {
  const snapshot = useVisualSelectionStore((state) => state.snapshot);
  const snapshotStatus = useVisualSelectionStore((state) => state.snapshotStatus);
  const activeBreakpointId = useBreakpointStore((state) => state.activeBreakpointId);

  const target = useSelectedTargetReference();

  const textValue = snapshot?.textValue ?? snapshot?.formValue?.value ?? '';
  const richHtml = snapshot?.richHtml ?? '';
  const targetKey = useMemo(() => targetKeyForReference(target), [target]);

  const commitText = useCallback((value: string, options: CommitContentOptions = {}) => {
    if (!target) {
      return null;
    }

    const nextValue = value ?? '';
    if (options.skipIfUnchanged !== false && nextValue === textValue) {
      return null;
    }

    const text: VisualTextMutation = {
      value: nextValue,
      previousValue: textValue,
    };

    return dispatchVisualTextMutation({
      reference: target,
      snapshot,
      source: options.source ?? 'floating-panel',
      category: 'content',
      breakpointId: activeBreakpointId,
      control: {
        category: 'content',
        kind: 'content',
        id: 'content:text',
        label: 'Plain text',
        sectionId: QUICK_ACTION_SECTION_IDS.content,
        ...options.control,
      },
      text,
    });
  }, [activeBreakpointId, snapshot, target, textValue]);

  const commitRichHtml = useCallback((html: string, options: CommitContentOptions = {}) => {
    if (!target) {
      return null;
    }

    const sanitized = sanitizeVisualHtmlFragment(html ?? '');
    if (options.skipIfUnchanged !== false && sanitized.html === richHtml) {
      return null;
    }

    return dispatchVisualRichTextMutation({
      reference: target,
      snapshot,
      source: options.source ?? 'floating-panel',
      category: 'content',
      breakpointId: activeBreakpointId,
      control: {
        category: 'content',
        kind: 'rich-text',
        id: 'content:rich-html',
        label: 'Rich HTML',
        sectionId: QUICK_ACTION_SECTION_IDS.content,
        ...options.control,
      },
      richText: {
        html: sanitized.html,
        previousHtml: richHtml,
      },
      sanitized: sanitized.changed,
      strippedRuntimeArtifacts: sanitized.strippedRuntimeArtifacts,
    });
  }, [activeBreakpointId, richHtml, snapshot, target]);

  return {
    target,
    targetKey,
    canEdit: Boolean(target) && snapshotStatus !== 'stale' && snapshotStatus !== 'error',
    textValue,
    richHtml,
    commitText,
    commitRichHtml,
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
