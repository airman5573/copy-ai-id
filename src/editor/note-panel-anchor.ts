import type {
  BridgeViewportRect,
  BridgeViewportSize,
  EditorTarget,
  EditorTargetReference,
} from '../shared/editor-messages';
import { hasSameEditorTarget } from '../shared/editor-targets';
import {
  bridgeViewportRectToEditorViewportRect,
  createEditorViewportRect,
  getPreviewWorkspaceGeometrySnapshot,
  type EditorViewportRect,
} from './bridge/geometry';
import type { FloatingNotePanelAnchorInput } from './stores/useFloatingNotePanelStore';
import { useVisualBridgeStore } from './stores/useVisualBridgeStore';
import { useVisualSelectionStore } from './stores/useVisualSelectionStore';

export interface NotePanelAnchorGeometryInput {
  elementRect?: BridgeViewportRect | null;
  editorRect?: EditorViewportRect | null;
  viewport?: BridgeViewportSize | null;
}

interface CandidateAnchorGeometry extends NotePanelAnchorGeometryInput {
  target: EditorTarget | null;
  nodeId: string | null;
}

export function captureNotePanelAnchor(
  reference: EditorTargetReference,
  explicitGeometry: NotePanelAnchorGeometryInput = {},
): FloatingNotePanelAnchorInput {
  const explicitAnchor = anchorFromGeometry(reference, explicitGeometry);
  if (explicitAnchor) {
    return explicitAnchor;
  }

  const visualSelection = useVisualSelectionStore.getState();
  const activeToolbarAnchor = anchorFromCandidate(reference, visualSelection.activeToolbarTarget);
  if (activeToolbarAnchor) {
    return activeToolbarAnchor;
  }

  const hoverAnchor = anchorFromCandidate(reference, visualSelection.hoverTarget);
  if (hoverAnchor) {
    return hoverAnchor;
  }

  const visualBridge = useVisualBridgeStore.getState();
  const quickActionAnchor = anchorFromCandidate(reference, {
    target: visualBridge.quickActionAnchor?.target ?? null,
    nodeId: visualBridge.quickActionAnchor?.nodeId ?? null,
    elementRect: visualBridge.quickActionAnchor?.elementRect ?? null,
    editorRect: visualBridge.quickActionAnchorEditorRect,
    viewport: visualBridge.quickActionAnchor?.viewport ?? null,
  });
  if (quickActionAnchor) {
    return quickActionAnchor;
  }

  return {
    target: reference.target,
    nodeId: reference.nodeId,
    elementRect: null,
    editorRect: fallbackEditorRect(),
    viewport: null,
  };
}

function anchorFromCandidate(
  reference: EditorTargetReference,
  candidate: CandidateAnchorGeometry | null,
): FloatingNotePanelAnchorInput | null {
  if (!candidate || !matchesReference(reference, candidate.target, candidate.nodeId)) {
    return null;
  }

  return anchorFromGeometry({
    target: reference.target,
    nodeId: reference.nodeId ?? candidate.nodeId,
  }, candidate);
}

function anchorFromGeometry(
  reference: EditorTargetReference,
  geometry: NotePanelAnchorGeometryInput,
): FloatingNotePanelAnchorInput | null {
  const elementRect = geometry.elementRect ?? null;
  const editorRect = geometry.editorRect ?? (elementRect ? bridgeViewportRectToEditorViewportRect(elementRect) : null);
  if (!elementRect && !editorRect) {
    return null;
  }

  return {
    target: reference.target,
    nodeId: reference.nodeId,
    elementRect,
    editorRect,
    viewport: geometry.viewport ?? null,
  };
}

function matchesReference(
  reference: EditorTargetReference,
  target: EditorTarget | null,
  nodeId: string | null,
): boolean {
  if (!hasSameEditorTarget(reference.target, target)) {
    return false;
  }

  if (reference.nodeId && nodeId && reference.nodeId !== nodeId) {
    return false;
  }

  return true;
}

function fallbackEditorRect(): EditorViewportRect {
  const geometry = getPreviewWorkspaceGeometrySnapshot();
  if (geometry?.iframeRect) {
    return geometry.iframeRect;
  }

  return createEditorViewportRect({
    left: 0,
    top: 0,
    width: typeof window === 'undefined' ? 0 : Math.max(1, window.innerWidth || 1),
    height: 0,
  });
}
