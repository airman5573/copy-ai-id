import type { HighlightVisualBoxRegionMessage } from '../../shared/protocol/editor-bridge-messages';
import { hideBoxModel, showBoxModelRegion } from './box-model';
import { resolveVisualTarget } from './visual-targets';

export function handleHighlightVisualBoxRegion(message: HighlightVisualBoxRegionMessage): void {
  const highlight = message.highlight;
  if (!highlight) {
    hideBoxModel('control');
    return;
  }

  const resolved = resolveVisualTarget({
    target: highlight.target,
    nodeId: highlight.nodeId,
    refreshLayoutTreeOnMiss: true,
  });

  if (!resolved.ok) {
    hideBoxModel('control');
    return;
  }

  showBoxModelRegion('control', resolved.element, {
    region: highlight.region,
    edge: highlight.edge,
  });
}
