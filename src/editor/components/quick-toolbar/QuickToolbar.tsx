import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Copy,
  GripVertical,
  SlidersHorizontal,
  Trash2,
  type LucideIcon,
} from 'lucide-react';

import type { EditorTargetReference } from '../../../shared/domain/targets';
import type {
  QuickActionCategory,
  QuickActionStructureOperation,
  VisualTargetSnapshot,
} from '../../../shared/domain/visual';
import { hasSameEditorTarget } from '../../../shared/editor-targets';
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
import { AlignmentControl } from './AlignmentControl';
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

const DEFAULT_TOOLBAR_SIZE: OverlaySize = { width: 420, height: 112 };
const TOOLBAR_GAP_PX = 10;
const DRAG_THRESHOLD_PX = 8;

// Labels are intentionally hardcoded Korean (single-locale UI by product
// decision) and every control shows its meaning without hover tooltips.
const STRUCTURE_BUTTONS: Record<QuickActionStructureOperation, { label: string; Icon: LucideIcon }> = {
  duplicate: { label: '복제', Icon: Copy },
  'move-up': { label: '위로', Icon: ArrowUp },
  'move-down': { label: '아래로', Icon: ArrowDown },
  delete: { label: '삭제', Icon: Trash2 },
};

interface DragGripState {
  pointerId: number;
  startX: number;
  startY: number;
  dragging: boolean;
}

// Editor-side floating quick toolbar. Anchored to the pinned preview element
// (bridge streams 'repositioned' rects while pinned); row 1 is composed from
// the element's intents, row 2 is the shared spacing strip, row 3 holds
// structure actions and the 모든 옵션 panel opener.
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
      elementRect: toolbarTarget.elementRect,
      editorRect: toolbarTarget.editorRect,
    });

    const floatingNotePanel = useFloatingNotePanelStore.getState();
    if (floatingNotePanel.enabled && floatingNotePanel.isOpen) {
      floatingNotePanel.closePanel();
    }

    useFloatingVisualPanelStore.getState().openPanel(intents.includes('image') ? 'image' : undefined);
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
        aria-label="빠른 편집 툴바"
        data-ai-id="copy-ai-id-editor-quick-toolbar"
        data-copy-ai-id-visual-focus-guard="true"
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5" data-ai-id="copy-ai-id-editor-quick-toolbar-intent-row">
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
        <div className="flex flex-wrap items-center gap-1.5" data-ai-id="copy-ai-id-editor-quick-toolbar-spacing-row">
          <span className="text-[10px] font-semibold text-gray-400" data-ai-id="copy-ai-id-editor-quick-toolbar-spacing-label-text">
            여백
          </span>
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
        </div>
        <div className="flex flex-wrap items-center gap-1.5" data-ai-id="copy-ai-id-editor-quick-toolbar-common-row">
          {QUICK_TOOLBAR_STRUCTURE_OPERATIONS.map((operation) => {
            const { label, Icon } = STRUCTURE_BUTTONS[operation];
            return (
              <button
                key={operation}
                type="button"
                className="flex h-7 items-center gap-1 rounded-md border border-gray-600 bg-gray-900 px-2 text-[11px] font-semibold text-gray-200 transition hover:bg-gray-800 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={isStructureOperationDisabled(operation, matchedSnapshot)}
                onClick={() => runStructureOperation(operation)}
                data-ai-id={`copy-ai-id-editor-quick-toolbar-structure-${operation}-button`}
              >
                <Icon size={12} aria-hidden="true" />
                {label}
              </button>
            );
          })}
          <button
            type="button"
            className="flex h-7 cursor-grab touch-none items-center gap-1 rounded-md border border-gray-600 bg-gray-900 px-2 text-[11px] font-semibold text-gray-200 transition hover:bg-gray-800 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 active:cursor-grabbing"
            onPointerDown={handleGripPointerDown}
            onPointerMove={handleGripPointerMove}
            onPointerUp={handleGripPointerUp}
            onPointerCancel={handleGripPointerCancel}
            data-ai-id="copy-ai-id-editor-quick-toolbar-drag-grip-button"
          >
            <GripVertical size={12} aria-hidden="true" />
            드래그
          </button>
          <span className="mx-0.5 h-5 w-px shrink-0 bg-gray-600/70" aria-hidden="true" data-ai-id="copy-ai-id-editor-quick-toolbar-divider-1" />
          <button
            type="button"
            className="flex h-7 items-center gap-1 rounded-md border border-blue-500/50 bg-blue-600/30 px-2.5 text-[11px] font-semibold text-blue-50 transition hover:bg-blue-600/50 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70"
            onClick={openMorePanel}
            data-ai-id="copy-ai-id-editor-quick-toolbar-more-button"
          >
            <SlidersHorizontal size={12} aria-hidden="true" />
            모든 옵션
          </button>
        </div>
      </div>
    </div>
  );
}

