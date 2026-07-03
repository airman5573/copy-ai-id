// Percent-intent stepper math. One click = ±10% additive relative to the
// base captured at the first step (base × (1 + percent/100), rounded to one
// decimal, clamped at 0). Zero/none bases seed on the first `+` step;
// opacity steps in percentage points instead of relative percent.

import type { VisualStyleValueIntent } from '../../shared/visual-edits';

export const STEPPER_STEP_PERCENT = 10;

export interface StepperBaseState {
  // px for lengths; percentage points (0–100) for opacity
  base: number;
  // cumulative percent (lengths) or percentage-point delta (opacity)
  percent: number;
}

export interface StepperStepResult {
  state: StepperBaseState;
  cssValue: string;
  // null when the step seeded a zero base — the edit is then recorded as a
  // concrete value because "n% of 0" carries no intent.
  intent: VisualStyleValueIntent | null;
}

interface SeedRule {
  test: RegExp;
  seed: number;
}

const SEED_RULES: readonly SeedRule[] = [
  { test: /^(padding|margin)(-|$)/, seed: 4 },
  { test: /(^|-)gap$/, seed: 4 },
  { test: /radius/, seed: 2 },
  { test: /^(border-.*-width|border-width|outline-width)$/, seed: 1 },
];

const DEFAULT_SEED_PX = 4;

export function seedValueForProperty(property: string): number {
  const rule = SEED_RULES.find((candidate) => candidate.test.test(property));
  return rule?.seed ?? DEFAULT_SEED_PX;
}

export function stepLengthValue(options: {
  property: string;
  computedValue: string;
  state: StepperBaseState | null;
  direction: 1 | -1;
}): StepperStepResult | null {
  const { property, computedValue, state, direction } = options;

  if (state) {
    const percent = clampPercent(state.percent + direction * STEPPER_STEP_PERCENT);
    if (percent === state.percent) {
      return null;
    }

    return lengthResult(state.base, percent);
  }

  const base = parsePxValue(computedValue);
  if (base === null || base <= 0) {
    if (direction < 0) {
      return null;
    }

    const seed = seedValueForProperty(property);
    return {
      state: { base: seed, percent: 0 },
      cssValue: formatPx(seed),
      intent: null,
    };
  }

  return lengthResult(base, clampPercent(direction * STEPPER_STEP_PERCENT));
}

export function stepOpacityValue(options: {
  computedValue: string;
  state: StepperBaseState | null;
  direction: 1 | -1;
}): StepperStepResult | null {
  const { computedValue, state, direction } = options;
  const basePoints = state
    ? state.base
    : opacityToPercentagePoints(computedValue);
  const previousDelta = state?.percent ?? 0;
  const currentPoints = clampPercentagePoints(basePoints + previousDelta);
  const nextPoints = clampPercentagePoints(currentPoints + direction * STEPPER_STEP_PERCENT);
  if (nextPoints === currentPoints) {
    return null;
  }

  const delta = nextPoints - basePoints;
  return {
    state: { base: basePoints, percent: delta },
    cssValue: formatOpacity(nextPoints),
    intent: {
      percent: delta,
      base: formatOpacity(basePoints),
    },
  };
}

export function formatStepperLengthDisplay(computedValue: string): string {
  const px = parsePxValue(computedValue);
  if (px === null) {
    const trimmed = computedValue.trim();
    return trimmed === '' ? '–' : truncateDisplay(trimmed);
  }

  return `${roundToOneDecimal(px)}px`;
}

export function formatStepperOpacityDisplay(computedValue: string): string {
  return `${Math.round(opacityToPercentagePoints(computedValue))}%`;
}

export function parsePxValue(value: string): number | null {
  const match = /^(-?\d+(?:\.\d+)?)px$/.exec(value.trim());
  if (!match) {
    return null;
  }

  const amount = Number.parseFloat(match[1]);
  return Number.isFinite(amount) ? amount : null;
}

function lengthResult(base: number, percent: number): StepperStepResult {
  const value = Math.max(0, roundToOneDecimal(base * (1 + percent / 100)));

  return {
    state: { base, percent },
    cssValue: formatPx(value),
    intent: {
      percent,
      base: formatPx(base),
    },
  };
}

function opacityToPercentagePoints(computedValue: string): number {
  const amount = Number.parseFloat(computedValue.trim());
  if (!Number.isFinite(amount)) {
    return 100;
  }

  return clampPercentagePoints(amount * 100);
}

function clampPercent(percent: number): number {
  return Math.max(-100, percent);
}

function clampPercentagePoints(points: number): number {
  return Math.max(0, Math.min(100, Math.round(points)));
}

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function formatPx(value: number): string {
  return `${roundToOneDecimal(value)}px`;
}

function formatOpacity(points: number): string {
  return String(roundToOneDecimal(points / 100)).replace(/^0\./, '0.');
}

function truncateDisplay(value: string): string {
  return value.length > 8 ? `${value.slice(0, 7)}…` : value;
}
