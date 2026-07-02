import { mountCopyAiIdEditor, type MountedCopyAiIdEditor } from '../../editor/main';
import { EDITOR_HOST_ATTR, EDITOR_HOST_Z_INDEX } from '../../shared/config';

export interface EditorShellControllerOptions {
  onRequestClose(): void;
}

export interface EditorShellController {
  setEnabled(enabled: boolean): void;
  destroy(): void;
}

export function createEditorShellController(
  options: EditorShellControllerOptions,
): EditorShellController {
  let host: HTMLElement | null = null;
  let mountedEditor: MountedCopyAiIdEditor | null = null;

  function ensureHost(): HTMLElement {
    const existingHost = document.querySelector<HTMLElement>(`[${EDITOR_HOST_ATTR}]`);
    if (existingHost) {
      existingHost.remove();
    }

    const nextHost = document.createElement('div');
    nextHost.setAttribute(EDITOR_HOST_ATTR, 'true');
    nextHost.setAttribute('data-ai-id', 'copy-ai-id-editor-host');
    Object.assign(nextHost.style, {
      position: 'fixed',
      inset: '0',
      width: '100vw',
      height: '100vh',
      zIndex: String(EDITOR_HOST_Z_INDEX),
      pointerEvents: 'auto',
    });

    document.documentElement.appendChild(nextHost);
    return nextHost;
  }

  function mount(): void {
    if (mountedEditor) {
      return;
    }

    host = ensureHost();
    mountedEditor = mountCopyAiIdEditor(host, {
      onRequestClose: options.onRequestClose,
    });
  }

  function unmount(): void {
    mountedEditor?.unmount();
    mountedEditor = null;
    host?.remove();
    host = null;
  }

  return {
    setEnabled(enabled: boolean) {
      if (enabled) {
        mount();
        return;
      }

      unmount();
    },
    destroy() {
      unmount();
    },
  };
}
