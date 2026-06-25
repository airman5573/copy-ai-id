import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { useEditorLayoutStore } from '../stores/useEditorLayoutStore';
import { NotePanel } from './NotePanel';
import { PreviewWorkspace } from './PreviewWorkspace';
import { LayoutTreePanel, LayoutTreePanelRail } from './tree/LayoutTreePanel';

export interface MainAreaProps {
  previewStageRef?: RefObject<HTMLDivElement | null>;
  onFitZoom?: () => void;
}

export function MainArea({ previewStageRef, onFitZoom }: MainAreaProps) {
  const layoutTreeCollapsed = useEditorLayoutStore((state) => state.layoutTreeCollapsed);
  const hydrateLayoutTreeCollapsed = useEditorLayoutStore((state) => state.hydrateLayoutTreeCollapsed);
  const setLayoutTreeCollapsed = useEditorLayoutStore((state) => state.setLayoutTreeCollapsed);
  const previousLayoutTreeCollapsedRef = useRef(layoutTreeCollapsed);

  useEffect(() => {
    void hydrateLayoutTreeCollapsed();
  }, [hydrateLayoutTreeCollapsed]);

  useLayoutEffect(() => {
    if (previousLayoutTreeCollapsedRef.current === layoutTreeCollapsed) {
      return;
    }

    previousLayoutTreeCollapsedRef.current = layoutTreeCollapsed;
    onFitZoom?.();
  }, [layoutTreeCollapsed, onFitZoom]);

  return (
    <main
      className={`copy-ai-id-editor-main${layoutTreeCollapsed ? ' copy-ai-id-editor-main--tree-hidden' : ''}`}
      data-ai-id="copy-ai-id-editor-main"
    >
      {layoutTreeCollapsed ? (
        <LayoutTreePanelRail onExpand={() => setLayoutTreeCollapsed(false)} />
      ) : (
        <LayoutTreePanel onCollapse={() => setLayoutTreeCollapsed(true)} />
      )}

      <PreviewWorkspace stageRef={previewStageRef} />
      <NotePanel />
    </main>
  );
}
