import { useCallback, type ReactElement, type ReactNode } from 'react';

import type {
  VisualBoxEdge,
  VisualBoxRegion,
} from '../../../shared/domain/visual';
import {
  MARGIN_UNITS,
  SPACING_UNITS,
  useVisualStyleForm,
  type EdgeGroupApi,
  type LengthFieldApi,
} from '../../forms/useVisualStyleForm';
import { clearVisualBoxRegionHighlight, highlightVisualBoxRegion } from '../../visual/boxModelHighlight';
import { useStyleEdit } from '../../visual/useStyleEdit';
import { EdgeBoxControl } from '../visual/EdgeBoxControl';
import { UnitValueInput } from '../visual/UnitValueInput';

export type SpacingControlsProps = {
  disabled?: boolean;
};

const SPACING_PRESETS = [
  { label: '0', value: '0', unit: 'px' },
  { label: '4', value: '4', unit: 'px' },
  { label: '8', value: '8', unit: 'px' },
  { label: '16', value: '16', unit: 'px' },
  { label: '24', value: '24', unit: 'px' },
] as const;

const MARGIN_PRESETS = [
  ...SPACING_PRESETS,
  { label: 'auto', value: '', unit: 'auto' },
] as const;

export function SpacingControls({ disabled = false }: SpacingControlsProps): ReactElement {
  const form = useVisualStyleForm();
  const edit = useStyleEdit();
  const canEdit = edit.canEdit && !disabled;
  const gapDisabled = !canEdit || !form.gapEnabled;
  const highlight = useCallback((region: VisualBoxRegion, edge: VisualBoxEdge | undefined, active: boolean) => {
    if (!active) {
      clearVisualBoxRegionHighlight();
      return;
    }

    highlightVisualBoxRegion(edit.target, region, edge);
  }, [edit.target]);

  return (
    <div className="space-y-4" data-ai-id="copy-ai-id-editor-spacing-controls">
      <BoxModelRegionLegend
        disabled={!canEdit}
        gapEnabled={form.gapEnabled}
        onHighlightChange={(region, active) => highlight(region, undefined, active)}
      />

      <SpacingControlGroup
        title="Padding"
        description="선택 요소 내부 여백을 top/right/bottom/left 별로 조정합니다."
        dataAiId="copy-ai-id-editor-spacing-padding-group"
      >
        <EdgePresetRow
          dataAiId="copy-ai-id-editor-spacing-padding-presets"
          group={form.padding}
          presets={SPACING_PRESETS}
          disabled={!canEdit}
          onHighlightChange={(active) => highlight('padding', undefined, active)}
        />
        <EdgeBoxControl
          label="Padding edges"
          dataAiId="copy-ai-id-editor-visual-padding"
          values={form.padding.values}
          units={form.padding.units}
          allowedUnits={SPACING_UNITS}
          disabled={!canEdit}
          helperText="각 입력을 blur하거나 Enter를 누르면 preview iframe에 padding inline style이 적용됩니다."
          layout="stacked-icons"
          onValueChange={form.padding.setValue}
          onUnitChange={form.padding.setUnit}
          onCommit={form.padding.commit}
          onResetEdge={form.padding.resetEdge}
          onResetAll={form.padding.resetAll}
          onEdgeHighlightChange={(edge, active) => highlight('padding', edge, active)}
        />
      </SpacingControlGroup>

      <SpacingControlGroup
        title="Margin"
        description="선택 요소 바깥 여백을 top/right/bottom/left 별로 조정합니다."
        dataAiId="copy-ai-id-editor-spacing-margin-group"
      >
        <EdgePresetRow
          dataAiId="copy-ai-id-editor-spacing-margin-presets"
          group={form.margin}
          presets={MARGIN_PRESETS}
          disabled={!canEdit}
          onHighlightChange={(active) => highlight('margin', undefined, active)}
        />
        <EdgeBoxControl
          label="Margin edges"
          dataAiId="copy-ai-id-editor-visual-margin"
          values={form.margin.values}
          units={form.margin.units}
          allowedUnits={MARGIN_UNITS}
          disabled={!canEdit}
          helperText="margin은 auto 값을 지원합니다. 음수 margin은 직접 입력하면 그대로 CSS 값으로 기록됩니다."
          layout="stacked-icons"
          onValueChange={form.margin.setValue}
          onUnitChange={form.margin.setUnit}
          onCommit={form.margin.commit}
          onResetEdge={form.margin.resetEdge}
          onResetAll={form.margin.resetAll}
          onEdgeHighlightChange={(edge, active) => highlight('margin', edge, active)}
        />
      </SpacingControlGroup>

      <SpacingControlGroup
        title="Gap"
        description="flex/grid 컨테이너의 row-gap과 column-gap을 조정합니다."
        dataAiId="copy-ai-id-editor-spacing-gap-group"
        tone={form.gapEnabled ? 'active' : 'muted'}
      >
        {!form.gapEnabled ? (
          <SpacingHint dataAiId="copy-ai-id-editor-spacing-gap-disabled-hint">
            Gap은 현재 display가 flex, inline-flex, grid, inline-grid일 때 적용됩니다. 레이아웃 탭에서 Display를 먼저 바꾸면 활성화됩니다.
          </SpacingHint>
        ) : null}
        <div className="grid grid-cols-2 gap-3" data-ai-id="copy-ai-id-editor-spacing-gap-grid">
          <GapField
            label="Row gap"
            dataAiId="copy-ai-id-editor-visual-row-gap"
            field={form.gapY}
            disabled={gapDisabled}
            helperText={form.gapEnabled ? '행 사이 간격입니다.' : 'Flex/Grid에서 활성화됩니다.'}
            onHighlightChange={(active) => highlight('gap', 'row', active)}
          />
          <GapField
            label="Column gap"
            dataAiId="copy-ai-id-editor-visual-column-gap"
            field={form.gapX}
            disabled={gapDisabled}
            helperText={form.gapEnabled ? '열 사이 간격입니다.' : 'Flex/Grid에서 활성화됩니다.'}
            onHighlightChange={(active) => highlight('gap', 'column', active)}
          />
        </div>
        <div
          className="flex flex-wrap gap-1.5"
          data-ai-id="copy-ai-id-editor-spacing-gap-presets"
          onMouseEnter={() => {
            if (!gapDisabled) {
              highlight('gap', undefined, true);
            }
          }}
          onMouseLeave={() => {
            if (!gapDisabled) {
              highlight('gap', undefined, false);
            }
          }}
          onFocus={() => {
            if (!gapDisabled) {
              highlight('gap', undefined, true);
            }
          }}
          onBlur={(event) => {
            if (!gapDisabled && !event.currentTarget.contains(event.relatedTarget as Node | null)) {
              highlight('gap', undefined, false);
            }
          }}
        >
          {SPACING_PRESETS.map((preset) => (
            <button
              key={`${preset.value}${preset.unit}`}
              type="button"
              className="rounded-full border border-gray-700 bg-gray-950/70 px-2 py-1 text-[10px] font-bold text-gray-400 transition hover:border-blue-500/40 hover:bg-blue-500/10 hover:text-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={gapDisabled}
              onClick={() => {
                const value = composePresetValue(preset.value, preset.unit);
                form.gapY.setValue(preset.value);
                form.gapX.setValue(preset.value);
                edit.commitStyles([
                  { propertyId: 'row-gap', value },
                  { propertyId: 'column-gap', value },
                ], {
                  category: 'spacing',
                  control: { id: 'spacing:gap', label: 'Gap' },
                });
              }}
              data-ai-id="copy-ai-id-editor-spacing-gap-preset-button"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </SpacingControlGroup>
    </div>
  );
}

type SpacingControlGroupProps = {
  title: string;
  description: string;
  dataAiId: string;
  children: ReactNode;
  tone?: 'active' | 'muted';
};

function SpacingControlGroup({
  title,
  description,
  dataAiId,
  children,
  tone = 'active',
}: SpacingControlGroupProps): ReactElement {
  return (
    <section
      className={`rounded-xl border p-3.5 shadow-sm ${
        tone === 'active'
          ? 'border-gray-800 bg-gray-950/45'
          : 'border-dashed border-gray-800/90 bg-gray-950/25'
      }`}
      data-ai-id={dataAiId}
      data-ai-editor-spacing-control-group-tone={tone}
    >
      <div className="mb-3" data-ai-id={`${dataAiId}-header`}>
        <h4 className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-300" data-ai-id={`${dataAiId}-title-text`}>
          {title}
        </h4>
        <p className="mt-1 text-[11px] leading-relaxed text-gray-500" data-ai-id={`${dataAiId}-description-text`}>
          {description}
        </p>
      </div>
      <div className="space-y-3" data-ai-id={`${dataAiId}-body`}>
        {children}
      </div>
    </section>
  );
}

const REGION_LEGEND: Array<{
  region: VisualBoxRegion;
  label: string;
  className: string;
}> = [
  { region: 'margin', label: 'Margin', className: 'border-orange-300/40 bg-orange-300/15 text-orange-100' },
  { region: 'padding', label: 'Padding', className: 'border-green-300/40 bg-green-300/15 text-green-100' },
  { region: 'content', label: 'Content', className: 'border-sky-300/40 bg-sky-300/15 text-sky-100' },
  { region: 'gap', label: 'Gap', className: 'border-violet-300/40 bg-violet-300/15 text-violet-100' },
];

function BoxModelRegionLegend({
  disabled,
  gapEnabled,
  onHighlightChange,
}: {
  disabled: boolean;
  gapEnabled: boolean;
  onHighlightChange: (region: VisualBoxRegion, active: boolean) => void;
}): ReactElement {
  return (
    <div
      className="rounded-xl border border-gray-800 bg-gray-950/35 p-3"
      data-ai-id="copy-ai-id-editor-spacing-box-model-legend"
    >
      <div className="mb-2 flex items-center justify-between gap-2" data-ai-id="copy-ai-id-editor-spacing-box-model-legend-header">
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400" data-ai-id="copy-ai-id-editor-spacing-box-model-legend-title">
          Box model hover map
        </span>
        <span className="text-[10px] text-gray-600" data-ai-id="copy-ai-id-editor-spacing-box-model-legend-help">
          hover/focus to preview
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5" data-ai-id="copy-ai-id-editor-spacing-box-model-legend-chips">
        {REGION_LEGEND.map(({ region, label, className }) => {
          const regionDisabled = disabled || (region === 'gap' && !gapEnabled);
          return (
            <button
              key={region}
              type="button"
              className={`rounded-full border px-2 py-1 text-[10px] font-bold transition focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
              disabled={regionDisabled}
              onMouseEnter={() => onHighlightChange(region, true)}
              onMouseLeave={() => onHighlightChange(region, false)}
              onFocus={() => onHighlightChange(region, true)}
              onBlur={() => onHighlightChange(region, false)}
              data-ai-id={`copy-ai-id-editor-spacing-box-model-${region}-legend-chip`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

type EdgePreset = {
  label: string;
  value: string;
  unit: string;
};

function EdgePresetRow({
  dataAiId,
  group,
  presets,
  disabled,
  onHighlightChange,
}: {
  dataAiId: string;
  group: EdgeGroupApi;
  presets: readonly EdgePreset[];
  disabled: boolean;
  onHighlightChange?: (active: boolean) => void;
}): ReactElement {
  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      data-ai-id={dataAiId}
      onMouseEnter={() => onHighlightChange?.(true)}
      onMouseLeave={() => onHighlightChange?.(false)}
      onFocus={() => onHighlightChange?.(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          onHighlightChange?.(false);
        }
      }}
    >
      <span className="mr-1 text-[10px] font-bold uppercase tracking-[0.12em] text-gray-500" data-ai-id={`${dataAiId}-label-text`}>
        All
      </span>
      {presets.map((preset) => (
        <button
          key={`${preset.value}${preset.unit}`}
          type="button"
          className="rounded-full border border-gray-700 bg-gray-950/70 px-2 py-1 text-[10px] font-bold text-gray-400 transition hover:border-blue-500/40 hover:bg-blue-500/10 hover:text-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={disabled}
          onClick={() => {
            group.setAll(preset.value, preset.unit);
            group.commitAll(preset.value, preset.unit);
          }}
          data-ai-id={`${dataAiId}-button`}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}

function GapField({
  label,
  dataAiId,
  field,
  disabled,
  helperText,
  onHighlightChange,
}: {
  label: string;
  dataAiId: string;
  field: LengthFieldApi;
  disabled: boolean;
  helperText: string;
  onHighlightChange: (active: boolean) => void;
}): ReactElement {
  return (
    <UnitValueInput
      label={label}
      dataAiId={dataAiId}
      value={field.value}
      unit={field.unit}
      units={SPACING_UNITS}
      disabled={disabled}
      helperText={helperText}
      placeholder="0"
      onValueChange={field.setValue}
      onUnitChange={field.setUnit}
      onCommit={field.commit}
      onReset={field.reset}
      onHighlightChange={onHighlightChange}
    />
  );
}

function SpacingHint({ dataAiId, children }: { dataAiId: string; children: ReactNode }): ReactElement {
  return (
    <p
      className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-100/80"
      data-ai-id={dataAiId}
    >
      {children}
    </p>
  );
}

function composePresetValue(value: string, unit: string): string {
  if (unit === 'auto') {
    return 'auto';
  }
  return /^-?\d*\.?\d+$/.test(value) ? `${value}${unit}` : value;
}
