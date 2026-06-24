const NOTE_EDITOR_HOVER_PROTECTION_MS = 250;

type HoverProtectionListener = (protectedFromHover: boolean) => void;

const hoverProtectionListeners = new Set<HoverProtectionListener>();
let hoverProtectedUntil = 0;
let releaseTimerId: number | null = null;

export function protectEditorInteractionFromHover(durationMs = NOTE_EDITOR_HOVER_PROTECTION_MS): void {
  const wasProtected = isNoteEditorHoverProtected();
  hoverProtectedUntil = Math.max(hoverProtectedUntil, performance.now() + durationMs);

  if (!wasProtected) {
    notifyHoverProtectionListeners(true);
  }

  scheduleHoverProtectionRelease();
}

export function isNoteEditorHoverProtected(): boolean {
  return performance.now() < hoverProtectedUntil;
}

export function onNoteEditorHoverProtectionChange(listener: HoverProtectionListener): () => void {
  hoverProtectionListeners.add(listener);
  listener(isNoteEditorHoverProtected());

  return () => {
    hoverProtectionListeners.delete(listener);
  };
}

function scheduleHoverProtectionRelease(): void {
  if (releaseTimerId !== null) {
    window.clearTimeout(releaseTimerId);
  }

  const remainingMs = Math.max(0, hoverProtectedUntil - performance.now());
  releaseTimerId = window.setTimeout(() => {
    releaseTimerId = null;

    if (isNoteEditorHoverProtected()) {
      scheduleHoverProtectionRelease();
      return;
    }

    notifyHoverProtectionListeners(false);
  }, remainingMs);
}

function notifyHoverProtectionListeners(protectedFromHover: boolean): void {
  for (const listener of hoverProtectionListeners) {
    listener(protectedFromHover);
  }
}

export function protectNoteEditorFromHover(durationMs = NOTE_EDITOR_HOVER_PROTECTION_MS): void {
  protectEditorInteractionFromHover(durationMs);
}
