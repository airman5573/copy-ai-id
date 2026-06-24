import {
  createWebmateLogRelayMessage,
  type WebmateLogRelayResponse,
} from '../../shared/webmatelog-relay';

export type WebmateLogLevel = 'debug' | 'info' | 'warn' | 'error' | string;

interface WebmateLogInput {
  namespace: string;
  scenario: string;
  level?: WebmateLogLevel;
  message: string;
  context?: unknown;
  request_id?: string | null;
  timestamp?: string;
  endpoint?: string;
}

interface WebmateLogOptions {
  endpoint?: string;
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  fetchImpl?: typeof fetch;
}

export interface NotebookSelectionSnapshot {
  activeElement: ElementSummary | null;
  shadowActiveElement: ElementSummary | null;
  documentSelection: SelectionSummary | null;
  shadowSelection: SelectionSummary | null;
}

const DEFAULT_WEBMATELOG_ENDPOINT = 'http://127.0.0.1:8765/api/logs';
const WEBMATELOG_NAMESPACE = 'copy-ai-id.notebook';
const WEBMATELOG_SCENARIO = 'lexical-shadow-input';
const WEBMATELOG_ENABLE_KEY = 'copy-ai-id:webmatelog';
const WEBMATELOG_ENDPOINT_KEY = 'copy-ai-id:webmatelog-endpoint';
const WEBMATELOG_REQUEST_ID_KEY = 'copy-ai-id:webmatelog-request-id';
const WEBMATELOG_QUERY_ENABLE = 'copyaiidWebmateLog';
const WEBMATELOG_QUERY_ENDPOINT = 'copyaiidWebmateLogEndpoint';

let cachedEnabled: boolean | null = null;
let cachedRequestId: string | null = null;

export function logNotebookDomEvent(
  rootElement: HTMLElement,
  eventName: string,
  event: Event,
  extraContext: Record<string, unknown> = {},
): void {
  if (!isNotebookWebmateLogEnabled()) {
    return;
  }

  logNotebookWebmate('dom-event', {
    eventName,
    event: summarizeEvent(event),
    selection: getNotebookSelectionSnapshot(rootElement),
    ...extraContext,
  });
}

export function logNotebookWebmate(
  message: string,
  context: Record<string, unknown> = {},
  level: WebmateLogLevel = 'debug',
): void {
  if (!isNotebookWebmateLogEnabled()) {
    return;
  }

  webmatelog({
    namespace: WEBMATELOG_NAMESPACE,
    scenario: WEBMATELOG_SCENARIO,
    level,
    message,
    context,
    request_id: getNotebookWebmateRequestId(),
    endpoint: getNotebookWebmateEndpoint(),
  }, {
    retries: 0,
    timeoutMs: 800,
  });
}

export function hashNotebookLogValue(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function getNotebookSelectionSnapshot(rootElement: HTMLElement): NotebookSelectionSnapshot {
  const ownerDocument = rootElement.ownerDocument;
  const rootNode = rootElement.getRootNode();
  const shadowRoot = isShadowRoot(rootNode) ? rootNode : null;
  const shadowSelection = getShadowSelection(shadowRoot);

  return {
    activeElement: summarizeElement(ownerDocument.activeElement, rootElement),
    shadowActiveElement: summarizeElement(shadowRoot?.activeElement ?? null, rootElement),
    documentSelection: summarizeSelection(ownerDocument.getSelection(), rootElement),
    shadowSelection: summarizeSelection(shadowSelection, rootElement),
  };
}

function normalize(input: WebmateLogInput): Record<string, unknown> {
  return {
    namespace: String(input.namespace || '').trim(),
    scenario: String(input.scenario || '').trim(),
    level: String(input.level || 'info').trim().toLowerCase(),
    message: String(input.message || '').trim(),
    context: input.context === undefined ? {} : input.context,
    request_id: input.request_id == null ? null : String(input.request_id).trim(),
    timestamp: input.timestamp || new Date().toISOString(),
  };
}

function timeoutSignal(ms: number): AbortSignal | undefined {
  if (typeof AbortSignal !== 'undefined') {
    const abortSignal = AbortSignal as typeof AbortSignal & { timeout?: (ms: number) => AbortSignal };
    if (typeof abortSignal.timeout === 'function') {
      return abortSignal.timeout(ms);
    }
  }

  if (typeof AbortController === 'undefined') {
    return undefined;
  }

  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

async function sendWebmateLog(input: WebmateLogInput, options: WebmateLogOptions = {}): Promise<boolean> {
  try {
    const payload = normalize(input);
    const endpoint = String(options.endpoint || input.endpoint || DEFAULT_WEBMATELOG_ENDPOINT).trim();
    const fetchImpl = options.fetchImpl || globalThis.fetch;
    const retries = Number.isFinite(Number(options.retries)) ? Number(options.retries) : 1;
    const retryDelayMs = options.retryDelayMs ?? 250;
    const timeoutMs = options.timeoutMs ?? 1200;

    if (!endpoint || !payload.namespace || !payload.scenario || !payload.message || typeof fetchImpl !== 'function') {
      return false;
    }

    if (await sendWebmateLogViaExtensionRelay(payload, endpoint, timeoutMs)) {
      return true;
    }

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        signal: timeoutSignal(timeoutMs),
      });

      if (response.ok) {
        return true;
      }

      if (attempt < retries) {
        await sleep(retryDelayMs);
      }
    }
  } catch {
    return false;
  }

  return false;
}

