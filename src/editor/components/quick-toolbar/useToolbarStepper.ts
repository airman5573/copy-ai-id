import { useCallback, useRef } from 'react';

import type { EditorTargetReference } from '../../../shared/domain/targets';
import type {
  QuickActionCategory,
  VisualTargetSnapshot,
} from '../../../shared/domain/visual';
import { targetIdentityKey } from '../../../shared/editor-targets';
import {
  stepLengthValue,
  stepOpacityValue,
  type StepperBaseState,
} from '../../utils/stepperMath';
import {
  dispatchVisualStyleMutation,
  type VisualStyleDeclarationMutationInput,
} from '../../visual/visualMutationClient';

export interface ToolbarStepOptions {
  property: string;
  // Computed property to read the current value from when it differs from the
  // committed property (e.g. commit `gap`, read `row-gap`).
  computedProperty?: string;
  category: QuickActionCategory;
  mode?: 'length' | 'opacity';
}

export interface ToolbarStepperApi {
  stepProperty(options: ToolbarStepOptions, direction: 1 | -1): void;
  stepProperties(options: Omit<ToolbarStepOptions, 'property' | 'computedProperty'> & {
    properties: string[];
  }, direction: 1 | -1): void;
}

// Per-target stepper state: base values and cumulative percents keyed by CSS
// property. The map resets whenever the pinned target changes, so a new
// selection re-captures bases from its own computed style.
export function useToolbarStepper(
  reference: EditorTargetReference | null,
  snapshot: VisualTargetSnapshot | null,
): ToolbarStepperApi {
  const statesRef = useRef<Map<string, StepperBaseState>>(new Map());
  const targetKeyRef = useRef<string | null>(null);

  const targetKey = reference ? stepperTargetKey(reference) : null;
  if (targetKeyRef.current !== targetKey) {
    targetKeyRef.current = targetKey;
    statesRef.current.clear();
  }

  const stepDeclaration = useCallback((
    options: ToolbarStepOptions,
    direction: 1 | -1,
  ): VisualStyleDeclarationMutationInput | null => {
    if (!snapshot) {
      return null;
    }

    const computedValue = snapshot.computedStyle[options.computedProperty ?? options.property] ?? '';
    const state = statesRef.current.get(options.property) ?? null;
    const result = options.mode === 'opacity'
      ? stepOpacityValue({ computedValue, state, direction })
      : stepLengthValue({ property: options.property, computedValue, state, direction });

    if (!result) {
      return null;
    }

    statesRef.current.set(options.property, result.state);
    return {
      property: options.property,
      value: result.cssValue,
      intent: result.intent ?? undefined,
    };
  }, [snapshot]);

  const stepProperty = useCallback((options: ToolbarStepOptions, direction: 1 | -1): void => {
    if (!reference) {
      return;
    }

    const declaration = stepDeclaration(options, direction);
    if (!declaration) {
      return;
    }

    dispatchVisualStyleMutation({
      reference,
      snapshot,
      source: 'quick-action-bar',
      category: options.category,
      control: { id: `stepper:${options.property}` },
      declarations: [declaration],
      coalesce: true,
    });
  }, [reference, snapshot, stepDeclaration]);

  const stepProperties = useCallback((options: Omit<ToolbarStepOptions, 'property' | 'computedProperty'> & {
    properties: string[];
  }, direction: 1 | -1): void => {
    if (!reference) {
      return;
    }

    const declarations = options.properties
      .map((property) => stepDeclaration({
        property,
        category: options.category,
        mode: options.mode,
      }, direction))
      .filter((declaration): declaration is VisualStyleDeclarationMutationInput => declaration !== null);

    if (declarations.length === 0) {
      return;
    }

    dispatchVisualStyleMutation({
      reference,
      snapshot,
      source: 'quick-action-bar',
      category: options.category,
      control: { id: `stepper:${declarations.map((declaration) => declaration.property).join('+')}` },
      declarations,
      coalesce: true,
    });
  }, [reference, snapshot, stepDeclaration]);

  return { stepProperty, stepProperties };
}

function stepperTargetKey(reference: EditorTargetReference): string {
  return `${reference.nodeId ?? ''}::${targetIdentityKey(reference.target)}`;
}
