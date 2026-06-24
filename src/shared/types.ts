export type EnabledState = boolean;

export interface CopyResult {
  ok: boolean;
  value: string;
  error?: string;
}

export type EnabledChangeListener = (enabled: EnabledState) => void;
