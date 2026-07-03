// Tracks open quick-toolbar popovers so the global Escape cascade can close
// the most recent popover before unpinning the toolbar (shortcut-actions.ts).

const openPopoverClosers = new Map<string, () => void>();

export function registerOpenQuickToolbarPopover(id: string, close: () => void): void {
  openPopoverClosers.delete(id);
  openPopoverClosers.set(id, close);
}

export function unregisterQuickToolbarPopover(id: string): void {
  openPopoverClosers.delete(id);
}

export function closeOpenQuickToolbarPopover(): boolean {
  const lastEntry = Array.from(openPopoverClosers.entries()).pop();
  if (!lastEntry) {
    return false;
  }

  openPopoverClosers.delete(lastEntry[0]);
  lastEntry[1]();
  return true;
}

export function hasOpenQuickToolbarPopover(): boolean {
  return openPopoverClosers.size > 0;
}
