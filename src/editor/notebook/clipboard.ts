import type { CopyResult } from '../../shared/types';

export async function copyText(value: string): Promise<CopyResult> {
  try {
    await navigator.clipboard.writeText(value);
    return {
      ok: true,
      value,
    };
  } catch (error) {
    return {
      ok: false,
      value,
      error: error instanceof Error ? error.message : 'Clipboard write failed',
    };
  }
}
