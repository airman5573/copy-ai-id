import { cssPropertyLabel } from '../lib/format';
import { useCallback } from 'react';

import type { EditorTargetReference } from '../../shared/domain/targets';
import type {
  QuickActionCategory,
  VisualStyleDeclarationMutation,
} from '../../shared/domain/visual';
import {
  getVisualStylePropertyDefinition,
  normalizeVisualStyleValue,
  type VisualStyleCategory,
} from '../../shared/visual-style';
import type { VisualEditControlDescriptor, VisualEditSource } from '../../shared/visual-edits';
import { useBreakpointStore } from '../stores/useBreakpointStore';
import { useVisualSelectionStore } from '../stores/useVisualSelectionStore';
import { useSelectedTargetReference } from './useSelectedTargetReference';
import {
  dispatchVisualStyleMutation,
  type VisualMutationDispatchResult,
} from './visualMutationClient';
import { QUICK_ACTION_SECTION_IDS } from '../components/visual/sectionJump';

export interface CommitStyleOptions {
  priority?: '' | 'important';
  source?: VisualEditSource;
  category?: QuickActionCategory | null;
  control?: Partial<VisualEditControlDescriptor>;
  skipIfUnchanged?: boolean;
}

export interface CommitStyleInput extends CommitStyleOptions {
  propertyId: string;
  value: string;
}

export interface StyleEditApi {
  target: EditorTargetReference | null;
  canEdit: boolean;
  valueOf(propertyId: string): string;
  inlineValueOf(propertyId: string): string | null;
  computedValueOf(propertyId: string): string;
  commitStyle(propertyId: string, cssValue: string, options?: CommitStyleOptions): VisualMutationDispatchResult<'style'> | null;
  commitStyles(edits: CommitStyleInput[], options?: CommitStyleOptions): VisualMutationDispatchResult<'style'> | null;
  resetStyle(propertyId: string, options?: CommitStyleOptions): VisualMutationDispatchResult<'style'> | null;
}

export function useStyleEdit(): StyleEditApi {
  const panelTarget = useVisualSelectionStore((state) => state.panelTarget);
  const snapshot = useVisualSelectionStore((state) => state.snapshot);
  const snapshotStatus = useVisualSelectionStore((state) => state.snapshotStatus);
  const activeBreakpointId = useBreakpointStore((state) => state.activeBreakpointId);

  const target = useSelectedTargetReference();

  const inlineValueOf = useCallback((propertyId: string): string | null => {
    if (!snapshot) {
      return null;
    }
    return Object.prototype.hasOwnProperty.call(snapshot.inlineStyle, propertyId)
      ? snapshot.inlineStyle[propertyId]
      : null;
  }, [snapshot]);

  const computedValueOf = useCallback((propertyId: string): string => {
    if (!snapshot) {
      return '';
    }
    return snapshot.computedStyle[propertyId] ?? '';
  }, [snapshot]);

  const valueOf = useCallback((propertyId: string): string => (
    inlineValueOf(propertyId) ?? computedValueOf(propertyId)
  ), [computedValueOf, inlineValueOf]);

  const commitStyles = useCallback((edits: CommitStyleInput[], options: CommitStyleOptions = {}) => {
    if (!target || edits.length === 0) {
      return null;
    }

    const declarations = edits
      .map((edit) => normalizeCommitStyleInput(edit, options))
      .filter((declaration): declaration is VisualStyleDeclarationMutation => {
        if (!declaration) {
          return false;
        }

        if (options.skipIfUnchanged === false) {
          return true;
        }

        return hasStyleChange(declaration, valueOf, inlineValueOf);
      });

    if (declarations.length === 0) {
      return null;
    }

    const category = resolveCommitCategory(declarations, options.category ?? panelTarget?.category ?? null);
    const control = createStyleControlDescriptor(declarations, category, options.control);

    return dispatchVisualStyleMutation({
      reference: target,
      snapshot,
      source: options.source ?? 'floating-panel',
      category,
      breakpointId: activeBreakpointId,
      control,
      declarations,
    });
  }, [activeBreakpointId, inlineValueOf, panelTarget?.category, snapshot, target, valueOf]);

  const commitStyle = useCallback((propertyId: string, cssValue: string, options: CommitStyleOptions = {}) => (
    commitStyles([{ propertyId, value: cssValue, ...options }], options)
  ), [commitStyles]);

  const resetStyle = useCallback((propertyId: string, options: CommitStyleOptions = {}) => (
    commitStyle(propertyId, '', { ...options, skipIfUnchanged: options.skipIfUnchanged ?? true })
  ), [commitStyle]);

  return {
    target,
    canEdit: Boolean(target) && snapshotStatus !== 'stale' && snapshotStatus !== 'error',
    valueOf,
    inlineValueOf,
    computedValueOf,
    commitStyle,
    commitStyles,
    resetStyle,
  };
}

function normalizeCommitStyleInput(
  input: CommitStyleInput,
  defaults: CommitStyleOptions,
): VisualStyleDeclarationMutation | null {
  const property = input.propertyId.trim();
  if (!property) {
    return null;
  }

  return {
    property,
    value: normalizeVisualStyleValue(input.value),
    priority: input.priority ?? defaults.priority ?? '',
  };
}

function hasStyleChange(
  declaration: VisualStyleDeclarationMutation,
  valueOf: (propertyId: string) => string,
  inlineValueOf: (propertyId: string) => string | null,
): boolean {
  if (declaration.value === '') {
    return inlineValueOf(declaration.property) !== null;
  }

  return declaration.value !== normalizeVisualStyleValue(valueOf(declaration.property));
}

function resolveCommitCategory(
  declarations: VisualStyleDeclarationMutation[],
  fallback: QuickActionCategory | null,
): VisualStyleCategory {
  const definition = getVisualStylePropertyDefinition(declarations[0]?.property ?? '');
  if (definition) {
    return definition.category;
  }

  if (fallback && fallback !== 'content') {
    return fallback;
  }

  return 'style';
}

function createStyleControlDescriptor(
  declarations: VisualStyleDeclarationMutation[],
  category: VisualStyleCategory,
  override: Partial<VisualEditControlDescriptor> | undefined,
): Partial<VisualEditControlDescriptor> {
  const firstProperty = declarations[0]?.property ?? 'style';
  const firstDefinition = getVisualStylePropertyDefinition(firstProperty);
  const label = declarations.length === 1
    ? firstDefinition?.label ?? cssPropertyLabel(firstProperty)
    : `${declarations.length} CSS declarations`;

  return {
    category,
    kind: category,
    id: declarations.length === 1 ? `style:${firstProperty}` : 'style:multiple',
    label,
    sectionId: QUICK_ACTION_SECTION_IDS[category],
    property: declarations.length === 1 ? firstProperty : undefined,
    ...override,
  };
}

