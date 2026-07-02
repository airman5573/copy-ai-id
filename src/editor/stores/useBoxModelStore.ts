import { create } from 'zustand';

import { EDITOR_MESSAGE_TYPES } from '../../shared/protocol/editor-bridge-messages';
import { postToBridge } from '../bridge/bridgeClient';

interface BoxModelStore {
  enabled: boolean;
  setEnabled(enabled: boolean): void;
}

export const useBoxModelStore = create<BoxModelStore>((set) => ({
  enabled: false,
  setEnabled: (enabled) => {
    set({ enabled });
    postToBridge({ type: EDITOR_MESSAGE_TYPES.setBoxModelMode, enabled });
    if (!enabled) {
      postToBridge({ type: EDITOR_MESSAGE_TYPES.highlightVisualBoxRegion, highlight: null });
    }
  },
}));
