import { useEffect, useState, type ReactElement } from 'react';

import type { EditorTargetReference } from '../../../shared/domain/targets';
import type {
  QuickActionCategory,
  VisualTargetSnapshot,
} from '../../../shared/domain/visual';
import { formatStepperLengthDisplay } from '../../utils/stepperMath';
import { dispatchVisualAttributeMutation } from '../../visual/visualMutationClient';
import { showEditorToast } from '../../toast';
import { StepperControl } from '../visual/StepperControl';
import { SegmentControl } from './SegmentControl';
import { ToolbarPopover } from './ToolbarPopover';
import type { ToolbarStepperApi } from './useToolbarStepper';

export interface AttributeField {
  name: string;
  label: string;
  placeholder?: string;
}

export interface AttributeEditPopoverProps {
  label: string;
  fields: readonly AttributeField[];
  reference: EditorTargetReference | null;
  snapshot: VisualTargetSnapshot | null;
  disabled?: boolean;
  dataAiId: string;
}

// Popover editing allowlisted attributes (src/alt, href, placeholder) through
// the regular attribute mutation path (sanitized in shared/visual-attributes).
export function AttributeEditPopover({
  label,
  fields,
  reference,
  snapshot,
  disabled = false,
  dataAiId,
}: AttributeEditPopoverProps): ReactElement {
  return (
    <ToolbarPopover
      label={label}
      dataAiId={dataAiId}
      disabled={disabled}
      panelWidthPx={260}
      buttonContent={<span>{label}</span>}
    >
      {(close) => (
        <AttributeEditForm
          fields={fields}
          reference={reference}
          snapshot={snapshot}
          applyLabel="적용"
          dataAiId={dataAiId}
          onApplied={close}
        />
      )}
    </ToolbarPopover>
  );
}

function AttributeEditForm({
  fields,
  reference,
  snapshot,
  applyLabel,
  dataAiId,
  onApplied,
}: {
  fields: readonly AttributeField[];
  reference: EditorTargetReference | null;
  snapshot: VisualTargetSnapshot | null;
  applyLabel: string;
  dataAiId: string;
  onApplied: () => void;
}): ReactElement {
  const [drafts, setDrafts] = useState<Record<string, string>>(() => currentAttributeValues(fields, snapshot));

  useEffect(() => {
    setDrafts(currentAttributeValues(fields, snapshot));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot?.nodeId, snapshot?.attributes]);

  const apply = (): void => {
    if (!reference) {
      return;
    }

    const current = currentAttributeValues(fields, snapshot);
    let appliedCount = 0;
    for (const field of fields) {
      const draft = (drafts[field.name] ?? '').trim();
      if (draft === (current[field.name] ?? '')) {
        continue;
      }

      try {
        dispatchVisualAttributeMutation({
          reference,
          snapshot,
          source: 'quick-action-bar',
          attribute: {
            name: field.name,
            value: draft === '' ? null : draft,
          },
        });
        appliedCount += 1;
      } catch (error) {
        showEditorToast(error instanceof Error ? error.message : 'Attribute edit failed.', 'error');
      }
    }

    if (appliedCount > 0) {
      onApplied();
    }
  };

  return (
    <div className="flex flex-col gap-2" data-ai-id={`${dataAiId}-form`}>
      {fields.map((field) => (
        <label key={field.name} className="flex flex-col gap-1" data-ai-id={`${dataAiId}-${field.name}-field`}>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-300" data-ai-id={`${dataAiId}-${field.name}-label-text`}>
            {field.label}
          </span>
          <input
            type="text"
            className="h-7 rounded border border-gray-600 bg-gray-900 px-2 text-[11px] text-gray-100 outline-none placeholder:text-gray-500 focus:border-blue-500/70"
            value={drafts[field.name] ?? ''}
            placeholder={field.placeholder}
            onChange={(event) => setDrafts((current) => ({
              ...current,
              [field.name]: event.currentTarget.value,
            }))}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                apply();
              }
            }}
            data-ai-id={`${dataAiId}-${field.name}-input`}
          />
        </label>
      ))}
      <button
        type="button"
        className="h-7 self-end rounded border border-blue-500/60 bg-blue-600/40 px-2.5 text-[11px] font-semibold text-white transition hover:bg-blue-600/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70"
        onClick={apply}
        data-ai-id={`${dataAiId}-apply-button`}
      >
        {applyLabel}
      </button>
    </div>
  );
}

