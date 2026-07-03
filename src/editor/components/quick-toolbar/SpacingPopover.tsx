import { useState, type ReactElement } from 'react';

import type { VisualTargetSnapshot } from '../../../shared/domain/visual';
import { getCurrentMessages } from '../../../shared/i18n';
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

const EDGE_PROPERTY_SUFFIXES = ['top', 'right', 'bottom', 'left'] as const;

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
  const messages = getCurrentMessages().visualEditor.quickToolbar;
  const [scope, setScope] = useState<QuickToolbarSpacingScope>('all');
  const groupLabel = messages.spacing[group];
  const scopeOptions = (group === 'gap'
    ? (['all', 'x', 'y'] as const)
    : (['all', 'x', 'y', 'each'] as const)
  ).map((candidate) => ({
    value: candidate,
    label: scopeLabel(candidate),
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
            {EDGE_PROPERTY_SUFFIXES.map((edge) => {
              const property = `${group}-${edge}`;
              return (
                <div key={edge} className="flex items-center justify-between gap-1.5" data-ai-id={`${dataAiId}-${edge}-row`}>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-300" data-ai-id={`${dataAiId}-${edge}-label-text`}>
                    {messages.spacing[edge]}
                  </span>
                  <StepperControl
                    label={`${groupLabel} ${messages.spacing[edge]}`}
                    displayValue={displayValueFor(snapshot, property)}
                    disabled={disabled}
                    dataAiId={`${dataAiId}-${edge}-stepper`}
                    onStep={(direction) => stepper.stepProperty({ property, category }, direction)}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2" data-ai-id={`${dataAiId}-scoped-row`}>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-300" data-ai-id={`${dataAiId}-scoped-label-text`}>
              {scopeLabel(activeScope)}
            </span>
            <StepperControl
              label={`${groupLabel} ${scopeLabel(activeScope)}`}
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

  function scopeLabel(candidate: QuickToolbarSpacingScope): string {
    switch (candidate) {
      case 'x':
        return messages.spacing.scopeX;
      case 'y':
        return messages.spacing.scopeY;
      case 'each':
        return messages.spacing.scopeEach;
      case 'all':
      default:
        return messages.spacing.scopeAll;
    }
  }
}

function displayValueFor(snapshot: VisualTargetSnapshot | null, property: string | undefined): string {
  if (!snapshot || !property) {
    return '–';
  }

  return formatStepperLengthDisplay(snapshot.computedStyle[property] ?? '');
}