// Small always-visible label chip in front of a control whose body cannot
// carry its own text (steppers, icon segments).
function LabeledControl({
  label,
  dataAiId,
  children,
}: {
  label: string;
  dataAiId: string;
  children: ReactNode;
}): ReactElement {
  return (
    <div className="flex items-center gap-1" data-ai-id={dataAiId}>
      <span className="shrink-0 text-[10px] font-semibold text-gray-400" data-ai-id={`${dataAiId}-label-text`}>
        {label}
      </span>
      {children}
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
  const disabled = !snapshot;
  const computed = (property: string): string => snapshot?.computedStyle[property] ?? '';

  switch (control) {
    case 'image-replace':
      return (
        <AttributeEditPopover
          label="이미지 바꾸기"
          fields={[
            { name: 'src', label: '이미지 주소', placeholder: 'https://…' },
            { name: 'alt', label: '이미지 설명' },
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
        <LabeledControl label="맞춤" dataAiId="copy-ai-id-editor-quick-toolbar-object-fit-control">
          <SegmentControl
            options={[
              { value: 'cover', label: '꽉 채우기' },
              { value: 'contain', label: '모두 보기' },
              { value: 'fill', label: '늘리기' },
            ]}
            value={computed('object-fit') || null}
            ariaLabel="이미지 맞춤"
            disabled={disabled}
            dataAiId="copy-ai-id-editor-quick-toolbar-object-fit"
            onChange={(value) => commitStyle('object-fit', value, 'size')}
          />
        </LabeledControl>
      );
    case 'radius':
      return (
        <LabeledControl label="둥글기" dataAiId="copy-ai-id-editor-quick-toolbar-radius-control">
          <StepperControl
            label="모서리 둥글기"
            displayValue={formatStepperLengthDisplay(computed('border-radius'))}
            disabled={disabled}
            dataAiId="copy-ai-id-editor-quick-toolbar-radius-stepper"
            onStep={(direction) => stepper.stepProperty({ property: 'border-radius', category: 'border' }, direction)}
          />
        </LabeledControl>
      );
    case 'font-size':
      return (
        <LabeledControl label="글자 크기" dataAiId="copy-ai-id-editor-quick-toolbar-font-size-control">
          <StepperControl
            label="글자 크기"
            displayValue={formatStepperLengthDisplay(computed('font-size'))}
            disabled={disabled}
            dataAiId="copy-ai-id-editor-quick-toolbar-font-size-stepper"
            onStep={(direction) => stepper.stepProperty({ property: 'font-size', category: 'style' }, direction)}
          />
        </LabeledControl>
      );
    case 'font-weight':
      return (
        <LabeledControl label="굵기" dataAiId="copy-ai-id-editor-quick-toolbar-font-weight-control">
          <SegmentControl
            options={[
              { value: '400', label: <span style={{ fontWeight: 400 }}>가</span>, ariaLabel: '보통 굵기' },
              { value: '500', label: <span style={{ fontWeight: 500 }}>가</span>, ariaLabel: '조금 굵게' },
              { value: '600', label: <span style={{ fontWeight: 600 }}>가</span>, ariaLabel: '굵게' },
              { value: '700', label: <span style={{ fontWeight: 700 }}>가</span>, ariaLabel: '아주 굵게' },
            ]}
            value={normalizeFontWeight(computed('font-weight'))}
            ariaLabel="글자 굵기"
            disabled={disabled}
            dataAiId="copy-ai-id-editor-quick-toolbar-font-weight"
            onChange={(value) => commitStyle('font-weight', value, 'style')}
          />
        </LabeledControl>
      );
    case 'text-color':
      return (
        <ColorSwatchControl
          label="글자색"
          value={computed('color')}
          disabled={disabled}
          dataAiId="copy-ai-id-editor-quick-toolbar-text-color"
          onCommit={(value) => commitStyle('color', value, 'style')}
        />
      );
    case 'text-align':
      return (
        <LabeledControl label="정렬" dataAiId="copy-ai-id-editor-quick-toolbar-text-align-control">
          <SegmentControl
            options={[
              { value: 'left', label: <AlignLeft size={13} aria-hidden="true" />, ariaLabel: '왼쪽 정렬' },
              { value: 'center', label: <AlignCenter size={13} aria-hidden="true" />, ariaLabel: '가운데 정렬' },
              { value: 'right', label: <AlignRight size={13} aria-hidden="true" />, ariaLabel: '오른쪽 정렬' },
              { value: 'justify', label: <AlignJustify size={13} aria-hidden="true" />, ariaLabel: '양쪽 맞춤' },
            ]}
            value={normalizeTextAlign(computed('text-align'))}
            ariaLabel="글자 정렬"
            disabled={disabled}
            dataAiId="copy-ai-id-editor-quick-toolbar-text-align"
            onChange={(value) => commitStyle('text-align', value, 'style')}
          />
        </LabeledControl>
      );
    case 'flex-direction':
      return (
        <LabeledControl label="방향" dataAiId="copy-ai-id-editor-quick-toolbar-flex-direction-control">
          <SegmentControl
            options={[
              {
                value: 'row',
                label: (
                  <span className="flex items-center gap-1">
                    <ArrowRight size={12} aria-hidden="true" />
                    가로
                  </span>
                ),
              },
              {
                value: 'column',
                label: (
                  <span className="flex items-center gap-1">
                    <ArrowDown size={12} aria-hidden="true" />
                    세로
                  </span>
                ),
              },
            ]}
            value={computed('flex-direction') || null}
            ariaLabel="배치 방향"
            disabled={disabled}
            dataAiId="copy-ai-id-editor-quick-toolbar-flex-direction"
            onChange={(value) => commitStyle('flex-direction', value, 'layout')}
          />
        </LabeledControl>
      );
    case 'alignment':
      return (
        <AlignmentControl
          reference={reference}
          snapshot={snapshot}
          disabled={disabled}
          dataAiId="copy-ai-id-editor-quick-toolbar-alignment"
        />
      );
    case 'background-color':
      return (
        <ColorSwatchControl
          label="배경색"
          value={computed('background-color')}
          disabled={disabled}
          dataAiId="copy-ai-id-editor-quick-toolbar-background-color"
          onCommit={(value) => commitStyle('background-color', value, 'style')}
        />
      );
    case 'href-edit':
      return (
        <AttributeEditPopover
          label="링크"
          fields={[{ name: 'href', label: '링크 주소', placeholder: 'https://…' }]}
          reference={reference}
          snapshot={snapshot}
          disabled={disabled}
          dataAiId="copy-ai-id-editor-quick-toolbar-href-edit"
        />
      );
    case 'placeholder-edit':
      return (
        <AttributeEditPopover
          label="안내 문구"
          fields={[{ name: 'placeholder', label: '안내 문구' }]}
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
