import {
  EDITOR_MESSAGE_TYPES,
  type EditorTargetReference,
  type VisualBoxEdge,
  type VisualBoxRegion,
} from '../../shared/editor-messages';
import { postToBridge } from '../bridge/bridgeClient';

export function highlightVisualBoxRegion(
  reference: EditorTargetReference | null,
  region: VisualBoxRegion,
  edge?: VisualBoxEdge,
): void {
  if (!reference) {
    clearVisualBoxRegionHighlight();
    return;
  }

  postToBridge({
    type: EDITOR_MESSAGE_TYPES.highlightVisualBoxRegion,
    highlight: {
      target: reference.target,
      nodeId: reference.nodeId,
      region,
      edge,
    },
  });
}

export function clearVisualBoxRegionHighlight(): void {
  postToBridge({
    type: EDITOR_MESSAGE_TYPES.highlightVisualBoxRegion,
    highlight: null,
  });
}
