import { useMemo } from 'react';

import type { EditorTargetReference } from '../../shared/editor-messages';
import { useVisualSelectionStore } from '../stores/useVisualSelectionStore';

/**
 * First-match selected visual target: floating panel target, then resolved
 * snapshot, then quick-action toolbar target, then hover target. The nodeId
 * always comes from the same source as the target.
 */
export function useSelectedTargetReference(): EditorTargetReference | null {
  const panelTarget = useVisualSelectionStore((state) => state.panelTarget);
  const activeToolbarTarget = useVisualSelectionStore((state) => state.activeToolbarTarget);
  const hoverTarget = useVisualSelectionStore((state) => state.hoverTarget);
  const snapshot = useVisualSelectionStore((state) => state.snapshot);

  return useMemo<EditorTargetReference | null>(() => {
    if (panelTarget?.target) {
      return { target: panelTarget.target, nodeId: panelTarget.nodeId };
    }
    if (snapshot?.target) {
      return { target: snapshot.target, nodeId: snapshot.nodeId };
    }
    if (activeToolbarTarget?.target) {
      return { target: activeToolbarTarget.target, nodeId: activeToolbarTarget.nodeId };
    }
    if (hoverTarget?.target) {
      return { target: hoverTarget.target, nodeId: hoverTarget.nodeId };
    }
    return null;
  }, [activeToolbarTarget, hoverTarget, panelTarget, snapshot]);
}
