import type { ReactElement } from 'react';

import { UnitValueInput, type UnitOption } from './UnitValueInput';
import { VisualControl, VisualResetButton } from './VisualControl';

export type VisualEdge = 'top' | 'right' | 'bottom' | 'left';
export type VisualEdgeValues = Record<VisualEdge, string>;
export type VisualEdgeUnits = Record<VisualEdge, string>;

export type EdgeBoxControlProps = {
  label: string;
  dataAiId: string;
  values: VisualEdgeValues;
  units: VisualEdgeUnits;
  allowedUnits: UnitOption[];
  disabled?: boolean;
  helperText?: string;
  layout?: 'grid' | 'stacked-icons';
  onValueChange?: (edge: VisualEdge, value: string) => void;
  onUnitChange?: (edge: VisualEdge, unit: string) => void;
  onCommit?: () => void;
  onResetEdge?: (edge: VisualEdge) => void;
  onResetAll?: () => void;
  onEdgeHighlightChange?: (edge: VisualEdge, active: boolean) => void;
};

const EDGE_ORDER: VisualEdge[] = ['top', 'right', 'bottom', 'left'];
const EDGE_LABELS: Record<VisualEdge, string> = {
  top: 'Top',
  right: 'Right',
  bottom: 'Bottom',
  left: 'Left',
};

export function EdgeBoxControl({
  label,
  dataAiId,
  values,
  units,
  allowedUnits,
  disabled = false,
  helperText,
  layout = 'grid',
  onValueChange,
  onUnitChange,
  onCommit,
  onResetEdge,
  onResetAll,
  onEdgeHighlightChange,
}: EdgeBoxControlProps): ReactElement {
  const stackedWithIcons = layout === 'stacked-icons';

  return (
    <VisualControl
      label={label}
      dataAiId={dataAiId}
      helperText={helperText}
      disabled={disabled}
      actions={onResetAll ? <VisualResetButton dataAiId={`${dataAiId}-reset-button`} disabled={disabled} onClick={onResetAll} /> : undefined}
    >
      <div className="space-y-3" data-ai-id={`${dataAiId}-edge-box`}>
        <div className={stackedWithIcons ? 'space-y-2.5' : 'grid grid-cols-2 gap-2.5'} data-ai-id={`${dataAiId}-edge-grid`}>
          {EDGE_ORDER.map((edge) => (
            <UnitValueInput
              key={edge}
              label={EDGE_LABELS[edge]}
              dataAiId={`${dataAiId}-${edge}-input`}
              value={values[edge]}
              unit={units[edge]}
              units={allowedUnits}
              disabled={disabled}
              valueReadOnly={units[edge] === 'auto'}
              placeholder={units[edge] === 'auto' ? 'auto' : '0'}
              leadingControl={stackedWithIcons ? <EdgeDirectionIcon edge={edge} dataAiId={`${dataAiId}-${edge}-input-leading-icon`} /> : undefined}
              labelLayout={stackedWithIcons ? 'inline' : 'stacked'}
              onValueChange={(value) => onValueChange?.(edge, value)}
              onUnitChange={(unit) => onUnitChange?.(edge, unit)}
              onCommit={onCommit}
              onReset={onResetEdge ? () => onResetEdge(edge) : undefined}
              onHighlightChange={onEdgeHighlightChange ? (active) => onEdgeHighlightChange(edge, active) : undefined}
            />
          ))}
        </div>
      </div>
    </VisualControl>
  );
}

function EdgeDirectionIcon({ edge, dataAiId }: { edge: VisualEdge; dataAiId: string }): ReactElement {
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center" aria-hidden="true" data-ai-id={`${dataAiId}-wrapper`}>
      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none" data-ai-id={dataAiId}>
        <rect
          x="5"
          y="5"
          width="10"
          height="10"
          rx="2"
          stroke="currentColor"
          strokeOpacity="0.45"
          strokeWidth="1.3"
          data-ai-id={`${dataAiId}-box-rect`}
        />
        <path d={edgeHighlightPath(edge)} stroke="#93c5fd" strokeWidth="2" strokeLinecap="round" data-ai-id={`${dataAiId}-highlight-path`} />
        <path
          d={edgeArrowPath(edge)}
          stroke="#bfdbfe"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          data-ai-id={`${dataAiId}-arrow-path`}
        />
      </svg>
    </span>
  );
}

function edgeHighlightPath(edge: VisualEdge): string {
  switch (edge) {
    case 'top':
      return 'M6.5 5h7';
    case 'right':
      return 'M15 6.5v7';
    case 'bottom':
      return 'M6.5 15h7';
    case 'left':
      return 'M5 6.5v7';
  }
}

function edgeArrowPath(edge: VisualEdge): string {
  switch (edge) {
    case 'top':
      return 'M10 2.75v3.5M8.5 4.25 10 2.75l1.5 1.5';
    case 'right':
      return 'M17.25 10h-3.5M15.75 8.5l1.5 1.5-1.5 1.5';
    case 'bottom':
      return 'M10 17.25v-3.5M8.5 15.75l1.5 1.5 1.5-1.5';
    case 'left':
      return 'M2.75 10h3.5M4.25 8.5 2.75 10l1.5 1.5';
  }
}
