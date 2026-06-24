export const WEBMATELOG_RELAY_MESSAGE_SOURCE = 'copy-ai-id';
export const WEBMATELOG_RELAY_MESSAGE_TYPE = 'copy-ai-id:webmatelog-relay';

export interface WebmateLogRelayMessage {
  source: typeof WEBMATELOG_RELAY_MESSAGE_SOURCE;
  type: typeof WEBMATELOG_RELAY_MESSAGE_TYPE;
  endpoint: string;
  payload: Record<string, unknown>;
  timeoutMs: number;
}

export interface WebmateLogRelayResponse {
  ok: boolean;
  status?: number;
  errorName?: string;
  errorMessage?: string;
}

export function createWebmateLogRelayMessage(
  endpoint: string,
  payload: Record<string, unknown>,
  timeoutMs: number,
): WebmateLogRelayMessage {
  return {
    source: WEBMATELOG_RELAY_MESSAGE_SOURCE,
    type: WEBMATELOG_RELAY_MESSAGE_TYPE,
    endpoint,
    payload,
    timeoutMs,
  };
}

export function isWebmateLogRelayMessage(value: unknown): value is WebmateLogRelayMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return record.source === WEBMATELOG_RELAY_MESSAGE_SOURCE
    && record.type === WEBMATELOG_RELAY_MESSAGE_TYPE
    && typeof record.endpoint === 'string'
    && record.endpoint.length > 0
    && Boolean(record.payload)
    && typeof record.payload === 'object'
    && !Array.isArray(record.payload)
    && typeof record.timeoutMs === 'number'
    && Number.isFinite(record.timeoutMs)
    && record.timeoutMs > 0;
}
