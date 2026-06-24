import { createRoot, type Root } from 'react-dom/client';

import { EDITOR_UI_ATTR } from '../shared/config';
import { getCurrentMessages } from '../shared/i18n';
import { App } from './App';
import { hashNotebookLogValue, logNotebookWebmate } from './debug/webmatelog';
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
  logNotebookWebmate('editor-mount-start', {
    diagnosticArea: 'shadow-focus-selection',
    hadExistingShadowRoot: Boolean(host.shadowRoot),
    locationScopeHash: hashNotebookLogValue(getLocationScopeForLog()),
  });

  const draftPersistence = createNotebookDraftSessionPersistence(window.location.href);
  const persistedDraftSession = draftPersistence.read();
  logNotebookWebmate('draft-persistence-read', {
    diagnosticArea: 'draft-sync-replay',
    hasPersistedSession: persistedDraftSession !== null,
    persistedDraftLength: persistedDraftSession?.draft.length ?? 0,
    persistedDraftHash: hashNotebookLogValue(persistedDraftSession?.draft),
    persistedHasEditorStateJson: Boolean(persistedDraftSession?.editorStateJson),
    persistedEditorStateJsonLength: persistedDraftSession?.editorStateJson?.length ?? 0,
    persistedNextChipIndex: persistedDraftSession?.nextChipIndex ?? null,
    locationScopeHash: hashNotebookLogValue(getLocationScopeForLog()),
  });
  if (persistedDraftSession !== null) {
    useNotebookStore.getState().hydrateDraftSession(persistedDraftSession);
  }
  const unsubscribeDraftPersistence = useNotebookStore.subscribe((state, previousState) => {
    if (
      state.draft !== previousState.draft
      || state.editorStateJson !== previousState.editorStateJson
      || state.nextChipIndex !== previousState.nextChipIndex
    ) {
      logNotebookWebmate('draft-persistence-write', {
        diagnosticArea: 'draft-sync-replay',
        draftChanged: state.draft !== previousState.draft,
        editorStateJsonChanged: state.editorStateJson !== previousState.editorStateJson,
        nextChipIndexChanged: state.nextChipIndex !== previousState.nextChipIndex,
        draftLength: state.draft.length,
        draftHash: hashNotebookLogValue(state.draft),
        previousDraftLength: previousState.draft.length,
        previousDraftHash: hashNotebookLogValue(previousState.draft),
        editorStateJsonLength: state.editorStateJson?.length ?? 0,
        nextChipIndex: state.nextChipIndex,
        locationScopeHash: hashNotebookLogValue(getLocationScopeForLog()),
      });
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

  const hadExistingShadowRoot = Boolean(host.shadowRoot);
  const shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
  const shadowSelectionBridge = installShadowSelectionBridge({ host, shadowRoot: shadow });
  shadow.replaceChildren();
  logNotebookWebmate('editor-shadow-root-prepared', {
    diagnosticArea: 'shadow-focus-selection',
    reusedExistingShadowRoot: hadExistingShadowRoot,
    locationScopeHash: hashNotebookLogValue(getLocationScopeForLog()),
  });

  const style = document.createElement('style');
  style.setAttribute('data-ai-id', 'copy-ai-id-editor-shadow-styles');
  style.textContent = editorCss;
  shadow.appendChild(style);

  const container = document.createElement('div');
  container.setAttribute(EDITOR_UI_ATTR, '');
  container.setAttribute('data-ai-id', 'copy-ai-id-editor-shadow-root-container');
  container.setAttribute('lang', messages.htmlLang);
  shadow.appendChild(container);
  logNotebookWebmate('editor-shadow-root-ready', {
    diagnosticArea: 'shadow-focus-selection',
    shadowChildCount: shadow.childNodes.length,
    locationScopeHash: hashNotebookLogValue(getLocationScopeForLog()),
  });

  const root: Root = createRoot(container);
  root.render(<App onRequestClose={options.onRequestClose} />);
  logNotebookWebmate('editor-react-root-rendered', {
    diagnosticArea: 'shadow-focus-selection',
    containerAiId: container.dataset.aiId,
    locationScopeHash: hashNotebookLogValue(getLocationScopeForLog()),
  });

  return {
    unmount() {
      logNotebookWebmate('editor-unmount-requested', {
        diagnosticArea: 'shadow-focus-selection',
        locationScopeHash: hashNotebookLogValue(getLocationScopeForLog()),
      });
      unsubscribeDraftPersistence();
      shadowSelectionBridge.dispose();
      root.unmount();
      shadow.replaceChildren();
    },
  };
}

function getLocationScopeForLog(): string | null {
  try {
    const url = new URL(window.location.href);
    return url.protocol === 'file:' ? 'file://' : `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}
