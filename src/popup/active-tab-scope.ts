import { getActivationScopeKey } from '../shared/activation-scope';

export interface PopupScopeContext {
  scopeKey: string;
  label: string;
  tabId: number;
  windowId: number;
}

interface ActiveTabContext {
  id: number;
  windowId: number;
  url: string;
}

export async function queryActiveTabContext(): Promise<ActiveTabContext | null> {
  if (typeof chrome === 'undefined' || typeof chrome.tabs?.query !== 'function') {
    return null;
  }

  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      const lastError = chrome.runtime?.lastError;
      if (lastError) {
        reject(new Error(lastError.message));
        return;
      }

      const activeTab = tabs?.find((tab) => (
        typeof tab.id === 'number'
        && typeof tab.windowId === 'number'
        && typeof tab.url === 'string'
      )) ?? null;
      if (
        typeof activeTab?.id !== 'number'
        || typeof activeTab.windowId !== 'number'
        || typeof activeTab.url !== 'string'
      ) {
        resolve(null);
        return;
      }

      resolve({ id: activeTab.id, windowId: activeTab.windowId, url: activeTab.url });
    });
  });
}

export function formatScopeLabel(scopeKey: string): string {
  return scopeKey
    .replace(/^https?:\/\//, '')
    .replace(/^file:\/\//, 'file://');
}

export async function resolveActiveTabScopeContext(): Promise<PopupScopeContext | null> {
  const activeTab = await queryActiveTabContext();
  if (!activeTab) {
    return null;
  }

  try {
    const parsedUrl = new URL(activeTab.url);
    if (!['http:', 'https:', 'file:'].includes(parsedUrl.protocol)) {
      return null;
    }

    const scopeKey = getActivationScopeKey(parsedUrl);
    return {
      scopeKey,
      label: formatScopeLabel(scopeKey),
      tabId: activeTab.id,
      windowId: activeTab.windowId,
    };
  } catch {
    return null;
  }
}
