import type {
  EditorTarget,
  EditorTargetReference,
  HighlightOrigin,
  LayoutTreeNode,
} from '../shared/domain/targets';
import type {
  BridgeConnectionStatus,
  IframeStatus,
} from '../shared/protocol/editor-bridge-messages';
import type { BreakpointId } from '../shared/breakpoints';
import type { NotebookSuffixSettings } from './notebook/suffix-settings';
import type { NotebookBreakpointScope } from './notebook/breakpoint-scope';
import type { ExportedChipTarget } from './notebook/lexical/chip-export';

export type RuntimeStatus = 'idle' | 'mounted' | 'error';

export type CopyStatus = 'idle' | 'copied' | 'empty' | 'failed';

export interface RuntimeStateSlice {
  mounted: boolean;
  status: RuntimeStatus;
  currentUrl: string;
  previewUrl: string;
  bootError: string | null;
}

export interface HighlightStateSlice {
  highlightedTarget: EditorTarget | null;
  highlightedNodeId: string | null;
  highlightOrigin: HighlightOrigin | null;
}

export interface LayoutTreeStateSlice {
  url: string;
  root: LayoutTreeNode | null;
  expandedNodeIds: Set<string>;
  loading: boolean;
  error: string | null;
}

export interface BreakpointStateSlice {
  activeBreakpointId: BreakpointId;
  zoomById: Record<BreakpointId, number>;
}

export interface NotebookStateSlice {
  draft: string;
  editorStateJson: string | null;
  activeChipTargets: ExportedChipTarget[];
  chipTargetMap: string;
  hasFallbackTargets: boolean;
  isNotebookEmpty: boolean;
  nextChipIndex: number;
  suffixSettings: NotebookSuffixSettings;
  lastBreakpointScopeClick: NotebookBreakpointScope | null;
  copyStatus: CopyStatus;
  focusedTarget: EditorTarget | null;
  insertTargetReference: ((reference: EditorTargetReference) => void) | null;
  allocateChipId(): string;
}

export interface BridgeStateSlice {
  status: BridgeConnectionStatus;
  iframeStatus: IframeStatus;
  iframeUrl: string;
  iframeError: string | null;
  aiIdCount: number;
}
