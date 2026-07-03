import { useState, type ReactElement } from 'react';

import type { VisualTargetSnapshot } from '../../../shared/domain/visual';
import { formatStepperLengthDisplay } from '../../utils/stepperMath';
import { StepperControl } from '../visual/StepperControl';
import { SegmentControl } from './SegmentControl';
import { ToolbarPopover } from './ToolbarPopover';
import {
  spacingPropertiesForScope,
  type QuickToolbarSpacingGroup,
  type QuickToolbarSpacingScope,
} from './toolbarConfig';
import type { ToolbarStepperApi } from './useToolbarStepper';

export interface SpacingPopoverProps {
  group: QuickToolbarSpacingGroup;
  snapshot: VisualTargetSnapshot | null;
  stepper: ToolbarStepperApi;
  disabled?: boolean;
  dataAiId: string;
}

const GROUP_LABELS: Record<QuickToolbarSpacingGroup, string> = {
  padding: '패딩',
  margin: '마진',
  gap: '간격',
};

const SCOPE_LABELS: Record<QuickToolbarSpacingScope, string> = {
  all: '전체',
  x: '좌우',
  y: '위아래',
  each: '개별',
};

const EDGES = [
  { suffix: 'top', label: '위' },
  { suffix: 'right', label: '오른쪽' },
  { suffix: 'bottom', label: '아래' },
  { suffix: 'left', label: '왼쪽' },
] as const;

// Padding/Margin/Gap popover: scope segment (all / left-right / top-bottom /
// each edge) with steppers that commit every affected property in a single
// updateVisualStyle mutation per click.
export function SpacingPopover({
  group,
  snapshot,
  stepper,
  disabled = false,
  dataAiId,
}: SpacingPopoverProps): ReactElement {
  const [scope, setScope] = useState<QuickToolbarSpacingScope>('all');
  const groupLabel = GROUP_LABELS[group];
  const scopeOptions = (group === 'gap'
    ? (['all', 'x', 'y'] as const)
    : (['all', 'x', 'y', 'each'] as const)
  ).map((candidate) => ({
    value: candidate,
    label: SCOPE_LABELS[candidate],
  }));
  const activeScope: QuickToolbarSpacingScope = group === 'gap' && scope === 'each' ? 'all' : scope;
  const category = 'spacing' as const;

  return (
    <ToolbarPopover
      label={groupLabel}
      dataAiId={dataAiId}
      disabled={disabled}
      panelWidthPx={252}
      buttonContent={<span>{groupLabel}</span>}
    >
      <div className="flex flex-col gap-2.5" data-ai-id={`${dataAiId}-panel-body`}>
        <SegmentControl
          options={scopeOptions}
          value={activeScope}
          ariaLabel={groupLabel}
          dataAiId={`${dataAiId}-scope-segment`}
          onChange={(nextScope) => setScope(nextScope as QuickToolbarSpacingScope)}
        />
        {activeScope === 'each' && group !== 'gap' ? (
          <div className="grid grid-cols-2 gap-1.5" data-ai-id={`${dataAiId}-edge-grid`}>
            {EDGES.map((edge) => {
              const property = `${group}-${edge.suffix}`;
              return (
                <div key={edge.suffix} className="flex items-center justify-between gap-1.5" data-ai-id={`${dataAiId}-${edge.suffix}-row`}>
                  <span className="text-[10px] font-semibold text-gray-300" data-ai-id={`${dataAiId}-${edge.suffix}-label-text`}>
                    {edge.label}
                  </span>
                  <StepperControl
                    label={`${groupLabel} ${edge.label}`}
                    displayValue={displayValueFor(snapshot, property)}
                    disabled={disabled}
                    dataAiId={`${dataAiId}-${edge.suffix}-stepper`}
                    onStep={(direction) => stepper.stepProperty({ property, category }, direction)}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2" data-ai-id={`${dataAiId}-scoped-row`}>
            <span className="text-[10px] font-semibold text-gray-300" data-ai-id={`${dataAiId}-scoped-label-text`}>
              {SCOPE_LABELS[activeScope]}
            </span>
            <StepperControl
              label={`${groupLabel} ${SCOPE_LABELS[activeScope]}`}
              displayValue={displayValueFor(snapshot, spacingPropertiesForScope(group, activeScope)[0])}
              disabled={disabled}
              dataAiId={`${dataAiId}-scoped-stepper`}
              onStep={(direction) => stepper.stepProperties({
                properties: spacingPropertiesForScope(group, activeScope),
                category,
              }, direction)}
            />
          </div>
        )}
      </div>
    </ToolbarPopover>
  );
}

function displayValueFor(snapshot: VisualTargetSnapshot | null, property: string | undefined): string {
  if (!snapshot || !property) {
    return '–';
  }

  return formatStepperLengthDisplay(snapshot.computedStyle[property] ?? '');
}
