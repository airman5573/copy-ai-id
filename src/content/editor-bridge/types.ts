import type { BridgeToEditorMessage } from '../../shared/protocol/editor-bridge-messages';

export type BridgePost = (message: BridgeToEditorMessage) => void;
