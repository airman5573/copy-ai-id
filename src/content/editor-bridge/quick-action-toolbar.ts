import {
  isExtensionOwnedElement,
  QUICK_ACTION_BAR_ATTR,
  QUICK_ACTION_STYLE_ATTR,
} from '../../shared/config';
import {
  calculateToolbarPlacement,
  DEFAULT_QUICK_ACTION_BAR_SIZE,
  isUsableRect,
  measureToolbar,
  QUICK_ACTION_TRANSITION_CORRIDOR_MAX_HORIZONTAL_EXTENSION,
  QUICK_ACTION_TRANSITION_CORRIDOR_PADDING,
  type OverlaySize,
  type ToolbarPlacement,
} from './toolbar-geometry';
import {
  QUICK_ACTION_BAR_BUTTON_CLASS,
  QUICK_ACTION_BAR_CLASS,
  QUICK_ACTION_BAR_SEPARATOR_CLASS,
  toolbarCss,
} from './toolbar-styles';
import {
  type BridgeViewportPoint,
  type BridgeViewportRect,
  type BridgeViewportSize,
} from '../../shared/domain/geometry';
import { type EditorTargetReference } from '../../shared/domain/targets';
import {
  type QuickActionCategory,
  type QuickActionStructureOperation,
} from '../../shared/domain/visual';
import {
  type BridgeToEditorMessage,
  EDITOR_MESSAGE_TYPES,
} from '../../shared/protocol/editor-bridge-messages';
import { getCurrentMessages } from '../../shared/i18n';
import {
  nextEditableSibling,
  previousEditableSibling,
} from './lib/dom';
import {
  viewportRectForElement,
  viewportSize,
} from './lib/viewport';

const QUICK_ACTION_DRAG_THRESHOLD_PX = 8;

const QUICK_ACTION_CATEGORIES: QuickActionCategory[] = ['content', 'layout', 'spacing', 'size', 'style', 'border'];

const STRUCTURE_ACTIONS: Array<{
  action: QuickActionStructureOperation;
  destructive?: boolean;
}> = [
  { action: 'duplicate' },
  { action: 'move-up' },
  { action: 'move-down' },
  { action: 'delete', destructive: true },
];

type QuickActionToolbarPost = (message: BridgeToEditorMessage) => void;

export interface QuickActionToolbarTarget extends EditorTargetReference {
  element: Element;
  availableCategories?: readonly QuickActionCategory[];
  activeCategory?: QuickActionCategory | null;
  post: QuickActionToolbarPost;
}

interface QuickActionToolbarState extends Required<Pick<QuickActionToolbarTarget, 'availableCategories'>> {
  target: QuickActionToolbarTarget['target'];
  nodeId: QuickActionToolbarTarget['nodeId'];
  element: Element;
  activeCategory: QuickActionCategory | null;
  post: QuickActionToolbarPost;
  elementRect: BridgeViewportRect;
  viewport: BridgeViewportSize;
  updatedAt: number;
}

interface QuickActionDragState {
  pointerId: number;
  startX: number;
  startY: number;
  latestX: number;
  latestY: number;
  reference: EditorTargetReference;
}

let toolbarRoot: HTMLDivElement | null = null;
let styleElement: HTMLStyleElement | null = null;
let renderState: QuickActionToolbarState | null = null;
let resizeObserver: ResizeObserver | null = null;
let placementFrameId: number | null = null;
let dragState: QuickActionDragState | null = null;
let isToolbarHovered = false;
let isToolbarFocusWithin = false;
let pendingHide = false;
let viewportListenersInstalled = false;

export function showQuickActionToolbar(input: QuickActionToolbarTarget): void {
  if (!input.element.isConnected) {
    hideQuickActionToolbar();
    return;
  }

  ensureToolbarRoot();
  ensureToolbarStyle();
  installViewportListeners();

  renderState = {
    target: input.target,
    nodeId: input.nodeId,
    element: input.element,
    availableCategories: input.availableCategories ?? QUICK_ACTION_CATEGORIES,
    activeCategory: input.activeCategory ?? null,
    post: input.post,
    elementRect: viewportRectForElement(input.element),
    viewport: viewportSize(),
    updatedAt: Date.now(),
  };
  pendingHide = false;

  renderToolbarContents();

  if (toolbarRoot) {
    toolbarRoot.style.display = 'flex';
    toolbarRoot.style.visibility = 'hidden';
    toolbarRoot.setAttribute('data-visual-target-updated-at', String(renderState.updatedAt));
  }

  schedulePlacementRefresh();
}

