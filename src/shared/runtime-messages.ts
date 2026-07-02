export const RUNTIME_MESSAGE_TYPES = {
  getState: 'copy-ai-id:get-runtime-state',
  setEnabled: 'copy-ai-id:set-enabled',
} as const;

export interface RuntimeStateMessageResponse {
  enabled: boolean;
  available: boolean;
}

export interface GetRuntimeStateMessage {
  type: typeof RUNTIME_MESSAGE_TYPES.getState;
}

export interface SetEnabledRuntimeMessage {
  type: typeof RUNTIME_MESSAGE_TYPES.setEnabled;
  enabled: boolean;
}

export type CopyAiIdRuntimeMessage =
  | GetRuntimeStateMessage
  | SetEnabledRuntimeMessage;

export function isCopyAiIdRuntimeMessage(value: unknown): value is CopyAiIdRuntimeMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const type = (value as { type?: unknown }).type;
  switch (type) {
    case RUNTIME_MESSAGE_TYPES.getState:
      return true;
    case RUNTIME_MESSAGE_TYPES.setEnabled:
      return typeof (value as { enabled?: unknown }).enabled === 'boolean';
    default:
      return false;
  }
}
