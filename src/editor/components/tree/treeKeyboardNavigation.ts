import type { LayoutTreeNode } from '../../../shared/domain/targets';

export interface VisibleTreeRow {
  node: LayoutTreeNode;
  parentNodeId: string | null;
  previousNodeId: string | null;
  nextNodeId: string | null;
  previousSiblingNodeId: string | null;
  nextSiblingNodeId: string | null;
  firstChildNodeId: string | null;
  lastChildNodeId: string | null;
}

export function buildVisibleTreeRows(
  root: LayoutTreeNode | null,
  expandedNodeIds: ReadonlySet<string>,
): VisibleTreeRow[] {
  if (!root) {
    return [];
  }

  const rows: Array<Omit<VisibleTreeRow, 'previousNodeId' | 'nextNodeId'>> = [];

  const visit = (
    node: LayoutTreeNode,
    parentNodeId: string | null,
    previousSiblingNodeId: string | null = null,
    nextSiblingNodeId: string | null = null,
  ): void => {
    const firstChildNodeId = node.children[0]?.nodeId ?? null;
    const lastChildNodeId = node.children[node.children.length - 1]?.nodeId ?? null;
    rows.push({
      node,
      parentNodeId,
      previousSiblingNodeId,
      nextSiblingNodeId,
      firstChildNodeId,
      lastChildNodeId,
    });

    if (!expandedNodeIds.has(node.nodeId)) {
      return;
    }

    for (const [index, child] of node.children.entries()) {
      visit(
        child,
        node.nodeId,
        node.children[index - 1]?.nodeId ?? null,
        node.children[index + 1]?.nodeId ?? null,
      );
    }
  };

  visit(root, null);

  return rows.map((row, index) => ({
    ...row,
    previousNodeId: rows[index - 1]?.node.nodeId ?? null,
    nextNodeId: rows[index + 1]?.node.nodeId ?? null,
  }));
}

export function buildVisibleTreeRowMap(rows: readonly VisibleTreeRow[]): ReadonlyMap<string, VisibleTreeRow> {
  return new Map(rows.map((row) => [row.node.nodeId, row]));
}

export function resolveTreeKeyboardTargetNodeId(
  currentNodeId: string,
  key: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight',
  rowMap: ReadonlyMap<string, VisibleTreeRow>,
): string | null {
  const row = rowMap.get(currentNodeId);
  if (!row) {
    return null;
  }

  switch (key) {
    case 'ArrowUp':
      return row.parentNodeId;
    case 'ArrowDown':
      return row.firstChildNodeId
        ?? row.nextSiblingNodeId
        ?? findParentSiblingChildOrSelfNodeId(row, 'next', 'first', rowMap);
    case 'ArrowRight':
      return row.nextSiblingNodeId
        ?? findParentSiblingChildOrSelfNodeId(row, 'next', 'first', rowMap);
    case 'ArrowLeft':
      return row.previousSiblingNodeId
        ?? findParentSiblingChildOrSelfNodeId(row, 'previous', 'last', rowMap);
  }
}

function findParentSiblingChildOrSelfNodeId(
  row: VisibleTreeRow,
  direction: 'previous' | 'next',
  child: 'first' | 'last',
  rowMap: ReadonlyMap<string, VisibleTreeRow>,
): string | null {
  const parent = row.parentNodeId ? rowMap.get(row.parentNodeId) : undefined;
  if (!parent) {
    return null;
  }

  const siblingNodeId = direction === 'previous'
    ? parent.previousSiblingNodeId
    : parent.nextSiblingNodeId;
  if (!siblingNodeId) {
    return null;
  }

  const sibling = rowMap.get(siblingNodeId);
  if (child === 'first') {
    return sibling?.firstChildNodeId ?? siblingNodeId;
  }

  return sibling?.lastChildNodeId ?? siblingNodeId;
}