export function requestQuickActionToolbarHide(): void {
  if (hasActiveToolbarInteraction()) {
    pendingHide = true;
    return;
  }

  hideQuickActionToolbar();
}

export function hideQuickActionToolbar(): void {
  pendingHide = false;
  renderState = null;
  dragState = null;
  setToolbarDragging(false);
  cancelPlacementRefresh();
  uninstallViewportListeners();

  if (toolbarRoot) {
    toolbarRoot.style.display = 'none';
    toolbarRoot.style.visibility = 'hidden';
    toolbarRoot.removeAttribute('data-visual-target-updated-at');
  }
}

export function destroyQuickActionToolbar(): void {
  hideQuickActionToolbar();
  resizeObserver?.disconnect();
  resizeObserver = null;
  toolbarRoot?.remove();
  toolbarRoot = null;
  styleElement?.remove();
  styleElement = null;
  isToolbarHovered = false;
  isToolbarFocusWithin = false;
}

export function isQuickActionToolbarElement(target: EventTarget | null): boolean {
  const element = elementFromEventTarget(target);
  return Boolean(element?.closest(`[${QUICK_ACTION_BAR_ATTR}]`));
}

export function isPointInQuickActionToolbarTransitionCorridor(clientX: number, clientY: number): boolean {
  if (!Number.isFinite(clientX) || !Number.isFinite(clientY) || !toolbarRoot || !renderState) {
    return false;
  }

  if (!toolbarRoot.isConnected || !renderState.element.isConnected) {
    return false;
  }

  if (toolbarRoot.style.display === 'none' || toolbarRoot.style.visibility === 'hidden') {
    return false;
  }

  const toolbarRect = toolbarRoot.getBoundingClientRect();
  const anchorRect = renderState.element.getBoundingClientRect();
  if (!isUsableRect(toolbarRect) || !isUsableRect(anchorRect)) {
    return false;
  }

  const padding = QUICK_ACTION_TRANSITION_CORRIDOR_PADDING;
  const toolbarAboveAnchor = toolbarRect.bottom <= anchorRect.top;
  const toolbarBelowAnchor = anchorRect.bottom <= toolbarRect.top;
  let top: number;
  let bottom: number;

  if (toolbarAboveAnchor) {
    top = toolbarRect.bottom - padding;
    bottom = anchorRect.top + padding;
  } else if (toolbarBelowAnchor) {
    top = anchorRect.bottom - padding;
    bottom = toolbarRect.top + padding;
  } else {
    return false;
  }

  const anchorCenterX = anchorRect.left + (anchorRect.width / 2);
  let left = toolbarRect.left - padding;
  let right = toolbarRect.right + padding;

  if (anchorCenterX < toolbarRect.left) {
    left = Math.max(
      anchorCenterX - padding,
      toolbarRect.left - QUICK_ACTION_TRANSITION_CORRIDOR_MAX_HORIZONTAL_EXTENSION,
    );
  } else if (anchorCenterX > toolbarRect.right) {
    right = Math.min(
      anchorCenterX + padding,
      toolbarRect.right + QUICK_ACTION_TRANSITION_CORRIDOR_MAX_HORIZONTAL_EXTENSION,
    );
  }

  return clientX >= left
    && clientX <= right
    && clientY >= top
    && clientY <= bottom;
}

function ensureToolbarRoot(): HTMLDivElement {
  if (toolbarRoot?.isConnected) {
    return toolbarRoot;
  }

  toolbarRoot?.remove();
  toolbarRoot = document.createElement('div');
  toolbarRoot.className = QUICK_ACTION_BAR_CLASS;
  toolbarRoot.setAttribute(QUICK_ACTION_BAR_ATTR, 'true');
  toolbarRoot.setAttribute('data-ai-id', 'copy-ai-id-preview-quick-action-bar');
  toolbarRoot.setAttribute('role', 'toolbar');
  toolbarRoot.style.display = 'none';
  toolbarRoot.style.visibility = 'hidden';
  toolbarRoot.addEventListener('pointerenter', handleToolbarPointerEnter);
  toolbarRoot.addEventListener('pointerleave', handleToolbarPointerLeave);
  toolbarRoot.addEventListener('focusin', handleToolbarFocusIn);
  toolbarRoot.addEventListener('focusout', handleToolbarFocusOut);
  (document.body ?? document.documentElement).appendChild(toolbarRoot);

  installResizeObserver(toolbarRoot);
  return toolbarRoot;
}