function sendWebmateLogViaExtensionRelay(
  payload: Record<string, unknown>,
  endpoint: string,
  timeoutMs: number,
): Promise<boolean> {
  if (!canUseExtensionRelay()) {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok: boolean): void => {
      if (settled) {
        return;
      }

      settled = true;
      window.clearTimeout(timeoutId);
      resolve(ok);
    };
    const timeoutId = window.setTimeout(() => finish(false), timeoutMs + 200);

    try {
      chrome.runtime.sendMessage(
        createWebmateLogRelayMessage(endpoint, payload, timeoutMs),
        (response?: WebmateLogRelayResponse) => {
          if (chrome.runtime.lastError) {
            finish(false);
            return;
          }

          finish(Boolean(response?.ok));
        },
      );
    } catch {
      finish(false);
    }
  });
}

function canUseExtensionRelay(): boolean {
  return typeof chrome !== 'undefined'
    && typeof chrome.runtime !== 'undefined'
    && typeof chrome.runtime.sendMessage === 'function';
}

function webmatelog(input: WebmateLogInput, options?: WebmateLogOptions): void {
  void sendWebmateLog(input, options);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isNotebookWebmateLogEnabled(): boolean {
  const queryEnabled = readQueryParam(WEBMATELOG_QUERY_ENABLE);
  const sessionValue = readStorageValue(sessionStorageSafe(), WEBMATELOG_ENABLE_KEY);
  const localValue = readStorageValue(localStorageSafe(), WEBMATELOG_ENABLE_KEY);

  if (cachedEnabled !== null) {
    return cachedEnabled;
  }

  if (queryEnabled !== null) {
    cachedEnabled = isTruthyDebugValue(queryEnabled);
    writeStorageValue(sessionStorageSafe(), WEBMATELOG_ENABLE_KEY, cachedEnabled ? '1' : '0');
    return cachedEnabled;
  }

  cachedEnabled = isTruthyDebugValue(sessionValue ?? localValue);
  return cachedEnabled;
}

function getNotebookWebmateEndpoint(): string {
  return readQueryParam(WEBMATELOG_QUERY_ENDPOINT)
    ?? readStorageValue(sessionStorageSafe(), WEBMATELOG_ENDPOINT_KEY)
    ?? readStorageValue(localStorageSafe(), WEBMATELOG_ENDPOINT_KEY)
    ?? DEFAULT_WEBMATELOG_ENDPOINT;
}

function getNotebookWebmateRequestId(): string {
  if (cachedRequestId) {
    return cachedRequestId;
  }

  const storage = sessionStorageSafe();
  const existingRequestId = readStorageValue(storage, WEBMATELOG_REQUEST_ID_KEY);
  if (existingRequestId) {
    cachedRequestId = existingRequestId;
    return existingRequestId;
  }

  cachedRequestId = `copy-ai-id-note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  writeStorageValue(storage, WEBMATELOG_REQUEST_ID_KEY, cachedRequestId);
  return cachedRequestId;
}

function summarizeEvent(event: Event): Record<string, unknown> {
  const keyboardEvent = event instanceof KeyboardEvent ? event : null;
  const inputEvent = isInputEvent(event) ? event : null;
  const compositionEvent = event instanceof CompositionEvent ? event : null;
  const clipboardEvent = typeof ClipboardEvent !== 'undefined' && event instanceof ClipboardEvent
    ? event
    : null;

  return {
    type: event.type,
    eventPhase: event.eventPhase,
    bubbles: event.bubbles,
    cancelable: event.cancelable,
    defaultPrevented: event.defaultPrevented,
    composed: event.composed,
    isTrusted: event.isTrusted,
    key: keyboardEvent ? summarizeKey(keyboardEvent.key) : undefined,
    code: keyboardEvent ? summarizeKeyboardCode(keyboardEvent.code) : undefined,
    repeat: keyboardEvent?.repeat,
    isComposing: keyboardEvent?.isComposing ?? inputEvent?.isComposing,
    modifiers: keyboardEvent ? summarizeModifiers(keyboardEvent) : undefined,
    inputType: inputEvent?.inputType,
    dataLength: typeof inputEvent?.data === 'string' ? inputEvent.data.length : undefined,
    compositionDataLength: typeof compositionEvent?.data === 'string' ? compositionEvent.data.length : undefined,
    clipboardTextLength: clipboardEvent?.clipboardData?.getData('text/plain').length,
  };
}

function summarizeSelection(selection: Selection | null, rootElement: HTMLElement): SelectionSummary | null {
  if (!selection) {
    return null;
  }

  return {
    type: selection.type,
    rangeCount: selection.rangeCount,
    isCollapsed: selection.isCollapsed,
    anchorOffset: selection.anchorOffset,
    focusOffset: selection.focusOffset,
    anchor: summarizeNodeBoundary(selection.anchorNode, rootElement),
    focus: summarizeNodeBoundary(selection.focusNode, rootElement),
  };
}

function summarizeNodeBoundary(node: Node | null, rootElement: HTMLElement): NodeBoundarySummary | null {
  if (!node) {
    return null;
  }

  const element = node instanceof Element ? node : node.parentElement;
  const lexicalTextElement = closestWithinRoot(element, rootElement, '[data-lexical-text]');
  const chipElement = closestWithinRoot(element, rootElement, '[data-copy-ai-id-chip-id]');
  const lexicalKeyOwner = findLexicalKeyOwner(node, rootElement);

  return {
    nodeType: node.nodeType,
    nodeName: node.nodeName,
    isTextNode: node.nodeType === Node.TEXT_NODE,
    textLength: node.nodeType === Node.TEXT_NODE ? (node.textContent?.length ?? 0) : undefined,
    withinEditor: node === rootElement || rootElement.contains(node),
    nearestElement: summarizeElement(element, rootElement),
    nearestLexicalText: summarizeElement(lexicalTextElement, rootElement),
    nearestChip: summarizeElement(chipElement, rootElement),
    lexicalKeyOwner: lexicalKeyOwner ? summarizeElement(lexicalKeyOwner, rootElement) : null,
  };
}

function summarizeElement(element: Element | null, rootElement: HTMLElement): ElementSummary | null {
  if (!element) {
    return null;
  }

  const htmlElement = element instanceof HTMLElement ? element : null;
  const dataset = htmlElement?.dataset;
  const chipId = dataset?.copyAiIdChipId;
  const dataAiId = dataset?.aiId;

  return {
    tagName: element.tagName.toLowerCase(),
    withinEditor: element === rootElement || rootElement.contains(element),
    isRootEditor: element === rootElement,
    isContentEditable: htmlElement?.isContentEditable ?? false,
    contentEditable: htmlElement?.contentEditable,
    dataAiId: summarizeDataAiId(dataAiId),
    hasLexicalEditorAttr: element.hasAttribute('data-lexical-editor'),
    hasLexicalTextAttr: element.hasAttribute('data-lexical-text'),
    hasLexicalKey: hasLexicalKey(element),
    chipId: chipId ? summarizeChipId(chipId) : undefined,
    chipTargetKind: dataset?.copyAiIdChipTargetKind,
    classFlags: summarizeClassFlags(element),
  };
}

function closestWithinRoot(element: Element | null, rootElement: HTMLElement, selector: string): Element | null {
  const closest = element?.closest(selector) ?? null;
  return closest && (closest === rootElement || rootElement.contains(closest)) ? closest : null;
}

function findLexicalKeyOwner(startNode: Node, rootElement: HTMLElement): Element | null {
  let node: Node | null = startNode;

  while (node) {
    if (node instanceof Element && hasLexicalKey(node)) {
      return node;
    }

    if (node === rootElement) {
      return null;
    }

    node = node.parentNode;
  }

  return null;
}

function hasLexicalKey(node: Element): boolean {
  return Object.keys(node).some((key) => key.startsWith('__lexicalKey_'));
}

function summarizeClassFlags(element: Element): string[] {
  const flags: string[] = [];
  const classList = element.classList;

  if (classList.contains('copy-ai-id-editor-note-contenteditable')) {
    flags.push('note-contenteditable');
  }

  if (classList.contains('copy-ai-id-editor-note-chip')) {
    flags.push('note-chip');
  }

  if (classList.contains('copy-ai-id-editor-note-lexical')) {
    flags.push('note-lexical-wrapper');
  }

  return flags;
}

function summarizeDataAiId(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  return value.startsWith('copy-ai-id-') ? value : '[external-data-ai-id]';
}

function summarizeChipId(value: string): string {
  return /^el-\d+$/.test(value) ? value : '[custom-chip-id]';
}

function summarizeKey(key: string): string {
  if (key.length === 1) {
    return key === ' ' ? 'Space' : '[printable]';
  }

  if (/^(Backspace|Delete|Enter|Escape|Tab|ArrowUp|ArrowDown|ArrowLeft|ArrowRight|Home|End|PageUp|PageDown)$/.test(key)) {
    return key;
  }

  return '[other-key]';
}

function summarizeKeyboardCode(code: string): string {
  if (/^Key[A-Z]$/.test(code) || /^Digit\d$/.test(code)) {
    return '[printable-code]';
  }

  if (/^(Backspace|Delete|Enter|Escape|Tab|ArrowUp|ArrowDown|ArrowLeft|ArrowRight|Home|End|PageUp|PageDown|Space)$/.test(code)) {
    return code;
  }

  return code ? '[other-code]' : '';
}

function summarizeModifiers(event: KeyboardEvent): Record<string, boolean> {
  return {
    altKey: event.altKey,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    shiftKey: event.shiftKey,
  };
}

function isInputEvent(event: Event): event is InputEvent {
  return typeof InputEvent !== 'undefined' && event instanceof InputEvent;
}

function isShadowRoot(node: Node): node is ShadowRoot {
  return typeof ShadowRoot !== 'undefined' && node instanceof ShadowRoot;
}

function getShadowSelection(shadowRoot: ShadowRoot | null): Selection | null {
  if (!shadowRoot) {
    return null;
  }

  const selectionReader = shadowRoot as ShadowRoot & { getSelection?: () => Selection | null };
  return typeof selectionReader.getSelection === 'function' ? selectionReader.getSelection() : null;
}

function readQueryParam(name: string): string | null {
  try {
    const url = new URL(window.location.href);
    return url.searchParams.get(name) ?? readHashQueryParam(url.hash, name);
  } catch {
    return null;
  }
}

function readHashQueryParam(hash: string, name: string): string | null {
  const normalizedHash = hash.startsWith('#') ? hash.slice(1) : hash;
  const queryStartIndex = normalizedHash.indexOf('?');
  if (queryStartIndex === -1) {
    return new URLSearchParams(normalizedHash).get(name);
  }

  return new URLSearchParams(normalizedHash.slice(queryStartIndex + 1)).get(name);
}

function isTruthyDebugValue(value: string | null | undefined): boolean {
  return value === '1' || value === 'true' || value === 'yes' || value === 'on';
}

function sessionStorageSafe(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function localStorageSafe(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readStorageValue(storage: Storage | null, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeStorageValue(storage: Storage | null, key: string, value: string): void {
  try {
    storage?.setItem(key, value);
  } catch {
    // Debug logging must never break editor behavior.
  }
}

interface SelectionSummary {
  type: string;
  rangeCount: number;
  isCollapsed: boolean;
  anchorOffset: number;
  focusOffset: number;
  anchor: NodeBoundarySummary | null;
  focus: NodeBoundarySummary | null;
}

interface NodeBoundarySummary {
  nodeType: number;
  nodeName: string;
  isTextNode: boolean;
  textLength?: number;
  withinEditor: boolean;
  nearestElement: ElementSummary | null;
  nearestLexicalText: ElementSummary | null;
  nearestChip: ElementSummary | null;
  lexicalKeyOwner: ElementSummary | null;
}

interface ElementSummary {
  tagName: string;
  withinEditor: boolean;
  isRootEditor: boolean;
  isContentEditable: boolean;
  contentEditable?: string;
  dataAiId?: string;
  hasLexicalEditorAttr: boolean;
  hasLexicalTextAttr: boolean;
  hasLexicalKey: boolean;
  chipId?: string;
  chipTargetKind?: string;
  classFlags: string[];
}
