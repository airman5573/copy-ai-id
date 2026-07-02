/**
 * Frame-to-top-frame channel: child frames (including the preview iframe's
 * keyboard handler) ask the top-frame content script to toggle the editor.
 * Wire strings must stay stable so old and new frames interoperate while an
 * extension update is rolling out.
 */

export const CONTENT_SCRIPT_FRAME_SOURCE = 'copy-ai-id-content-script';

export const FRAME_MESSAGE_TYPES = {
  setTopEditorEnabled: 'copy-ai-id:set-top-editor-enabled',
} as const;

export interface SetTopEditorEnabledMessage {
  source: typeof CONTENT_SCRIPT_FRAME_SOURCE;
  type: typeof FRAME_MESSAGE_TYPES.setTopEditorEnabled;
  enabled: boolean;
}

export function createSetTopEditorEnabledMessage(enabled: boolean): SetTopEditorEnabledMessage {
  return {
    source: CONTENT_SCRIPT_FRAME_SOURCE,
    type: FRAME_MESSAGE_TYPES.setTopEditorEnabled,
    enabled,
  };
}

export function isSetTopEditorEnabledMessage(value: unknown): value is SetTopEditorEnabledMessage {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const message = value as { source?: unknown; type?: unknown; enabled?: unknown };
  return message.source === CONTENT_SCRIPT_FRAME_SOURCE
    && message.type === FRAME_MESSAGE_TYPES.setTopEditorEnabled
    && typeof message.enabled === 'boolean';
}
