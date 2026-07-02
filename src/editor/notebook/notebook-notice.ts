import { getCurrentMessages } from '../../shared/i18n';

export function getDefaultNotebookTargetElementNotice(): string {
  return getCurrentMessages().notebook.defaultTargetNotice;
}

const NOTEBOOK_TARGET_NOTICE_STORAGE_KEY = 'copy-ai-id:notebook-target-notice:v1';

function getChromeLocalStorage(): chrome.storage.LocalStorageArea | null {
  if (typeof chrome === 'undefined' || typeof chrome.storage?.local === 'undefined') {
    return null;
  }

  return chrome.storage.local;
}

export async function readNotebookTargetNotice(): Promise<string> {
  const storage = getChromeLocalStorage();
  if (!storage) {
    return getDefaultNotebookTargetElementNotice();
  }

  try {
    const result = await storage.get(NOTEBOOK_TARGET_NOTICE_STORAGE_KEY);
    const value = result[NOTEBOOK_TARGET_NOTICE_STORAGE_KEY];
    return typeof value === 'string' ? value : getDefaultNotebookTargetElementNotice();
  } catch {
    return getDefaultNotebookTargetElementNotice();
  }
}

export async function writeNotebookTargetNotice(targetNotice: string): Promise<void> {
  const storage = getChromeLocalStorage();
  if (!storage) {
    return;
  }

  try {
    await storage.set({ [NOTEBOOK_TARGET_NOTICE_STORAGE_KEY]: targetNotice });
  } catch {
    // Notice persistence is best-effort so copying remains usable if extension
    // storage is temporarily unavailable.
  }
}
