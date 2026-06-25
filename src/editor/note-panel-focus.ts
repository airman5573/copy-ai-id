const NOTE_PANEL_FOCUS_EVENT = 'copy-ai-id:focus-note-panel';

export interface NotePanelFocusRequestDetail {
  afterFocus?: () => void;
}

type NotePanelFocusRequestListener = (detail?: NotePanelFocusRequestDetail) => void;

export function requestNotePanelFocus(detail?: NotePanelFocusRequestDetail): void {
  window.dispatchEvent(new CustomEvent<NotePanelFocusRequestDetail | undefined>(NOTE_PANEL_FOCUS_EVENT, {
    detail,
  }));
}

export function onNotePanelFocusRequest(listener: NotePanelFocusRequestListener): () => void {
  const handleFocusRequest = (event: Event): void => {
    listener(event instanceof CustomEvent ? event.detail ?? undefined : undefined);
  };

  window.addEventListener(NOTE_PANEL_FOCUS_EVENT, handleFocusRequest);

  return () => {
    window.removeEventListener(NOTE_PANEL_FOCUS_EVENT, handleFocusRequest);
  };
}
