import { create } from 'zustand';

import type {
  BridgeConnectionStatus,
  IframeStatus,
} from '../../shared/protocol/editor-bridge-messages';

interface BridgeStore {
  status: BridgeConnectionStatus;
  iframeStatus: IframeStatus;
  iframeUrl: string;
  iframeError: string | null;
  aiIdCount: number;
  setLoading(url?: string): void;
  markReady(url: string, aiIdCount: number): void;
  setIframeStatus(status: IframeStatus, message?: string): void;
  reset(): void;
}

const initialState = {
  status: 'idle' as BridgeConnectionStatus,
  iframeStatus: 'loading' as IframeStatus,
  iframeUrl: '',
  iframeError: null,
  aiIdCount: 0,
};

export const useBridgeStore = create<BridgeStore>((set) => ({
  ...initialState,
  setLoading: (iframeUrl = '') => set({
    status: 'loading',
    iframeStatus: 'loading',
    iframeUrl,
    iframeError: null,
  }),
  markReady: (iframeUrl, aiIdCount) => set({
    status: 'ready',
    iframeStatus: 'ready',
    iframeUrl,
    aiIdCount,
    iframeError: null,
  }),
  setIframeStatus: (iframeStatus, message = undefined) => set({
    iframeStatus,
    status: iframeStatus === 'ready' ? 'ready' : iframeStatus === 'loading' ? 'loading' : 'error',
    iframeError: message ?? null,
  }),
  reset: () => set({ ...initialState }),
}));