function currentAttributeValues(
  fields: readonly AttributeField[],
  snapshot: VisualTargetSnapshot | null,
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of fields) {
    values[field.name] = snapshot?.attributes[field.name]
      ?? fallbackAttributeValue(field.name, snapshot)
      ?? '';
  }
  return values;
}

function fallbackAttributeValue(name: string, snapshot: VisualTargetSnapshot | null): string | undefined {
  if (!snapshot) {
    return undefined;
  }

  if (name === 'src') {
    return snapshot.image?.src;
  }

  if (name === 'alt') {
    return snapshot.image?.alt;
  }

  if (name === 'href') {
    return snapshot.link?.href;
  }

  return undefined;
}

export interface SizeHybridControlProps {
  dimension: 'width' | 'height';
  reference: EditorTargetReference | null;
  snapshot: VisualTargetSnapshot | null;
  stepper: ToolbarStepperApi;
  disabled?: boolean;
  dataAiId: string;
  commitKeyword: (property: string, value: string, category: QuickActionCategory) => void;
}

const SIZE_KEYWORD_VALUES = {
  auto: 'auto',
  full: '100%',
  fitContent: 'fit-content',
} as const;

// W/H hybrid: keyword segment (auto / 100% / fit-content) records a concrete
// value; the stepper starts the percent-intent model from the computed size.
export function SizeHybridControl({
  dimension,
  reference,
  snapshot,
  stepper,
  disabled = false,
  dataAiId,
  commitKeyword,
}: SizeHybridControlProps): ReactElement {
  const label = dimension === 'width' ? '너비' : '높이';
  const computedValue = snapshot?.computedStyle[dimension] ?? '';
  const inlineValue = snapshot?.inlineStyle[dimension] ?? '';
  const category: QuickActionCategory = 'size';
  const activeKeyword = Object.entries(SIZE_KEYWORD_VALUES)
    .find(([, keywordValue]) => inlineValue === keywordValue)?.[1] ?? null;

  return (
    <ToolbarPopover
      label={label}
      dataAiId={dataAiId}
      disabled={disabled}
      panelWidthPx={236}
      buttonContent={(
        <span className="flex items-baseline gap-1">
          <span>{label}</span>
          <span className="font-mono text-[10px] text-gray-300" data-ai-id={`${dataAiId}-current-value-text`}>
            {formatStepperLengthDisplay(computedValue)}
          </span>
        </span>
      )}
    >
      <div className="flex flex-col gap-2.5" data-ai-id={`${dataAiId}-panel-body`}>
        <SegmentControl
          options={[
            { value: SIZE_KEYWORD_VALUES.auto, label: '자동' },
            { value: SIZE_KEYWORD_VALUES.full, label: '꽉 차게' },
            { value: SIZE_KEYWORD_VALUES.fitContent, label: '내용만큼' },
          ]}
          value={activeKeyword}
          ariaLabel={label}
          disabled={disabled || !reference}
          dataAiId={`${dataAiId}-keyword-segment`}
          onChange={(keywordValue) => commitKeyword(dimension, keywordValue, category)}
        />
        <div className="flex items-center justify-between gap-2" data-ai-id={`${dataAiId}-stepper-row`}>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-300" data-ai-id={`${dataAiId}-stepper-label-text`}>
            {label}
          </span>
          <StepperControl
            label={label}
            displayValue={formatStepperLengthDisplay(computedValue)}
            disabled={disabled || !snapshot}
            dataAiId={`${dataAiId}-stepper`}
            onStep={(direction) => stepper.stepProperty({ property: dimension, category }, direction)}
          />
        </div>
      </div>
    </ToolbarPopover>
  );
}
