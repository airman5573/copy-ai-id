export type NumericStepDirection = 1 | -1;

const CONTEXT_FREE_LENGTH_FACTORS: Record<string, number> = {
  px: 1,
  rem: 16,
  em: 16,
};

const FONT_SIZE_LENGTH_FACTORS: Record<string, number> = {
  ...CONTEXT_FREE_LENGTH_FACTORS,
  '%': 0.16,
};

export function convertNumericUnitValue(
  value: string,
  fromUnit: string,
  toUnit: string,
  options: { fontSizePercent?: boolean } = {},
): string {
  const trimmed = value.trim();
  if (trimmed === '' || fromUnit === toUnit) {
    return trimmed;
  }

  const amount = Number(trimmed);
  if (!Number.isFinite(amount)) {
    return trimmed;
  }

  const factors = options.fontSizePercent ? FONT_SIZE_LENGTH_FACTORS : CONTEXT_FREE_LENGTH_FACTORS;
  const fromFactor = factors[fromUnit];
  const toFactor = factors[toUnit];
  if (!fromFactor || !toFactor) {
    return trimmed;
  }

  return formatNumericInput((amount * fromFactor) / toFactor);
}

export function stepNumericInputValue(value: string, direction: NumericStepDirection, step: number): string {
  const trimmed = value.trim();
  if (trimmed === '') {
    return direction > 0 ? formatNumericInput(step) : formatNumericInput(-step);
  }

  const match = /^(-?\d*\.?\d+)(.*)$/.exec(trimmed);
  if (!match) {
    return value;
  }

  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) {
    return value;
  }

  return `${formatNumericInput(amount + direction * step)}${match[2] ?? ''}`;
}

export function formatNumericInput(value: number): string {
  if (Math.abs(value) < 0.000001) {
    return '0';
  }
  return Number(value.toFixed(4)).toString();
}
