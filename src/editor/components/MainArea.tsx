import { useEffect, useRef, type RefObject } from 'react';

import { useEditorLayoutStore } from '../stores/useEditorLayoutStore';
import { PreviewWorkspace } from './PreviewWorkspace';

export interface MainAreaProps {
  previewStageRef?: RefObject<HTMLDivElement | null>;
  onFitZoom?: () => void;
}

export function MainArea({ previewStageRef, onFitZoom }: MainAreaProps) {
  // The persisted panel layout still drives the floating note panel width.
  const hydratePanelLayout = useEditorLayoutStore((state) => state.hydratePanelLayout);
  const initialViewportFitFrameRef = useRef<number | null>(null);

  useEffect(() => {
    let isActive = true;

    void hydratePanelLayout().then(() => {
      if (!isActive || !onFitZoom) {
        return;
      }

      initialViewportFitFrameRef.current = window.requestAnimationFrame(() => {
        initialViewportFitFrameRef.current = null;
        if (!isActive) {
          return;
        }

        onFitZoom();
      });
    });

    return () => {
      isActive = false;
      if (initialViewportFitFrameRef.current !== null) {
        window.cancelAnimationFrame(initialViewportFitFrameRef.current);
        initialViewportFitFrameRef.current = null;
      }
    };
  }, [hydratePanelLayout, onFitZoom]);

  return (
    <main
      className="copy-ai-id-editor-main"
      data-ai-id="copy-ai-id-editor-main"
    >
      <PreviewWorkspace stageRef={previewStageRef} />
    </main>
  );
}
