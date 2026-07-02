import { useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { ChevronRight, EyeOff, TriangleAlert } from 'lucide-react';

import {
  type EditorTarget,
  type LayoutTreeNode,
} from '../../../shared/domain/targets';
import { EDITOR_MESSAGE_TYPES } from '../../../shared/protocol/editor-bridge-messages';
import { hasSameEditorTarget } from '../../../shared/editor-targets';
import { getCurrentMessages } from '../../../shared/i18n';
import { postToBridge, requestBridgeQuickActionSelectionClear } from '../../bridge/bridgeClient';
import { isKeyboardNavigationHoverSuppressed, suppressHoverUntilMouseMove } from '../../keyboard-hover-guard';
import { isNoteEditorHoverProtected } from '../../note-hover-guard';
import { appendTargetReferenceToNotebook } from '../../shortcut-actions';
import { useHighlightStore } from '../../stores/useHighlightStore';
import { showMissingDataAiIdToast } from '../../toast';
import {
  resolveTreeKeyboardTargetNodeId,
  type VisibleTreeRow,
} from './treeKeyboardNavigation';

export interface LayoutTreeNodeRowProps {
  node: LayoutTreeNode;
  depth: number;
  visibleRowMap: ReadonlyMap<string, VisibleTreeRow>;
}

export function LayoutTreeNodeRow({ node, depth, visibleRowMap }: LayoutTreeNodeRowProps) {
  const rowRef = useRef<HTMLDivElement | null>(null);
  const messages = getCurrentMessages();
  const highlightedTarget = useHighlightStore((state) => state.highlightedTarget);
  const highlightedNodeId = useHighlightStore((state) => state.highlightedNodeId);
  const setHighlightedTarget = useHighlightStore((state) => state.setHighlightedTarget);
  const hasChildren = node.children.length > 0;
  const expanded = hasChildren;
  const target = targetForNode(node);
  const isHighlighted = highlightedNodeId === node.nodeId
    || hasSameEditorTarget(highlightedTarget, target);
  const isDuplicate = Boolean(node.aiId && node.duplicateCount > 1);
  const rowTargetClass = node.aiId
    ? 'has-ai-id'
    : node.fallback
      ? 'has-fallback-target'
      : 'is-wrapper';

  const highlightTreeNode = (treeNode: LayoutTreeNode): void => {
    setHighlightedTarget(targetForNode(treeNode), treeNode.nodeId);
    postToBridge({ type: EDITOR_MESSAGE_TYPES.hoverTreeNode, nodeId: treeNode.nodeId });
  };

  const isHoverSuppressed = (): boolean => {
    return isNoteEditorHoverProtected() || isKeyboardNavigationHoverSuppressed();
  };

  const handleRowHover = (): void => {
    if (isHoverSuppressed() || isHighlighted) {
      return;
    }

    highlightTreeNode(node);
  };

  const handleRowClick = (): void => {
    highlightTreeNode(node);

    if (target) {
      appendTargetReferenceToNotebook({
        target,
        nodeId: node.nodeId,
      });
      return;
    }

    postToBridge({ type: EDITOR_MESSAGE_TYPES.revealTreeNode, nodeId: node.nodeId });
  };

  const focusTreeRow = (nodeId: string | null): void => {
    if (!nodeId) {
      return;
    }

    const tree = rowRef.current?.closest('[data-ai-id="copy-ai-id-editor-layout-tree"]');
    const rows = tree?.querySelectorAll<HTMLElement>('[data-copy-ai-id-tree-node-id]') ?? [];
    for (const row of rows) {
      if (row.dataset.copyAiIdTreeNodeId === nodeId) {
        row.focus();
        row.scrollIntoView({ block: 'nearest' });
        return;
      }
    }
  };

  const handleRowKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      handleRowClick();
      return;
    }

    if (event.code === 'Space') {
      event.preventDefault();
      event.stopPropagation();
      highlightTreeNode(node);
      if (target) {
        appendTargetReferenceToNotebook({
          target,
          nodeId: node.nodeId,
        }, {
          onFloatingNotePanelOpen: requestBridgeQuickActionSelectionClear,
        });
      } else {
        showMissingDataAiIdToast();
      }
      return;
    }

    switch (event.key) {
      case 'ArrowUp':
      case 'ArrowDown':
      case 'ArrowLeft':
      case 'ArrowRight':
        event.preventDefault();
        event.stopPropagation();
        {
          const targetNodeId = resolveTreeKeyboardTargetNodeId(node.nodeId, event.key, visibleRowMap);
          if (targetNodeId) {
            suppressHoverUntilMouseMove();
          }

          focusTreeRow(targetNodeId);
        }
        return;
      default:
        return;
    }
  };

  return (
    <>
      <div
        ref={rowRef}
        className={`copy-ai-id-editor-tree-row ${isHighlighted ? 'is-highlighted' : ''} ${rowTargetClass}`}
        data-ai-id="copy-ai-id-editor-layout-tree-node-row"
        data-copy-ai-id-tree-node-id={node.nodeId}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        role="treeitem"
        tabIndex={depth === 0 ? 0 : -1}
        aria-current={isHighlighted ? 'true' : undefined}
        aria-expanded={hasChildren ? expanded : undefined}
        onFocus={() => {
          highlightTreeNode(node);
        }}
        onMouseEnter={handleRowHover}
        onMouseMove={handleRowHover}
        onMouseLeave={() => {
          if (isHoverSuppressed()) {
            return;
          }

          setHighlightedTarget(null, null);
          postToBridge({ type: EDITOR_MESSAGE_TYPES.hoverTreeNode, nodeId: null });
        }}
        onClick={(event) => {
          event.currentTarget.focus();
          handleRowClick();
        }}
        onKeyDown={handleRowKeyDown}
      >
        <span
          className="copy-ai-id-editor-tree-row__twisty"
          aria-hidden="true"
        >
          {hasChildren ? (
            <ChevronRight className={expanded ? 'is-expanded' : ''} size={13} aria-hidden="true" />
          ) : (
            <span />
          )}
        </span>

        <span className="copy-ai-id-editor-tree-row__tag">{node.tagName}</span>
        {node.aiId ? (
          <span className="copy-ai-id-editor-tree-row__ai-id" title={node.aiId}>
            [{node.aiId}]
          </span>
        ) : node.fallback ? (
          <span className="copy-ai-id-editor-tree-row__wrapper" title={fallbackTitleForNode(node)}>
            {messages.editor.fallbackTarget}
          </span>
        ) : (
          <span className="copy-ai-id-editor-tree-row__wrapper">wrapper</span>
        )}
        {isDuplicate ? (
          <span
            className="copy-ai-id-editor-tree-row__duplicate"
            title={`${messages.editor.duplicateWarning}: ${node.instanceIndex + 1}/${node.duplicateCount}`}
          >
            <TriangleAlert size={12} aria-hidden="true" />
            {node.instanceIndex + 1}/{node.duplicateCount}
          </span>
        ) : null}
        {!node.isVisible ? <EyeOff className="copy-ai-id-editor-tree-row__hidden" size={12} aria-label="Hidden" /> : null}
        {node.textPreview ? <span className="copy-ai-id-editor-tree-row__text">{node.textPreview}</span> : null}
      </div>

      {hasChildren
        ? node.children.map((child) => (
            <LayoutTreeNodeRow key={child.nodeId} node={child} depth={depth + 1} visibleRowMap={visibleRowMap} />
          ))
        : null}
    </>
  );
}

function targetForNode(node: LayoutTreeNode): EditorTarget | null {
  return node.aiId
    ? {
        kind: 'ai-id',
        aiId: node.aiId,
        instanceIndex: node.instanceIndex,
      }
    : node.fallback
      ? {
          kind: 'fallback',
          nodeId: node.nodeId,
          ...node.fallback,
        }
      : null;
}

function fallbackTitleForNode(node: LayoutTreeNode): string | undefined {
  if (!node.fallback) {
    return undefined;
  }

  return [
    node.fallback.label,
    node.fallback.selectorKind,
    node.fallback.selector,
  ].filter(Boolean).join(' · ');
}
