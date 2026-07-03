import type { CSSProperties, ReactElement } from 'react';

import type { EditorTargetReference } from '../../../shared/domain/targets';
import type { VisualTargetSnapshot } from '../../../shared/domain/visual';
import { dispatchVisualStyleMutation } from '../../visual/visualMutationClient';
import { ToolbarPopover } from './ToolbarPopover';

export interface AlignmentControlProps {
  reference: EditorTargetReference | null;
  snapshot: VisualTargetSnapshot | null;
  disabled?: boolean;
  dataAiId: string;
}

type AxisValue = 'flex-start' | 'center' | 'flex-end';

const AXIS_VALUES: readonly AxisValue[] = ['flex-start', 'center', 'flex-end'];

const AXIS_LABELS: Record<AxisValue, string> = {
  'flex-start': '앞',
  center: '가운데',
  'flex-end': '끝',
};

// Figma-style alignment picker: a 3×3 grid of live flexbox previews that sets
// justify-content + align-items in one click, plus 양끝/늘리기 toggles for
// space-between and stretch. The mini bars inside each cell are laid out with
// the exact CSS the click would apply, so the result is visible before
// clicking — no tooltips needed.
export function AlignmentControl({
  reference,
  snapshot,
  disabled = false,
  dataAiId,
}: AlignmentControlProps): ReactElement {
  const direction: 'row' | 'column' = (snapshot?.computedStyle['flex-direction'] ?? 'row').startsWith('column')
    ? 'column'
    : 'row';
  const justify = normalizeAxisValue(snapshot?.computedStyle['justify-content']);
  const align = normalizeAxisValue(snapshot?.computedStyle['align-items']);
  const isSpaceBetween = snapshot?.computedStyle['justify-content'] === 'space-between';
  const isStretch = (snapshot?.computedStyle['align-items'] ?? '').includes('stretch')
    || snapshot?.computedStyle['align-items'] === 'normal';

  const commitDeclarations = (declarations: Array<{ property: string; value: string }>): void => {
    if (!reference) {
      return;
    }

    dispatchVisualStyleMutation({
      reference,
      snapshot,
      source: 'quick-action-bar',
      category: 'layout',
      declarations,
    });
  };

  // Elements that are not flex/grid yet would silently ignore alignment, so
  // the first alignment click also turns the element into a flex container.
  const displayDeclarations = (): Array<{ property: string; value: string }> => {
    const display = snapshot?.computedStyle.display ?? '';
    if (display.includes('flex') || display.includes('grid')) {
      return [];
    }

    return [{ property: 'display', value: 'flex' }];
  };

  const commitCell = (cellJustify: AxisValue, cellAlign: AxisValue): void => {
    commitDeclarations([
      ...displayDeclarations(),
      { property: 'justify-content', value: cellJustify },
      { property: 'align-items', value: cellAlign },
    ]);
  };

  return (
    <ToolbarPopover
      label="정렬"
      dataAiId={dataAiId}
      disabled={disabled}
      panelWidthPx={168}
      buttonContent={(
        <span className="flex items-center gap-1.5">
          <AlignmentPreview direction={direction} justify={justify} align={align} compact />
          <span>정렬</span>
        </span>
      )}
    >
      <div className="flex flex-col gap-2" data-ai-id={`${dataAiId}-panel-body`}>
        <div
          className="grid grid-cols-3 gap-1"
          role="group"
          aria-label="정렬 위치"
          data-ai-id={`${dataAiId}-grid`}
        >
          {AXIS_VALUES.map((rowValue) => AXIS_VALUES.map((columnValue) => {
            // Grid columns always read left→right and rows top→bottom, so the
            // main axis maps to columns in row direction and to rows in
            // column direction.
            const cellJustify = direction === 'row' ? columnValue : rowValue;
            const cellAlign = direction === 'row' ? rowValue : columnValue;
            const active = !isSpaceBetween && justify === cellJustify && (isStretch ? false : align === cellAlign);

            return (
              <button
                key={`${rowValue}-${columnValue}`}
                type="button"
                className={`flex h-10 items-center justify-center rounded-md border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 ${
                  active
                    ? 'border-blue-400/80 bg-blue-600/40'
                    : 'border-gray-700 bg-gray-900 hover:border-gray-500 hover:bg-gray-800'
                }`}
                aria-pressed={active}
                aria-label={`${direction === 'row' ? '가로' : '세로'} ${AXIS_LABELS[cellJustify]}, 교차 ${AXIS_LABELS[cellAlign]}`}
                disabled={disabled}
                onClick={() => commitCell(cellJustify, cellAlign)}
                data-ai-id={`${dataAiId}-cell-${cellJustify}-${cellAlign}-button`}
              >
                <AlignmentPreview direction={direction} justify={cellJustify} align={cellAlign} />
              </button>
            );
          }))}
        </div>
        <div className="flex gap-1" data-ai-id={`${dataAiId}-extras-row`}>
          <AlignmentToggle
            label="양끝 벌리기"
            active={isSpaceBetween}
            disabled={disabled}
            dataAiId={`${dataAiId}-space-between-button`}
            onClick={() => commitDeclarations([
              ...displayDeclarations(),
              { property: 'justify-content', value: 'space-between' },
            ])}
          />
          <AlignmentToggle
            label="늘려 채우기"
            active={isStretch}
            disabled={disabled}
            dataAiId={`${dataAiId}-stretch-button`}
            onClick={() => commitDeclarations([
              ...displayDeclarations(),
              { property: 'align-items', value: 'stretch' },
            ])}
          />
        </div>
      </div>
    </ToolbarPopover>
  );
}

function AlignmentToggle({
  label,
  active,
  disabled,
  dataAiId,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  dataAiId: string;
  onClick: () => void;
}): ReactElement {
  return (
    <button
      type="button"
      className={`h-6 flex-1 rounded-md border px-1 text-[10px] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 ${
        active
          ? 'border-blue-400/80 bg-blue-600/40 text-white'
          : 'border-gray-700 bg-gray-900 text-gray-300 hover:border-gray-500 hover:bg-gray-800 hover:text-gray-100'
      }`}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      data-ai-id={dataAiId}
    >
      {label}
    </button>
  );
}

// Three mini bars laid out with the exact flexbox values a cell represents.
function AlignmentPreview({
  direction,
  justify,
  align,
  compact = false,
}: {
  direction: 'row' | 'column';
  justify: AxisValue;
  align: AxisValue;
  compact?: boolean;
}): ReactElement {
  const boxStyle: CSSProperties = {
    display: 'flex',
    flexDirection: direction,
    justifyContent: justify,
    alignItems: align,
    gap: compact ? '1px' : '2px',
  };
  const barSizes = compact ? [5, 7, 4] : [8, 12, 6];

  return (
    <span
      className={compact ? 'h-3.5 w-3.5 shrink-0' : 'h-7 w-7'}
      style={boxStyle}
      aria-hidden="true"
    >
      {barSizes.map((size, index) => (
        <span
          key={index}
          className="shrink-0 rounded-[1px] bg-current opacity-80"
          style={direction === 'row'
            ? { width: compact ? '2px' : '3px', height: `${size}px` }
            : { height: compact ? '2px' : '3px', width: `${size}px` }}
        />
      ))}
    </span>
  );
}

function normalizeAxisValue(value: string | undefined): AxisValue {
  if (!value) {
    return 'flex-start';
  }

  if (value === 'center') {
    return 'center';
  }

  if (value === 'flex-end' || value === 'end' || value === 'right') {
    return 'flex-end';
  }

  return 'flex-start';
}
