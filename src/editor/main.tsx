import { createRoot, type Root } from 'react-dom/client';

import { EDITOR_UI_ATTR } from '../shared/config';
import { getCurrentMessages } from '../shared/i18n';
import { App } from './App';
import editorCss from './editor.css?inline';
import { setEditorShadowRoot } from './editor-shadow-root';
import { installShadowSelectionBridge } from './shadow-selection-bridge';

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
  const messages = getCurrentMessages();

  host.setAttribute('role', 'dialog');
  host.setAttribute('aria-modal', 'true');
  host.setAttribute('aria-label', `${messages.editor.title} ${messages.editor.subtitle}`);
  host.setAttribute('lang', messages.htmlLang);

  const shadow = host.attachShadow({ mode: 'closed' });
  setEditorShadowRoot(shadow);
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
      shadowSelectionBridge.dispose();
      root.unmount();
      shadow.replaceChildren();
      setEditorShadowRoot(null);
    },
  };
}
