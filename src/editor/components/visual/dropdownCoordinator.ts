const VISUAL_DROPDOWN_OPEN_EVENT = 'copy-ai-id:visual-dropdown-open';
const VISUAL_DROPDOWN_CLOSE_ALL_EVENT = 'copy-ai-id:visual-dropdown-close-all';

type VisualDropdownOpenDetail = {
  id: string;
};

export function announceVisualDropdownOpen(id: string): void {
  window.dispatchEvent(new CustomEvent<VisualDropdownOpenDetail>(VISUAL_DROPDOWN_OPEN_EVENT, {
    detail: { id },
  }));
}

export function announceVisualDropdownCloseAll(): void {
  window.dispatchEvent(new CustomEvent(VISUAL_DROPDOWN_CLOSE_ALL_EVENT));
}

export function listenForOtherVisualDropdowns(id: string, onOtherOpen: () => void): () => void {
  const handleOpen = (event: Event): void => {
    const detail = (event as CustomEvent<VisualDropdownOpenDetail>).detail;
    if (!detail || detail.id === id) {
      return;
    }
    onOtherOpen();
  };

  window.addEventListener(VISUAL_DROPDOWN_OPEN_EVENT, handleOpen);
  return () => window.removeEventListener(VISUAL_DROPDOWN_OPEN_EVENT, handleOpen);
}

export function listenForVisualDropdownCloseAll(onClose: () => void): () => void {
  window.addEventListener(VISUAL_DROPDOWN_CLOSE_ALL_EVENT, onClose);
  return () => window.removeEventListener(VISUAL_DROPDOWN_CLOSE_ALL_EVENT, onClose);
}
