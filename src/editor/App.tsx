import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

import { createPreviewUrl } from './bridge/bridgeClient';
import { FloatingNotePanel } from './components/FloatingNotePanel';
import { MainArea } from './components/MainArea';
import { FloatingVisualPanel } from './components/visual-panel/FloatingVisualPanel';
import { TopToolbar } from './components/TopToolbar';
import { installEditorKeyboard } from './keyboard';
import { installKeyboardNavigationHoverGuard } from './keyboard-hover-guard';
import { installVisualEditorFocusGuard } from './visual-focus-guard';
import { readNotebookTargetNotice } from './notebook/notebook-notice';
import { clearEditorToastReset } from './toast';
import { useBreakpointStore } from './stores/useBreakpointStore';
import { useRuntimeStore } from './stores/useRuntimeStore';
import { useNotebookStore } from './stores/useNotebookStore';
import { useToastStore } from './stores/useToastStore';
import { useFloatingNotePanelStore } from './stores/useFloatingNotePanelStore';

export interface AppProps {
  onRequestClose?: () => void;
}

export function App({ onRequestClose }: AppProps) {
  const previewStageRef = useRef<HTMLDivElement | null>(null);
  const setMounted = useRuntimeStore((state) => state.setMounted);
  const setCurrentUrl = useRuntimeStore((state) => state.setCurrentUrl);
  const setPreviewUrl = useRuntimeStore((state) => state.setPreviewUrl);
  const fitZoom = useBreakpointStore((state) => state.fitZoom);
  const hydratePreviewHeight = useBreakpointStore((state) => state.hydratePreviewHeight);
  const toastMessage = useToastStore((state) => state.message);
  const toastTone = useToastStore((state) => state.tone);
  const clearToast = useToastStore((state) => state.clearToast);
  const setSuffixSettings = useNotebookStore((state) => state.setSuffixSettings);
  const hydrateFloatingNotePanelEnabled = useFloatingNotePanelStore((state) => state.hydrateEnabled);
  const resetFloatingNotePanelRuntime = useFloatingNotePanelStore((state) => state.resetFloatingNotePanelRuntime);

  useEffect(() => {
    const url = window.location.href;
    setMounted(true);
    setCurrentUrl(url);
    setPreviewUrl(createPreviewUrl(url));
    let isActive = true;
    let hydrateFrameId: number | null = null;
    void hydrateFloatingNotePanelEnabled();
    void hydratePreviewHeight().then(() => {
      if (!isActive) {
        return;
      }

      hydrateFrameId = window.requestAnimationFrame(() => {
        if (!isActive) {
          return;
        }

        fitZoom(previewStageRef.current?.clientWidth, previewStageRef.current?.clientHeight);
      });
    });
    void readNotebookTargetNotice().then((targetNotice) => {
      if (!isActive) {
        return;
      }

      const suffixSettings = useNotebookStore.getState().suffixSettings;
      setSuffixSettings({
        ...suffixSettings,
        targetNotice,
      });
    });

    const cleanupKeyboard = installEditorKeyboard();
    const cleanupKeyboardHoverGuard = installKeyboardNavigationHoverGuard();
    const cleanupVisualEditorFocusGuard = installVisualEditorFocusGuard();

    return () => {
      isActive = false;
      if (hydrateFrameId !== null) {
        window.cancelAnimationFrame(hydrateFrameId);
      }
      cleanupKeyboard();
      cleanupKeyboardHoverGuard();
      cleanupVisualEditorFocusGuard();
      clearEditorToastReset();
      clearToast();
      resetFloatingNotePanelRuntime();
      setMounted(false);
    };
  }, [
    clearToast,
    fitZoom,
    hydrateFloatingNotePanelEnabled,
    hydratePreviewHeight,
    resetFloatingNotePanelRuntime,
    setCurrentUrl,
    setMounted,
    setPreviewUrl,
    setSuffixSettings,
  ]);

  useLayoutEffect(() => {
    const fitToCurrentStage = (): void => {
      fitZoom(previewStageRef.current?.clientWidth, previewStageRef.current?.clientHeight);
    };

    fitToCurrentStage();

    const frameId = window.requestAnimationFrame(fitToCurrentStage);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [fitZoom]);

  const handleFitZoom = useCallback(() => {
    fitZoom(previewStageRef.current?.clientWidth, previewStageRef.current?.clientHeight);
  }, [fitZoom]);

  return (
    <div className="copy-ai-id-editor-shell" data-ai-id="copy-ai-id-editor-shell">
      <TopToolbar
        onRequestClose={onRequestClose}
        onFitZoom={handleFitZoom}
      />
      <MainArea previewStageRef={previewStageRef} onFitZoom={handleFitZoom} />
      <FloatingNotePanel />
      <FloatingVisualPanel />
      {toastMessage ? (
        <div
          className={`copy-ai-id-editor-toast copy-ai-id-editor-toast--${toastTone}`}
          data-ai-id="copy-ai-id-editor-toast"
          role="status"
          aria-live="polite"
        >
          {toastMessage}
        </div>
      ) : null}
    </div>
  );
}
