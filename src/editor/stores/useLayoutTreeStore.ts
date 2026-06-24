import { create } from 'zustand';

import type { EditorTarget, LayoutTreeNode } from '../../shared/editor-messages';
import { isAiIdTarget, isFallbackTarget } from '../../shared/editor-targets';

interface LayoutTreeStore {
  url: string;
  root: LayoutTreeNode | null;
  expandedNodeIds: Set<string>;
  loading: boolean;
  error: string | null;
  setLoading(loading: boolean): void;
  setTree(root: LayoutTreeNode | null, url?: string): void;
  setError(error: string | null): void;
  toggleExpanded(nodeId: string): void;
  expandAncestors(nodeId: string): void;
  findNodeByTarget(target: EditorTarget): LayoutTreeNode | null;
  reset(): void;
}

const createInitialExpandedNodes = (): Set<string> => new Set(['0']);

const createAlwaysExpandedNodes = (root: LayoutTreeNode | null): Set<string> => {
  const expandedNodeIds = createInitialExpandedNodes();

  const visit = (node: LayoutTreeNode): void => {
    if (node.children.length > 0) {
      expandedNodeIds.add(node.nodeId);
    }

    for (const child of node.children) {
      visit(child);
    }
  };

  if (root) {
    visit(root);
  }

  return expandedNodeIds;
};

export const useLayoutTreeStore = create<LayoutTreeStore>((set, get) => ({
  url: '',
  root: null,
  expandedNodeIds: createInitialExpandedNodes(),
  loading: false,
  error: null,
  setLoading: (loading) => set({ loading }),
  setTree: (root, url = '') => set({
    root,
    url,
    expandedNodeIds: createAlwaysExpandedNodes(root),
    loading: false,
    error: null,
  }),
  setError: (error) => set({ error, loading: false }),
  toggleExpanded: (nodeId) => set((state) => {
    const next = new Set(state.expandedNodeIds);
    next.add(nodeId);
    return { expandedNodeIds: next };
  }),
  expandAncestors: (nodeId) => set((state) => {
    const next = new Set(state.expandedNodeIds);
    const parts = nodeId.split('/');
    // Open ancestors, not the target leaf itself.
    for (let index = 1; index < parts.length; index += 1) {
      next.add(parts.slice(0, index).join('/'));
    }
    return { expandedNodeIds: next };
  }),
  findNodeByTarget: (target) => {
    const root = get().root;
    return root ? findNodeByTarget(root, target) : null;
  },
  reset: () => set({
    url: '',
    root: null,
    expandedNodeIds: createInitialExpandedNodes(),
    loading: false,
    error: null,
  }),
}));

function findNodeByTarget(node: LayoutTreeNode, target: EditorTarget): LayoutTreeNode | null {
  if (isFallbackTarget(target)) {
    return node.nodeId === target.nodeId ? node : findChildNodeByTarget(node, target);
  }

  if (isAiIdTarget(target) && node.aiId === target.aiId && node.instanceIndex === target.instanceIndex) {
    return node;
  }

  return findChildNodeByTarget(node, target);
}

function findChildNodeByTarget(node: LayoutTreeNode, target: EditorTarget): LayoutTreeNode | null {
  for (const child of node.children) {
    const found = findNodeByTarget(child, target);
    if (found) {
      return found;
    }
  }

  return null;
}
