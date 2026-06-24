export const FIRST_NOTEBOOK_CHIP_INDEX = 1;

const NOTEBOOK_CHIP_ID_PATTERN = /^el-([1-9]\d*)$/;

export function formatNotebookChipId(index: number): string {
  return `el-${normalizeNextNotebookChipIndex(index)}`;
}

export function getNotebookChipIndex(chipId: unknown): number | null {
  if (typeof chipId !== 'string') {
    return null;
  }

  const match = NOTEBOOK_CHIP_ID_PATTERN.exec(chipId);
  if (!match) {
    return null;
  }

  return normalizeNextNotebookChipIndex(Number(match[1]));
}

export function isNotebookChipId(chipId: unknown): chipId is string {
  return getNotebookChipIndex(chipId) !== null;
}

export function normalizeNextNotebookChipIndex(value: unknown): number {
  if (
    typeof value !== 'number'
    || !Number.isSafeInteger(value)
    || value < FIRST_NOTEBOOK_CHIP_INDEX
  ) {
    return FIRST_NOTEBOOK_CHIP_INDEX;
  }

  return value;
}