function ensureToolbarStyle(): void {
  if (styleElement?.isConnected) {
    return;
  }

  styleElement?.remove();
  styleElement = document.createElement('style');
  styleElement.setAttribute(QUICK_ACTION_STYLE_ATTR, 'true');
  styleElement.textContent = toolbarCss();
  (document.head ?? document.documentElement).appendChild(styleElement);
}

function installResizeObserver(node: HTMLDivElement): void {
  resizeObserver?.disconnect();
  resizeObserver = null;

  if (typeof ResizeObserver === 'undefined') {
    return;
  }

  resizeObserver = new ResizeObserver(() => schedulePlacementRefresh());
  resizeObserver.observe(node);
}

function installViewportListeners(): void {
  if (viewportListenersInstalled) {
    return;
  }

  window.addEventListener('resize', schedulePlacementRefresh, { passive: true });
  window.addEventListener('scroll', schedulePlacementRefresh, { capture: true, passive: true });
  viewportListenersInstalled = true;
}

function uninstallViewportListeners(): void {
  if (!viewportListenersInstalled) {
    return;
  }

  window.removeEventListener('resize', schedulePlacementRefresh);
  window.removeEventListener('scroll', schedulePlacementRefresh, true);
  viewportListenersInstalled = false;
}

function renderToolbarContents(): void {
  if (!toolbarRoot || !renderState) {
    return;
  }

  const messages = getCurrentMessages();
  const visualEditorMessages = messages.visualEditor;
  const visibleCategories = getVisibleCategories(renderState.availableCategories);
  toolbarRoot.setAttribute('aria-label', visualEditorMessages.quickActions.toolbarLabel);
  toolbarRoot.replaceChildren();

  const dragGrip = createButton({
    className: `${QUICK_ACTION_BAR_BUTTON_CLASS} ${QUICK_ACTION_BAR_BUTTON_CLASS}--icon ${QUICK_ACTION_BAR_BUTTON_CLASS}--grip`,
    dataAiId: 'copy-ai-id-preview-quick-action-drag-grip-button',
    label: '⠿',
    title: visualEditorMessages.quickActions.dragMoveTitle,
    ariaLabel: visualEditorMessages.quickActions.dragMoveTitle,
  });
  dragGrip.setAttribute('data-ai-editor-drag-grip', '1');
  dragGrip.setAttribute('aria-pressed', dragState ? 'true' : 'false');
  dragGrip.addEventListener('pointerdown', handleDragGripPointerDown);
  dragGrip.addEventListener('pointermove', handleDragGripPointerMove);
  dragGrip.addEventListener('pointerup', (event) => finishDragGrip(event, true));
  dragGrip.addEventListener('pointercancel', (event) => finishDragGrip(event, false));
  dragGrip.addEventListener('lostpointercapture', handleDragGripLostPointerCapture);
  toolbarRoot.appendChild(dragGrip);

  toolbarRoot.appendChild(createSeparator('copy-ai-id-preview-quick-action-drag-divider'));

  for (const category of QUICK_ACTION_CATEGORIES.filter((candidate) => visibleCategories.has(candidate))) {
    const button = createButton({
      className: `${QUICK_ACTION_BAR_BUTTON_CLASS}${renderState.activeCategory === category ? ' is-active' : ''}`,
      dataAiId: `copy-ai-id-preview-quick-action-${category}-button`,
      label: visualEditorMessages.categories[category].label,
    });
    button.setAttribute('data-ai-editor-quick-action', category);
    button.setAttribute('aria-pressed', renderState.activeCategory === category ? 'true' : 'false');
    button.addEventListener('click', () => postCategoryRequest(category));
    toolbarRoot.appendChild(button);
  }

  toolbarRoot.appendChild(createSeparator('copy-ai-id-preview-quick-action-structure-divider'));

  for (const { action, destructive } of STRUCTURE_ACTIONS) {
    const actionCopy = visualEditorMessages.quickActions.structure[action];
    const disabled = isStructureActionDisabled(action, renderState.element);
    const button = createButton({
      className: [
        QUICK_ACTION_BAR_BUTTON_CLASS,
        `${QUICK_ACTION_BAR_BUTTON_CLASS}--structure`,
        destructive ? `${QUICK_ACTION_BAR_BUTTON_CLASS}--danger` : '',
      ].filter(Boolean).join(' '),
      dataAiId: `copy-ai-id-preview-quick-action-structure-${action}-button`,
      label: actionCopy.label,
      title: actionCopy.title,
    });
    button.setAttribute('data-ai-editor-structure-action', action);
    button.disabled = disabled;
    if (disabled) {
      button.setAttribute('aria-disabled', 'true');
    } else {
      button.addEventListener('click', () => postStructureRequest(action));
    }
    toolbarRoot.appendChild(button);
  }
}

