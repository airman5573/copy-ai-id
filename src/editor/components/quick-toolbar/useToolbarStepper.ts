import { useCallback, useRef } from 'react';

import type { EditorTargetReference } from '../../../shared/domain/targets';
import type {
  QuickActionCategory,
  VisualTargetSnapshot,
} from '../../../shared/domain/visual';
import { targetIdentityKey } from '../../../shared/editor-targets';
import type { VisualEditSource } from '../../../shared/visual-edits';
import {
  setLengthValue,
  setOpacityValue,
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
  // Typed absolute value: px for lengths, percentage points for opacity.
  setPropertyValue(options: ToolbarStepOptions, value: number): void;
  setPropertiesValue(options: Omit<ToolbarStepOptions, 'property' | 'computedProperty'> & {
    properties: string[];
  }, value: number): void;
}

// Per-target stepper state: base values and cumulative percents keyed by CSS
// property. The map resets whenever the pinned target changes, so a new
// selection re-captures bases from its own computed style. Shared by the
// quick toolbar and the floating panel (which passes source 'floating-panel').
export function useToolbarStepper(
  reference: EditorTargetReference | null,
  snapshot: VisualTargetSnapshot | null,
  options: { source?: VisualEditSource } = {},
): ToolbarStepperApi {
  const source = options.source ?? 'quick-action-bar';
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

  const setDeclaration = useCallback((
    options: ToolbarStepOptions,
    value: number,
  ): VisualStyleDeclarationMutationInput => {
    const result = options.mode === 'opacity'
      ? setOpacityValue(value)
      : setLengthValue(value);

    statesRef.current.set(options.property, result.state);
    return {
      property: options.property,
      value: result.cssValue,
      intent: result.intent ?? undefined,
    };
  }, []);

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
      source,
      category: options.category,
      control: { id: `stepper:${options.property}` },
      declarations: [declaration],
      coalesce: true,
    });
  }, [reference, snapshot, source, stepDeclaration]);

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
      source,
      category: options.category,
      control: { id: `stepper:${declarations.map((declaration) => declaration.property).join('+')}` },
      declarations,
      coalesce: true,
    });
  }, [reference, snapshot, source, stepDeclaration]);

  const setPropertyValue = useCallback((options: ToolbarStepOptions, value: number): void => {
    if (!reference || !snapshot) {
      return;
    }

    dispatchVisualStyleMutation({
      reference,
      snapshot,
      source,
      category: options.category,
      control: { id: `stepper:${options.property}` },
      declarations: [setDeclaration(options, value)],
      coalesce: true,
    });
  }, [reference, snapshot, source, setDeclaration]);

  const setPropertiesValue = useCallback((options: Omit<ToolbarStepOptions, 'property' | 'computedProperty'> & {
    properties: string[];
  }, value: number): void => {
    if (!reference || !snapshot || options.properties.length === 0) {
      return;
    }

    const declarations = options.properties.map((property) => setDeclaration({
      property,
      category: options.category,
      mode: options.mode,
    }, value));

    dispatchVisualStyleMutation({
      reference,
      snapshot,
      source,
      category: options.category,
      control: { id: `stepper:${declarations.map((declaration) => declaration.property).join('+')}` },
      declarations,
      coalesce: true,
    });
  }, [reference, snapshot, source, setDeclaration]);

  return { stepProperty, stepProperties, setPropertyValue, setPropertiesValue };
}

function stepperTargetKey(reference: EditorTargetReference): string {
  return `${reference.nodeId ?? ''}::${targetIdentityKey(reference.target)}`;
}
