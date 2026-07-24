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
  let pageScrollSnapshot: {
    body: HTMLElement | null;
    bodyOverflow: string;
    bodyOverflowPriority: string;
    rootOverflow: string;
    rootOverflowPriority: string;
  } | null = null;

  function lockPageScroll(): void {
    if (pageScrollSnapshot) {
      return;
    }

    const rootStyle = document.documentElement.style;
    const body = document.body;
    const bodyStyle = body?.style;

    pageScrollSnapshot = {
      body,
      bodyOverflow: bodyStyle?.getPropertyValue('overflow') ?? '',
      bodyOverflowPriority: bodyStyle?.getPropertyPriority('overflow') ?? '',
      rootOverflow: rootStyle.getPropertyValue('overflow'),
      rootOverflowPriority: rootStyle.getPropertyPriority('overflow'),
    };

    rootStyle.setProperty('overflow', 'hidden', 'important');
    bodyStyle?.setProperty('overflow', 'hidden', 'important');
  }

  function restorePageScroll(): void {
    if (!pageScrollSnapshot) {
      return;
    }

    const {
      body,
      bodyOverflow,
      bodyOverflowPriority,
      rootOverflow,
      rootOverflowPriority,
    } = pageScrollSnapshot;

    if (rootOverflow) {
      document.documentElement.style.setProperty('overflow', rootOverflow, rootOverflowPriority);
    } else {
      document.documentElement.style.removeProperty('overflow');
    }

    if (body) {
      if (bodyOverflow) {
        body.style.setProperty('overflow', bodyOverflow, bodyOverflowPriority);
      } else {
        body.style.removeProperty('overflow');
      }
    }

    pageScrollSnapshot = null;
  }

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

    lockPageScroll();

    try {
      host = ensureHost();
      mountedEditor = mountCopyAiIdEditor(host, {
        onRequestClose: options.onRequestClose,
      });
    } catch (error) {
      host?.remove();
      host = null;
      restorePageScroll();
      throw error;
    }
  }

  function unmount(): void {
    mountedEditor?.unmount();
    mountedEditor = null;
    host?.remove();
    host = null;
    restorePageScroll();
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