function isStructureActionDisabled(action: QuickActionStructureOperation, element: Element): boolean {
  switch (action) {
    case 'move-up':
      return previousEditableSibling(element) === null;
    case 'move-down':
      return nextEditableSibling(element) === null;
    case 'duplicate':
    case 'delete':
      return false;
    default:
      return exhaustiveStructureAction(action);
  }
}

function exhaustiveStructureAction(action: never): never {
  throw new Error(`Unsupported quick-action structure operation: ${JSON.stringify(action)}`);
}

function createButton({
  className,
  dataAiId,
  label,
  title,
  ariaLabel,
}: {
  className: string;
  dataAiId: string;
  label: string;
  title?: string;
  ariaLabel?: string;
}): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.setAttribute('data-ai-id', dataAiId);
  if (title) {
    button.title = title;
  }
  if (ariaLabel) {
    button.setAttribute('aria-label', ariaLabel);
  }

  const labelElement = document.createElement('span');
  labelElement.textContent = label;
  if (ariaLabel) {
    labelElement.setAttribute('aria-hidden', 'true');
  }
  button.appendChild(labelElement);
  return button;
}

function createSeparator(dataAiId: string): HTMLSpanElement {
  const separator = document.createElement('span');
  separator.className = QUICK_ACTION_BAR_SEPARATOR_CLASS;
  separator.setAttribute('data-ai-id', dataAiId);
  return separator;
}

function postCategoryRequest(category: QuickActionCategory): void {
  if (!renderState) {
    return;
  }

  renderState.activeCategory = category;
  renderToolbarContents();
  renderState.post({
    type: EDITOR_MESSAGE_TYPES.quickActionCategoryRequested,
    target: renderState.target,
    nodeId: renderState.nodeId,
    category,
    ...currentRequestGeometry(),
  });
}

function postStructureRequest(operation: QuickActionStructureOperation): void {
  if (!renderState) {
    return;
  }

  renderState.post({
    type: EDITOR_MESSAGE_TYPES.quickActionStructureRequested,
    target: renderState.target,
    nodeId: renderState.nodeId,
    operation,
    ...currentRequestGeometry(),
  });
}

function postDragPreviewRequest(dropPoint: BridgeViewportPoint): void {
  if (!renderState) {
    return;
  }

  renderState.post({
    type: EDITOR_MESSAGE_TYPES.quickActionDragMovePreviewRequested,
    target: renderState.target,
    nodeId: renderState.nodeId,
    dropPoint,
    ...currentRequestGeometry(),
  });
}

function postDragMoveRequest(dropPoint: BridgeViewportPoint): void {
  if (!renderState) {
    return;
  }

  renderState.post({
    type: EDITOR_MESSAGE_TYPES.quickActionDragMoveRequested,
    target: renderState.target,
    nodeId: renderState.nodeId,
    dropPoint,
    ...currentRequestGeometry(),
  });
}

function postDragClearRequest(): void {
  if (!renderState) {
    return;
  }

  renderState.post({
    type: EDITOR_MESSAGE_TYPES.quickActionDragMoveClearRequested,
    target: renderState.target,
    nodeId: renderState.nodeId,
  });
}

function handleDragGripPointerDown(event: PointerEvent): void {
  if (!renderState || event.button !== 0 || !(event.currentTarget instanceof HTMLButtonElement)) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.setPointerCapture(event.pointerId);
  dragState = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    latestX: event.clientX,
    latestY: event.clientY,
    reference: {
      target: renderState.target,
      nodeId: renderState.nodeId,
    },
  };
  setToolbarDragging(true);
}

function handleDragGripPointerMove(event: PointerEvent): void {
  if (!dragState || dragState.pointerId !== event.pointerId) {
    return;
  }

  dragState.latestX = event.clientX;
  dragState.latestY = event.clientY;

  if (dragDistance(dragState) >= QUICK_ACTION_DRAG_THRESHOLD_PX) {
    postDragPreviewRequest(pointFromPointerEvent(event));
  }
}

