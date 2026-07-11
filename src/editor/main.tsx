import { createRoot, type Root } from 'react-dom/client';

import { EDITOR_UI_ATTR } from '../shared/config';
import { getCurrentMessages } from '../shared/i18n';
import { App } from './App';
import editorCss from './editor.css?inline';
import { createNotebookDraftSessionPersistence } from './notebook/session-draft';
import { installShadowSelectionBridge } from './shadow-selection-bridge';
import { useNotebookStore } from './stores/useNotebookStore';

export interface CopyAiIdEditorMountOptions {
  onRequestClose?: () => void;
}

export interface MountedCopyAiIdEditor {
  unmount(): void;
}

export function mountCopyAiIdEditor(
  host: HTMLElement,
  options: CopyAiIdEditorMountOptions = {},
): MountedCopyAiIdEditor {
  const draftPersistence = createNotebookDraftSessionPersistence(window.location.href);
  const persistedDraftSession = draftPersistence.read();
  if (persistedDraftSession !== null) {
    useNotebookStore.getState().hydrateDraftSession(persistedDraftSession);
  }
  const unsubscribeDraftPersistence = useNotebookStore.subscribe((state, previousState) => {
    if (
      state.draft !== previousState.draft
      || state.editorStateJson !== previousState.editorStateJson
      || state.nextChipIndex !== previousState.nextChipIndex
    ) {
      draftPersistence.write({
        draft: state.draft,
        editorStateJson: state.editorStateJson,
        nextChipIndex: state.nextChipIndex,
      });
    }
  });
  const messages = getCurrentMessages();

  host.setAttribute('role', 'dialog');
  host.setAttribute('aria-modal', 'true');
  host.setAttribute('aria-label', `${messages.editor.title} ${messages.editor.subtitle}`);
  host.setAttribute('lang', messages.htmlLang);

  const shadow = host.attachShadow({ mode: 'closed' });
  const shadowSelectionBridge = installShadowSelectionBridge({ host, shadowRoot: shadow });
  shadow.replaceChildren();

  const style = document.createElement('style');
  style.setAttribute('data-ai-id', 'copy-ai-id-editor-shadow-styles');
  style.textContent = editorCss;
  shadow.appendChild(style);

  const container = document.createElement('div');
  container.setAttribute(EDITOR_UI_ATTR, '');
  container.setAttribute('data-ai-id', 'copy-ai-id-editor-shadow-root-container');
  container.setAttribute('lang', messages.htmlLang);
  shadow.appendChild(container);

  const root: Root = createRoot(container);
  root.render(<App onRequestClose={options.onRequestClose} />);

  return {
    unmount() {
      unsubscribeDraftPersistence();
      shadowSelectionBridge.dispose();
      root.unmount();
      shadow.replaceChildren();
    },
  };
}
