import {
  $applyNodeReplacement,
  type DOMExportOutput,
  type EditorConfig,
  type LexicalNode,
  type NodeKey,
  type SerializedTextNode,
  type Spread,
  TextNode,
} from 'lexical';

import type { EditorTarget } from '../../../shared/editor-messages';

export interface ChipNodePayload {
  chipId: string;
  target: EditorTarget;
  nodeId: string | null;
}

export type SerializedChipNode = Spread<
  ChipNodePayload,
  SerializedTextNode
>;

const CHIP_NODE_TYPE = 'copy-ai-id-chip';
const CHIP_NODE_CLASS_NAME = 'copy-ai-id-editor-note-chip';
const CHIP_NODE_AI_ID = 'copy-ai-id-editor-note-chip';

export class ChipNode extends TextNode {
  __chipId: string;
  __target: EditorTarget;
  __nodeId: string | null;

  static getType(): string {
    return CHIP_NODE_TYPE;
  }

  static clone(node: ChipNode): ChipNode {
    return new ChipNode(node.__chipId, node.__target, node.__nodeId, node.__text, node.__key);
  }

  static importJSON(serializedNode: SerializedChipNode): ChipNode {
    return $createChipNode({
      chipId: serializedNode.chipId,
      target: serializedNode.target,
      nodeId: serializedNode.nodeId,
    }).updateFromJSON(serializedNode);
  }

  constructor(
    chipId: string,
    target: EditorTarget,
    nodeId: string | null,
    text?: string,
    key?: NodeKey,
  ) {
    super(text ?? chipId, key);
    this.__chipId = chipId;
    this.__target = target;
    this.__nodeId = nodeId;
  }

  exportJSON(): SerializedChipNode {
    return {
      ...super.exportJSON(),
      chipId: this.__chipId,
      target: this.__target,
      nodeId: this.__nodeId,
    };
  }

  createDOM(config: EditorConfig): HTMLElement {
    const dom = super.createDOM(config);
    applyChipDomAttributes(dom, this);
    return dom;
  }

  updateDOM(prevNode: this, dom: HTMLElement, config: EditorConfig): boolean {
    const replace = super.updateDOM(prevNode, dom, config);
    if (!replace) {
      applyChipDomAttributes(dom, this);
    }
    return replace;
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('span');
    applyChipDomAttributes(element, this);
    element.textContent = this.getTextContent();
    return { element };
  }

  getChipId(): string {
    return this.getLatest().__chipId;
  }

  getTarget(): EditorTarget {
    return this.getLatest().__target;
  }

  getNodeId(): string | null {
    return this.getLatest().__nodeId;
  }

  isTextEntity(): true {
    return true;
  }

  canInsertTextBefore(): boolean {
    return false;
  }

  canInsertTextAfter(): boolean {
    return false;
  }
}

export function $createChipNode(payload: ChipNodePayload): ChipNode {
  const chipNode = new ChipNode(payload.chipId, payload.target, payload.nodeId)
    .setMode('token')
    .toggleDirectionless();

  return $applyNodeReplacement(chipNode);
}

export function $isChipNode(node: LexicalNode | null | undefined): node is ChipNode {
  return node instanceof ChipNode;
}

function applyChipDomAttributes(element: HTMLElement, node: ChipNode): void {
  const chipId = node.getChipId();
  const target = node.getTarget();
  const nodeId = node.getNodeId();

  element.classList.add(CHIP_NODE_CLASS_NAME);
  element.dataset.aiId = CHIP_NODE_AI_ID;
  element.dataset.copyAiIdChipId = chipId;
  element.dataset.copyAiIdChipTargetKind = target.kind;
  element.spellcheck = false;
  element.textContent = chipId;

  if (nodeId) {
    element.dataset.copyAiIdChipNodeId = nodeId;
  } else {
    delete element.dataset.copyAiIdChipNodeId;
  }
}