function finishDragGrip(event: PointerEvent, commit: boolean): void {
  if (!dragState || dragState.pointerId !== event.pointerId || !(event.currentTarget instanceof HTMLButtonElement)) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  const completedDragState = dragState;
  dragState = null;
  setToolbarDragging(false);
  postDragClearRequest();

  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  if (commit && dragDistance(completedDragState) >= QUICK_ACTION_DRAG_THRESHOLD_PX) {
    postDragMoveRequest({
      x: completedDragState.latestX,
      y: completedDragState.latestY,
    });
  }

  flushPendingHideIfReady();
}

function handleDragGripLostPointerCapture(): void {
  if (!dragState) {
    return;
  }

  dragState = null;
  setToolbarDragging(false);
  postDragClearRequest();
  flushPendingHideIfReady();
}

function setToolbarDragging(dragging: boolean): void {
  toolbarRoot
    ?.querySelector(`[data-ai-id="copy-ai-id-preview-quick-action-drag-grip-button"]`)
    ?.classList.toggle('is-dragging', dragging);
  toolbarRoot
    ?.querySelector(`[data-ai-id="copy-ai-id-preview-quick-action-drag-grip-button"]`)
    ?.setAttribute('aria-pressed', dragging ? 'true' : 'false');
}

function dragDistance(state: QuickActionDragState): number {
  return Math.hypot(state.latestX - state.startX, state.latestY - state.startY);
}

function pointFromPointerEvent(event: PointerEvent): BridgeViewportPoint {
  return {
    x: event.clientX,
    y: event.clientY,
  };
}

function currentRequestGeometry(): {
  elementRect: BridgeViewportRect | null;
  viewport: BridgeViewportSize;
} {
  if (!renderState) {
    return {
      elementRect: null,
      viewport: viewportSize(),
    };
  }

  if (renderState.element.isConnected) {
    renderState.elementRect = viewportRectForElement(renderState.element);
  }
  renderState.viewport = viewportSize();

  return {
    elementRect: renderState.elementRect,
    viewport: renderState.viewport,
  };
}

function schedulePlacementRefresh(): void {
  if (placementFrameId !== null) {
    return;
  }

  placementFrameId = window.requestAnimationFrame(() => {
    placementFrameId = null;
    updateToolbarPlacement();
  });
}

function cancelPlacementRefresh(): void {
  if (placementFrameId === null) {
    return;
  }

  window.cancelAnimationFrame(placementFrameId);
  placementFrameId = null;
}

function updateToolbarPlacement(): void {
  if (!toolbarRoot || !renderState) {
    return;
  }

  if (!renderState.element.isConnected) {
    hideQuickActionToolbar();
    return;
  }

  renderState.elementRect = viewportRectForElement(renderState.element);
  renderState.viewport = viewportSize();

  const placement = calculateToolbarPlacement(renderState.elementRect, measureToolbar(toolbarRoot), renderState.viewport);
  toolbarRoot.classList.toggle(`${QUICK_ACTION_BAR_CLASS}--above`, placement.side === 'above');
  toolbarRoot.classList.toggle(`${QUICK_ACTION_BAR_CLASS}--below`, placement.side === 'below');
  toolbarRoot.style.left = `${placement.left}px`;
  toolbarRoot.style.top = `${placement.top}px`;
  toolbarRoot.style.visibility = 'visible';
}

function handleToolbarPointerEnter(): void {
  isToolbarHovered = true;
  pendingHide = false;
}

function handleToolbarPointerLeave(): void {
  isToolbarHovered = false;
  flushPendingHideIfReady();
}

function handleToolbarFocusIn(): void {
  isToolbarFocusWithin = true;
  pendingHide = false;
}

function handleToolbarFocusOut(event: FocusEvent): void {
  if (toolbarRoot?.contains(event.relatedTarget as Node | null)) {
    return;
  }

  isToolbarFocusWithin = false;
  flushPendingHideIfReady();
}

function flushPendingHideIfReady(): void {
  if (pendingHide && !hasActiveToolbarInteraction()) {
    hideQuickActionToolbar();
  }
}

function hasActiveToolbarInteraction(): boolean {
  return isToolbarHovered || isToolbarFocusWithin || Boolean(dragState);
}

function getVisibleCategories(categories: readonly QuickActionCategory[]): Set<QuickActionCategory> {
  const requested = new Set(categories);
  if (requested.size === 0) {
    return new Set(QUICK_ACTION_CATEGORIES);
  }

  return new Set(QUICK_ACTION_CATEGORIES.filter((category) => requested.has(category)));
}

function elementFromEventTarget(target: EventTarget | null): Element | null {
  if (target instanceof Element) {
    return target;
  }

  if (target instanceof Node) {
    return target.parentElement;
  }

  return null;
}
