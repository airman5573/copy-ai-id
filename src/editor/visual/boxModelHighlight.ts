import { type EditorTargetReference } from '../../shared/domain/targets';
import {
  type VisualBoxEdge,
  type VisualBoxRegion,
} from '../../shared/domain/visual';
import { EDITOR_MESSAGE_TYPES } from '../../shared/protocol/editor-bridge-messages';
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
