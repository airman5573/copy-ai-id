import { PanelLeft, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';

import { getCurrentMessages } from '../../../shared/i18n';
import { useBridgeStore } from '../../stores/useBridgeStore';
import { useHighlightStore } from '../../stores/useHighlightStore';
import { useLayoutTreeStore } from '../../stores/useLayoutTreeStore';
import { PanelChrome, ToolbarButton } from '../ui/builderChrome';
import { LayoutTreeNodeRow } from './LayoutTreeNodeRow';
import { buildVisibleTreeRowMap, buildVisibleTreeRows } from './treeKeyboardNavigation';

export interface LayoutTreePanelProps {
  onCollapse: () => void;
}

export interface LayoutTreePanelRailProps {
  onExpand: () => void;
}

export function LayoutTreePanel({ onCollapse }: LayoutTreePanelProps) {
  const treeRef = useRef<HTMLDivElement | null>(null);
  const messages = getCurrentMessages();
  const root = useLayoutTreeStore((state) => state.root);
  const expandedNodeIds = useLayoutTreeStore((state) => state.expandedNodeIds);
  const loading = useLayoutTreeStore((state) => state.loading);
  const error = useLayoutTreeStore((state) => state.error);
  const highlightedNodeId = useHighlightStore((state) => state.highlightedNodeId);
  const highlightOrigin = useHighlightStore((state) => state.highlightOrigin);
  const aiIdCount = useBridgeStore((state) => state.aiIdCount);
  const visibleRows = useMemo(() => buildVisibleTreeRows(root, expandedNodeIds), [expandedNodeIds, root]);
  const visibleRowMap = useMemo(() => buildVisibleTreeRowMap(visibleRows), [visibleRows]);

  useEffect(() => {
    if (highlightOrigin !== 'preview' || !highlightedNodeId) {
      return undefined;
    }

    const tree = treeRef.current;
    if (!tree) {
      return undefined;
    }

    const frameId = window.requestAnimationFrame(() => {
      scrollTreeRowIntoCenter(tree, highlightedNodeId);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [highlightOrigin, highlightedNodeId]);

  return (
    <PanelChrome side="left" dataAiId="copy-ai-id-editor-layout-tree-panel">
      <div className="copy-ai-id-editor-panel__header copy-ai-id-editor-panel__header--with-action">
        <div className="copy-ai-id-editor-panel__title">
          <PanelLeft size={16} aria-hidden="true" />
          <h2>{messages.editor.layoutTree}</h2>
          <span className="copy-ai-id-editor-panel__count">{aiIdCount}</span>
        </div>
        <div className="copy-ai-id-editor-panel__actions">
          <ToolbarButton
            data-ai-id="copy-ai-id-editor-layout-tree-collapse-button"
            onClick={onCollapse}
            title={messages.editor.layoutTreeCollapse}
            aria-label={messages.editor.layoutTreeCollapse}
            aria-expanded={true}
            aria-controls="copy-ai-id-editor-layout-tree"
          >
            <PanelLeftClose size={13} aria-hidden="true" />
          </ToolbarButton>
        </div>
      </div>

      <div
        id="copy-ai-id-editor-layout-tree"
        ref={treeRef}
        className="copy-ai-id-editor-tree"
        role="tree"
        data-ai-id="copy-ai-id-editor-layout-tree"
      >
        {error ? (
          <div className="copy-ai-id-editor-panel__empty" data-ai-id="copy-ai-id-editor-layout-tree-error">
            {error}
          </div>
        ) : root ? (
          <LayoutTreeNodeRow node={root} depth={0} visibleRowMap={visibleRowMap} />
        ) : (
          <div className="copy-ai-id-editor-panel__empty" data-ai-id="copy-ai-id-editor-layout-tree-placeholder">
            {loading ? messages.editor.iframeLoading : messages.editor.layoutTreePending}
          </div>
        )}
      </div>
    </PanelChrome>
  );
}

export function LayoutTreePanelRail({ onExpand }: LayoutTreePanelRailProps) {
  const messages = getCurrentMessages();

  return (
    <aside
      className="copy-ai-id-editor-layout-tree-rail"
      data-ai-id="copy-ai-id-editor-layout-tree-panel"
      aria-label={messages.editor.layoutTree}
    >
      <ToolbarButton
        className="copy-ai-id-editor-layout-tree-rail__button"
        data-ai-id="copy-ai-id-editor-layout-tree-expand-button"
        onClick={onExpand}
        title={messages.editor.layoutTreeExpand}
        aria-label={messages.editor.layoutTreeExpand}
        aria-expanded={false}
        aria-controls="copy-ai-id-editor-layout-tree"
      >
        <PanelLeftOpen size={15} aria-hidden="true" />
      </ToolbarButton>
    </aside>
  );
}

function scrollTreeRowIntoCenter(tree: HTMLElement, nodeId: string): void {
  const rows = tree.querySelectorAll<HTMLElement>('[data-copy-ai-id-tree-node-id]');

  for (const row of rows) {
    if (row.dataset.copyAiIdTreeNodeId === nodeId) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      return;
    }
  }
}
