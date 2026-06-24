const NOTE_PANEL_FOCUS_EVENT = 'copy-ai-id:focus-note-panel';

export function requestNotePanelFocus(): void {
  window.dispatchEvent(new CustomEvent(NOTE_PANEL_FOCUS_EVENT));
}

export function onNotePanelFocusRequest(listener: () => void): () => void {
  window.addEventListener(NOTE_PANEL_FOCUS_EVENT, listener);

  return () => {
    window.removeEventListener(NOTE_PANEL_FOCUS_EVENT, listener);
  };
}
