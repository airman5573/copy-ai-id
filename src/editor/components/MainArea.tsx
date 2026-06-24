import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { NotePanel } from './NotePanel';
import { PreviewWorkspace } from './PreviewWorkspace';
import { LayoutTreePanel, LayoutTreePanelRail } from './tree/LayoutTreePanel';

export interface MainAreaProps {
  previewStageRef?: RefObject<HTMLDivElement | null>;
  onFitZoom?: () => void;
}

export function MainArea({ previewStageRef, onFitZoom }: MainAreaProps) {
  const [layoutTreeCollapsed, setLayoutTreeCollapsed] = useState(false);
  const previousLayoutTreeCollapsedRef = useRef(layoutTreeCollapsed);

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
