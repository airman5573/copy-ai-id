import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
} from 'react';

import type { EditorTargetReference } from '../../../shared/domain/targets';
import type {
  QuickActionCategory,
  QuickActionStructureOperation,
  VisualTargetSnapshot,
} from '../../../shared/domain/visual';
import { hasSameEditorTarget } from '../../../shared/editor-targets';
import { getCurrentMessages } from '../../../shared/i18n';
import { normalizeVisualStyleValue } from '../../../shared/visual-style';
import { requestVisualTargetSnapshot } from '../../bridge/bridgeClient';
import {
  bridgeViewportRectToEditorViewportRect,
  calculateFloatingOverlayPlacement,
  editorViewportPointToBridgeViewportPoint,
  getPreviewWorkspaceGeometrySnapshot,
  type EditorViewportRect,
  type OverlaySize,
} from '../../bridge/geometry';
import { useBreakpointStore } from '../../stores/useBreakpointStore';
import { useFloatingNotePanelStore } from '../../stores/useFloatingNotePanelStore';
import { useFloatingVisualPanelStore } from '../../stores/useFloatingVisualPanelStore';
import { useVisualSelectionStore } from '../../stores/useVisualSelectionStore';
import {
  formatStepperLengthDisplay,
} from '../../utils/stepperMath';
import {
  clearQuickActionDragMovePreview,
  dispatchQuickActionDragMoveFromBridgePoint,
  dispatchQuickActionStructureOperation,
  previewQuickActionDragMoveFromBridgePoint,
} from '../../visual/structureActions';
import { dispatchVisualStyleMutation } from '../../visual/visualMutationClient';
import { StepperControl } from '../visual/StepperControl';
import {
  AttributeEditPopover,
  SizeHybridControl,
} from './AttributeEditPopover';
import { ColorSwatchControl } from './ColorSwatchControl';
import { SegmentControl } from './SegmentControl';
import { SpacingPopover } from './SpacingPopover';
import {
  QUICK_TOOLBAR_SPACING_GROUPS,
  QUICK_TOOLBAR_STRUCTURE_OPERATIONS,
  resolveQuickToolbarControls,
  type QuickToolbarControlId,
} from './toolbarConfig';
import { useToolbarStepper, type ToolbarStepperApi } from './useToolbarStepper';

const DEFAULT_TOOLBAR_SIZE: OverlaySize = { width: 420, height: 76 };
const TOOLBAR_GAP_PX = 10;
const DRAG_THRESHOLD_PX = 8;

interface DragGripState {
  pointerId: number;
  startX: number;
  startY: number;
  dragging: boolean;
}

