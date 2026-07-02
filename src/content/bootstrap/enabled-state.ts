import { DEFAULT_ENABLED } from '../../shared/config';
import type { EnabledChangeListener, EnabledState } from '../../shared/types';

// Runtime-only state: values intentionally live in this JS context only and
// reset to DEFAULT_ENABLED whenever the page/frame/extension context reloads.
let currentEnabled: EnabledState = DEFAULT_ENABLED;
const enabledStateListeners = new Set<EnabledChangeListener>();

function notifyEnabledStateChange(): void {
  for (const listener of enabledStateListeners) {
    listener(currentEnabled);
  }
}

export async function getEnabledState(): Promise<EnabledState> {
  return currentEnabled;
}

export async function setEnabledState(enabled: EnabledState): Promise<void> {
  if (typeof enabled !== 'boolean') {
    throw new Error('Copy AI ID enabled state must be a boolean.');
  }

  if (currentEnabled === enabled) {
    return;
  }

  currentEnabled = enabled;
  notifyEnabledStateChange();
}

export function onEnabledStateChange(listener: EnabledChangeListener): () => void {
  enabledStateListeners.add(listener);

  return () => {
    enabledStateListeners.delete(listener);
  };
}
