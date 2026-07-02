import type { BridgeToEditorMessage } from '../../shared/editor-messages';

export type BridgePost = (message: BridgeToEditorMessage) => void;