// Editor-side floating quick toolbar. Anchored to the pinned preview element
// (bridge streams 'repositioned' rects while pinned); row 1 is composed from
// the element's intents, row 2 is the shared spacing/structure/drag/more strip.
export function QuickToolbar(): ReactElement | null {
  const toolbarTarget = useVisualSelectionStore((state) => state.activeToolbarTarget);
  const snapshot = useVisualSelectionStore((state) => state.snapshot);
  const zoom = useBreakpointStore((state) => state.zoomById[state.activeBreakpointId]);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragGripState | null>(null);
  const [toolbarSize, setToolbarSize] = useState<OverlaySize>(DEFAULT_TOOLBAR_SIZE);
  const [layoutRevision, setLayoutRevision] = useState(0);

  const reference = useMemo<EditorTargetReference | null>(() => (
    toolbarTarget
      ? { target: toolbarTarget.target, nodeId: toolbarTarget.nodeId }
      : null
  ), [toolbarTarget]);
  const matchedSnapshot = toolbarTarget
    && snapshot
    && hasSameEditorTarget(snapshot.target, toolbarTarget.target)
    ? snapshot
    : null;
  const stepper = useToolbarStepper(reference, matchedSnapshot);
  const isVisible = Boolean(toolbarTarget);

  useLayoutEffect(() => {
    if (!isVisible) {
      return;
    }

    measureToolbar(toolbarRef.current, setToolbarSize);
  }, [isVisible, matchedSnapshot]);

  useEffect(() => {
    if (!isVisible) {
      return undefined;
    }

    const node = toolbarRef.current;
    if (!node || typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const resizeObserver = new ResizeObserver(() => {
      measureToolbar(node, setToolbarSize);
      setLayoutRevision((revision) => revision + 1);
    });
    resizeObserver.observe(node);
    return () => resizeObserver.disconnect();
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) {
      return undefined;
    }

    let frameId: number | null = null;
    const bumpLayoutRevision = (): void => {
      if (frameId !== null) {
        return;
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        setLayoutRevision((revision) => revision + 1);
      });
    };
    const root = toolbarRef.current?.getRootNode();
    const previewStage = root && 'querySelector' in root
      ? (root as ParentNode).querySelector<HTMLElement>('[data-ai-id="copy-ai-id-editor-preview-stage"]')
      : null;

    window.addEventListener('resize', bumpLayoutRevision, { passive: true });
    window.addEventListener('scroll', bumpLayoutRevision, { capture: true, passive: true });
    previewStage?.addEventListener('scroll', bumpLayoutRevision, { passive: true });

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      window.removeEventListener('resize', bumpLayoutRevision);
      window.removeEventListener('scroll', bumpLayoutRevision, true);
      previewStage?.removeEventListener('scroll', bumpLayoutRevision);
    };
  }, [isVisible]);

  const placementStyle = useMemo<CSSProperties | null>(() => {
    if (!toolbarTarget) {
      return null;
    }

    const anchorRect = resolveToolbarAnchorRect(toolbarTarget.elementRect, toolbarTarget.editorRect);
    if (!anchorRect) {
      return null;
    }

    const placement = calculateFloatingOverlayPlacement(anchorRect, toolbarSize, {
      mode: 'target',
      gap: TOOLBAR_GAP_PX,
    });

    return {
      left: `${Math.round(placement.left)}px`,
      top: `${Math.round(placement.top)}px`,
      transformOrigin: placement.transformOrigin,
    };
    // layoutRevision/zoom re-run the live-DOM geometry conversion.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolbarTarget, toolbarSize, layoutRevision, zoom]);

  if (!toolbarTarget || !reference || !placementStyle) {
    return null;
  }

  const messages = getCurrentMessages().visualEditor;
  const intents = matchedSnapshot?.intents?.length
    ? matchedSnapshot.intents
    : toolbarTarget.intents;
  const controls = resolveQuickToolbarControls(intents);

  const commitStyle = (property: string, value: string, category: QuickActionCategory): void => {
    const normalized = normalizeVisualStyleValue(value);
    const current = matchedSnapshot
      ? normalizeVisualStyleValue(
        matchedSnapshot.inlineStyle[property]
        ?? matchedSnapshot.computedStyle[property]
        ?? '',
      )
      : null;
    if (current !== null && normalized === current) {
      return;
    }

    dispatchVisualStyleMutation({
      reference,
      snapshot: matchedSnapshot,
      source: 'quick-action-bar',
      category,
      declarations: [{ property, value: normalized }],
    });
  };

  const runStructureOperation = (operation: QuickActionStructureOperation): void => {
    dispatchQuickActionStructureOperation(reference, operation);
  };

  const openMorePanel = (): void => {
    const selectionStore = useVisualSelectionStore.getState();
    selectionStore.openPanelForTarget({
      target: toolbarTarget.target,
      nodeId: toolbarTarget.nodeId,
      category: 'layout',
      elementRect: toolbarTarget.elementRect,
      editorRect: toolbarTarget.editorRect,
    });

    const floatingNotePanel = useFloatingNotePanelStore.getState();
    if (floatingNotePanel.enabled && floatingNotePanel.isOpen) {
      floatingNotePanel.closePanel();
    }

    useFloatingVisualPanelStore.getState().openPanel();
    if (!matchedSnapshot) {
      requestVisualTargetSnapshot(reference);
    }
  };

  const handleGripPointerDown = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      dragging: false,
    };
  };

  const handleGripPointerMove = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    if (!drag.dragging) {
      const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
      if (distance < DRAG_THRESHOLD_PX) {
        return;
      }
      drag.dragging = true;
    }

    const bridgePoint = bridgePointWithinPreview(event.clientX, event.clientY);
    if (bridgePoint) {
      previewQuickActionDragMoveFromBridgePoint(reference, bridgePoint);
    } else {
      clearQuickActionDragMovePreview();
    }
  };

  const handleGripPointerUp = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    dragStateRef.current = null;
    if (!drag.dragging) {
      return;
    }

    const bridgePoint = bridgePointWithinPreview(event.clientX, event.clientY);
    if (bridgePoint) {
      dispatchQuickActionDragMoveFromBridgePoint(reference, bridgePoint);
    } else {
      clearQuickActionDragMovePreview();
    }
  };

  const handleGripPointerCancel = (): void => {
    dragStateRef.current = null;
    clearQuickActionDragMovePreview();
  };

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[118]"
      data-ai-id="copy-ai-id-editor-quick-toolbar-layer"
    >
      <div
        ref={toolbarRef}
        className="pointer-events-auto fixed flex flex-col gap-1.5 rounded-xl border border-blue-500/30 bg-[color:var(--ai-editor-chrome-bg)] p-2 text-gray-100 shadow-[0_14px_40px_rgba(0,0,0,0.5)] ring-1 ring-white/5 backdrop-blur-md"
        style={placementStyle}
        role="toolbar"
        aria-label={messages.quickToolbar.toolbarLabel}
        data-ai-id="copy-ai-id-editor-quick-toolbar"
        data-copy-ai-id-visual-focus-guard="true"
      >
        <div className="flex flex-wrap items-center gap-1.5" data-ai-id="copy-ai-id-editor-quick-toolbar-intent-row">
          {controls.map((control) => (
            <QuickToolbarControl
              key={control}
              control={control}
              reference={reference}
              snapshot={matchedSnapshot}
              stepper={stepper}
              commitStyle={commitStyle}
            />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5" data-ai-id="copy-ai-id-editor-quick-toolbar-common-row">
          {QUICK_TOOLBAR_SPACING_GROUPS.map((group) => (
            <SpacingPopover
              key={group}
              group={group}
              snapshot={matchedSnapshot}
              stepper={stepper}
              disabled={!matchedSnapshot}
              dataAiId={`copy-ai-id-editor-quick-toolbar-spacing-${group}`}
            />
          ))}
          <span className="mx-0.5 h-5 w-px shrink-0 bg-gray-600/70" aria-hidden="true" data-ai-id="copy-ai-id-editor-quick-toolbar-divider-1" />
          {QUICK_TOOLBAR_STRUCTURE_OPERATIONS.map((operation) => (
            <button
              key={operation}
              type="button"
              className="flex h-7 items-center rounded-md border border-gray-600 bg-gray-900 px-2 text-[11px] font-semibold text-gray-200 transition hover:bg-gray-800 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 disabled:cursor-not-allowed disabled:opacity-40"
              title={messages.quickActions.structure[operation].title}
              aria-label={messages.quickActions.structure[operation].title}
              disabled={isStructureOperationDisabled(operation, matchedSnapshot)}
              onClick={() => runStructureOperation(operation)}
              data-ai-id={`copy-ai-id-editor-quick-toolbar-structure-${operation}-button`}
            >
              {messages.quickActions.structure[operation].label}
            </button>
          ))}
          <button
            type="button"
            className="flex h-7 cursor-grab touch-none items-center rounded-md border border-gray-600 bg-gray-900 px-1.5 text-sm text-gray-300 transition hover:bg-gray-800 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 active:cursor-grabbing"
            title={messages.quickToolbar.dragHandleTitle}
            aria-label={messages.quickToolbar.dragHandleTitle}
            onPointerDown={handleGripPointerDown}
            onPointerMove={handleGripPointerMove}
            onPointerUp={handleGripPointerUp}
            onPointerCancel={handleGripPointerCancel}
            data-ai-id="copy-ai-id-editor-quick-toolbar-drag-grip-button"
          >
            ⠿
          </button>
          <span className="mx-0.5 h-5 w-px shrink-0 bg-gray-600/70" aria-hidden="true" data-ai-id="copy-ai-id-editor-quick-toolbar-divider-2" />
          <button
            type="button"
            className="flex h-7 items-center rounded-md border border-blue-500/50 bg-blue-600/30 px-2.5 text-[11px] font-semibold text-blue-50 transition hover:bg-blue-600/50 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70"
            title={messages.quickToolbar.moreTitle}
            onClick={openMorePanel}
            data-ai-id="copy-ai-id-editor-quick-toolbar-more-button"
          >
            {messages.quickToolbar.more}
          </button>
        </div>
      </div>
    </div>
  );
}

function QuickToolbarControl({
  control,
  reference,
  snapshot,
  stepper,
  commitStyle,
}: {
  control: QuickToolbarControlId;
  reference: EditorTargetReference;
  snapshot: VisualTargetSnapshot | null;
  stepper: ToolbarStepperApi;
  commitStyle: (property: string, value: string, category: QuickActionCategory) => void;
}): ReactElement | null {
  const messages = getCurrentMessages().visualEditor.quickToolbar;
  const disabled = !snapshot;
  const computed = (property: string): string => snapshot?.computedStyle[property] ?? '';

  switch (control) {
    case 'image-replace':
      return (
        <AttributeEditPopover
          label={messages.controls.imageReplace}
          fields={[
            { name: 'src', label: messages.attribute.imageSrcLabel, placeholder: 'https://…' },
            { name: 'alt', label: messages.attribute.imageAltLabel },
          ]}
          reference={reference}
          snapshot={snapshot}
          disabled={disabled}
          dataAiId="copy-ai-id-editor-quick-toolbar-image-replace"
        />
      );
    case 'width':
    case 'height':
      return (
        <SizeHybridControl
          dimension={control}
          reference={reference}
          snapshot={snapshot}
          stepper={stepper}
          disabled={disabled}
          dataAiId={`copy-ai-id-editor-quick-toolbar-${control}`}
          commitKeyword={commitStyle}
        />
      );
    case 'object-fit':
      return (
        <SegmentControl
          options={[
            { value: 'cover', label: 'Cover' },
            { value: 'contain', label: 'Contain' },
            { value: 'fill', label: 'Fill' },
          ]}
          value={computed('object-fit') || null}
          ariaLabel={messages.controls.objectFit}
          disabled={disabled}
          dataAiId="copy-ai-id-editor-quick-toolbar-object-fit"
          onChange={(value) => commitStyle('object-fit', value, 'size')}
        />
      );
    case 'radius':
      return (
        <StepperControl
          label={messages.controls.radius}
          displayValue={formatStepperLengthDisplay(computed('border-radius'))}
          disabled={disabled}
          dataAiId="copy-ai-id-editor-quick-toolbar-radius-stepper"
          onStep={(direction) => stepper.stepProperty({ property: 'border-radius', category: 'border' }, direction)}
        />
      );
    case 'font-size':
      return (
        <StepperControl
          label={messages.controls.fontSize}
          displayValue={formatStepperLengthDisplay(computed('font-size'))}
          disabled={disabled}
          dataAiId="copy-ai-id-editor-quick-toolbar-font-size-stepper"
          onStep={(direction) => stepper.stepProperty({ property: 'font-size', category: 'style' }, direction)}
        />
      );
    case 'font-weight':
      return (
        <SegmentControl
          options={[
            { value: '400', label: '400' },
            { value: '500', label: '500' },
            { value: '600', label: '600' },
            { value: '700', label: '700' },
          ]}
          value={normalizeFontWeight(computed('font-weight'))}
          ariaLabel={messages.controls.fontWeight}
          disabled={disabled}
          dataAiId="copy-ai-id-editor-quick-toolbar-font-weight"
          onChange={(value) => commitStyle('font-weight', value, 'style')}
        />
      );
    case 'text-color':
      return (
        <ColorSwatchControl
          label={messages.controls.textColor}
          value={computed('color')}
          disabled={disabled}
          dataAiId="copy-ai-id-editor-quick-toolbar-text-color"
          onCommit={(value) => commitStyle('color', value, 'style')}
        />
      );
    case 'text-align':
      return (
        <SegmentControl
          options={[
            { value: 'left', label: 'L', title: `${messages.controls.textAlign}: left` },
            { value: 'center', label: 'C', title: `${messages.controls.textAlign}: center` },
            { value: 'right', label: 'R', title: `${messages.controls.textAlign}: right` },
            { value: 'justify', label: 'J', title: `${messages.controls.textAlign}: justify` },
          ]}
          value={normalizeTextAlign(computed('text-align'))}
          ariaLabel={messages.controls.textAlign}
          disabled={disabled}
          dataAiId="copy-ai-id-editor-quick-toolbar-text-align"
          onChange={(value) => commitStyle('text-align', value, 'style')}
        />
      );
    case 'gap':
      return (
        <StepperControl
          label={messages.controls.gap}
          displayValue={formatStepperLengthDisplay(computed('row-gap'))}
          disabled={disabled}
          dataAiId="copy-ai-id-editor-quick-toolbar-gap-stepper"
          onStep={(direction) => stepper.stepProperty({
            property: 'gap',
            computedProperty: 'row-gap',
            category: 'spacing',
          }, direction)}
        />
      );
    case 'flex-direction':
      return (
        <SegmentControl
          options={[
            { value: 'row', label: '→', title: `${messages.controls.flexDirection}: row` },
            { value: 'column', label: '↓', title: `${messages.controls.flexDirection}: column` },
          ]}
          value={computed('flex-direction') || null}
          ariaLabel={messages.controls.flexDirection}
          disabled={disabled}
          dataAiId="copy-ai-id-editor-quick-toolbar-flex-direction"
          onChange={(value) => commitStyle('flex-direction', value, 'layout')}
        />
      );
    case 'justify-content':
      return (
        <SegmentControl
          options={[
            { value: 'flex-start', label: 'S', title: `${messages.controls.justifyContent}: flex-start` },
            { value: 'center', label: 'C', title: `${messages.controls.justifyContent}: center` },
            { value: 'flex-end', label: 'E', title: `${messages.controls.justifyContent}: flex-end` },
            { value: 'space-between', label: 'SB', title: `${messages.controls.justifyContent}: space-between` },
          ]}
          value={normalizeFlexAlignment(computed('justify-content'))}
          ariaLabel={messages.controls.justifyContent}
          disabled={disabled}
          dataAiId="copy-ai-id-editor-quick-toolbar-justify-content"
          onChange={(value) => commitStyle('justify-content', value, 'layout')}
        />
      );
    case 'align-items':
      return (
        <SegmentControl
          options={[
            { value: 'flex-start', label: 'S', title: `${messages.controls.alignItems}: flex-start` },
            { value: 'center', label: 'C', title: `${messages.controls.alignItems}: center` },
            { value: 'flex-end', label: 'E', title: `${messages.controls.alignItems}: flex-end` },
            { value: 'stretch', label: 'ST', title: `${messages.controls.alignItems}: stretch` },
          ]}
          value={normalizeFlexAlignment(computed('align-items'))}
          ariaLabel={messages.controls.alignItems}
          disabled={disabled}
          dataAiId="copy-ai-id-editor-quick-toolbar-align-items"
          onChange={(value) => commitStyle('align-items', value, 'layout')}
        />
      );
    case 'background-color':
      return (
        <ColorSwatchControl
          label={messages.controls.backgroundColor}
          value={computed('background-color')}
          disabled={disabled}
          dataAiId="copy-ai-id-editor-quick-toolbar-background-color"
          onCommit={(value) => commitStyle('background-color', value, 'style')}
        />
      );
    case 'href-edit':
      return (
        <AttributeEditPopover
          label={messages.controls.hrefEdit}
          fields={[{ name: 'href', label: messages.attribute.hrefLabel, placeholder: 'https://…' }]}
          reference={reference}
          snapshot={snapshot}
          disabled={disabled}
          dataAiId="copy-ai-id-editor-quick-toolbar-href-edit"
        />
      );
    case 'placeholder-edit':
      return (
        <AttributeEditPopover
          label={messages.controls.placeholderEdit}
          fields={[{ name: 'placeholder', label: messages.attribute.placeholderLabel }]}
          reference={reference}
          snapshot={snapshot}
          disabled={disabled}
          dataAiId="copy-ai-id-editor-quick-toolbar-placeholder-edit"
        />
      );
    default:
      return null;
  }
}

function isStructureOperationDisabled(
  operation: QuickActionStructureOperation,
  snapshot: VisualTargetSnapshot | null,
): boolean {
  if (!snapshot) {
    return operation === 'move-up' || operation === 'move-down';
  }

  if (operation === 'move-up') {
    return !snapshot.previousSibling;
  }

  if (operation === 'move-down') {
    return !snapshot.nextSibling;
  }

  return false;
}

function resolveToolbarAnchorRect(
  elementRect: Parameters<typeof bridgeViewportRectToEditorViewportRect>[0],
  editorRect: EditorViewportRect | null,
): EditorViewportRect | null {
  return bridgeViewportRectToEditorViewportRect(elementRect) ?? editorRect;
}

function bridgePointWithinPreview(clientX: number, clientY: number): { x: number; y: number } | null {
  const point = editorViewportPointToBridgeViewportPoint({ x: clientX, y: clientY });
  if (!point) {
    return null;
  }

  const geometry = getPreviewWorkspaceGeometrySnapshot();
  if (!geometry) {
    return null;
  }

  if (point.x < 0 || point.y < 0 || point.x > geometry.iframeClientWidth || point.y > geometry.iframeClientHeight) {
    return null;
  }

  return point;
}

function normalizeFontWeight(value: string): string | null {
  if (value === 'normal') {
    return '400';
  }

  if (value === 'bold') {
    return '700';
  }

  return value || null;
}

function normalizeTextAlign(value: string): string | null {
  if (value === 'start') {
    return 'left';
  }

  if (value === 'end') {
    return 'right';
  }

  return value || null;
}

function normalizeFlexAlignment(value: string): string | null {
  if (value === 'normal') {
    return null;
  }

  if (value === 'start') {
    return 'flex-start';
  }

  if (value === 'end') {
    return 'flex-end';
  }

  return value || null;
}

function measureToolbar(
  node: HTMLElement | null,
  setToolbarSize: (updater: (current: OverlaySize) => OverlaySize) => void,
): void {
  if (!node) {
    return;
  }

  const rect = node.getBoundingClientRect();
  const width = Math.ceil(rect.width || node.offsetWidth || DEFAULT_TOOLBAR_SIZE.width);
  const height = Math.ceil(rect.height || node.offsetHeight || DEFAULT_TOOLBAR_SIZE.height);

  setToolbarSize((current) => (
    current.width === width && current.height === height
      ? current
      : { width, height }
  ));
}
