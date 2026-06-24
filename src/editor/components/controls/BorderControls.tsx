import { useEffect, useState, type ReactElement } from 'react';
import {
  BORDER_WIDTH_UNITS,
  RADIUS_UNITS,
  useVisualStyleForm,
  type EdgeGroupApi,
  type VisualCorner,
} from '../../forms/useVisualStyleForm';
import { useStyleEdit } from '../../visual/useStyleEdit';
import { ColorInput, type ColorPresetOption } from '../visual/ColorInput';
import { EdgeBoxControl } from '../visual/EdgeBoxControl';
import { UnitValueInput } from '../visual/UnitValueInput';
import { CssPresetSelect, StyleControlGroup } from './styleControlHelpers';

export type BorderControlsProps = {
  disabled?: boolean;
};

const BORDER_STYLE_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'dotted', label: 'Dotted' },
  { value: 'double', label: 'Double' },
  { value: 'groove', label: 'Groove' },
  { value: 'ridge', label: 'Ridge' },
  { value: 'inset', label: 'Inset' },
  { value: 'outset', label: 'Outset' },
];

const BORDER_WIDTH_PRESETS = [
  { label: '0', value: '0', unit: 'px' },
  { label: '1', value: '1', unit: 'px' },
  { label: '2', value: '2', unit: 'px' },
  { label: '4', value: '4', unit: 'px' },
  { label: '8', value: '8', unit: 'px' },
] as const;

const RADIUS_PRESETS = [
  { label: '0', value: '0', unit: 'px' },
  { label: '4', value: '4', unit: 'px' },
  { label: '8', value: '8', unit: 'px' },
  { label: '12', value: '12', unit: 'px' },
  { label: '16', value: '16', unit: 'px' },
  { label: '50%', value: '50', unit: '%' },
] as const;

const COLOR_PRESETS: ColorPresetOption[] = [
  { value: 'transparent', label: 'Transparent' },
  { value: 'currentColor', label: 'Current color' },
  { value: '#000000', label: 'Black' },
  { value: '#ffffff', label: 'White' },
  { value: '#ef4444', label: 'Red' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#10b981', label: 'Green' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#8b5cf6', label: 'Violet' },
];

const RADIUS_PROPERTIES = [
  'border-top-left-radius',
  'border-top-right-radius',
  'border-bottom-right-radius',
  'border-bottom-left-radius',
] as const;

const RADIUS_CORNERS: Array<{ corner: VisualCorner; label: string; dataAiId: string }> = [
  { corner: 'topLeft', label: 'Top left', dataAiId: 'copy-ai-id-editor-visual-radius-top-left' },
  { corner: 'topRight', label: 'Top right', dataAiId: 'copy-ai-id-editor-visual-radius-top-right' },
  { corner: 'bottomRight', label: 'Bottom right', dataAiId: 'copy-ai-id-editor-visual-radius-bottom-right' },
  { corner: 'bottomLeft', label: 'Bottom left', dataAiId: 'copy-ai-id-editor-visual-radius-bottom-left' },
];

export function BorderControls({ disabled = false }: BorderControlsProps): ReactElement {
  const form = useVisualStyleForm();
  const edit = useStyleEdit();
  const canEdit = edit.canEdit && !disabled;
  const commitRadiusPreset = (preset: EdgePreset): void => {
    const value = composePresetValue(preset.value, preset.unit);
    form.radius.setValue(preset.value);
    edit.commitStyles(RADIUS_PROPERTIES.map((propertyId) => ({
      propertyId,
      value,
    })), {
      category: 'border',
      control: { id: 'border:radius', label: 'Border radius' },
    });
  };

  return (
    <div className="space-y-4" data-ai-id="copy-ai-id-editor-border-controls">
      <StyleControlGroup
        title="Border width"
        description="선택 요소의 테두리 굵기를 top/right/bottom/left 별로 조정합니다."
        dataAiId="copy-ai-id-editor-border-width-group"
      >
        <EdgePresetRow
          dataAiId="copy-ai-id-editor-border-width-presets"
          group={form.borderWidth}
          presets={BORDER_WIDTH_PRESETS}
          disabled={!canEdit}
        />
        <EdgeBoxControl
          label="Border edges"
          dataAiId="copy-ai-id-editor-visual-border-width"
          values={form.borderWidth.values}
          units={form.borderWidth.units}
          allowedUnits={BORDER_WIDTH_UNITS}
          disabled={!canEdit}
          helperText="각 edge 입력은 border-*-width inline CSS로 기록됩니다."
          layout="stacked-icons"
          onValueChange={form.borderWidth.setValue}
          onUnitChange={form.borderWidth.setUnit}
          onCommit={form.borderWidth.commit}
          onResetEdge={form.borderWidth.resetEdge}
          onResetAll={form.borderWidth.resetAll}
        />
      </StyleControlGroup>

      <StyleControlGroup
        title="Border style / color"
        description="테두리 선 종류와 색상을 설정합니다."
        dataAiId="copy-ai-id-editor-border-style-color-group"
      >
        <CssPresetSelect
          property="border-style"
          label="Border style"
          dataAiId="copy-ai-id-editor-visual-border-style"
          disabled={!canEdit}
          options={BORDER_STYLE_OPTIONS}
          category="border"
          controlPrefix="border"
        />
        <BorderColorInput
          property="border-color"
          label="Border color"
          dataAiId="copy-ai-id-editor-visual-border-color"
          disabled={!canEdit}
          helperText="색상은 border-color CSS 값으로 저장됩니다."
        />
      </StyleControlGroup>

      <StyleControlGroup
        title="Radius"
        description="모서리 둥글기를 전체 또는 네 모서리별로 조정합니다."
        dataAiId="copy-ai-id-editor-border-radius-group"
      >
        <RadiusPresetRow
          dataAiId="copy-ai-id-editor-border-radius-presets"
          disabled={!canEdit}
          onSelect={commitRadiusPreset}
        />
        <UnitValueInput
          label="All corners"
          dataAiId="copy-ai-id-editor-visual-border-radius-all"
          value={form.radius.value}
          unit={form.radius.unit}
          units={RADIUS_UNITS}
          disabled={!canEdit}
          helperText="전체 모서리에 같은 border-radius 값을 적용합니다."
          onValueChange={form.radius.setValue}
          onUnitChange={form.radius.setUnit}
          onCommit={form.radius.commit}
          onReset={form.radius.reset}
        />
        <div className="grid grid-cols-2 gap-3" data-ai-id="copy-ai-id-editor-border-radius-corner-grid">
          {RADIUS_CORNERS.map((item) => {
            const field = form.radiusCorners[item.corner];
            return (
              <UnitValueInput
                key={item.corner}
                label={item.label}
                dataAiId={item.dataAiId}
                value={field.value}
                unit={field.unit}
                units={RADIUS_UNITS}
                disabled={!canEdit}
                placeholder="0"
                onValueChange={field.setValue}
                onUnitChange={field.setUnit}
                onCommit={field.commit}
                onReset={field.reset}
              />
            );
          })}
        </div>
      </StyleControlGroup>

      <StyleControlGroup
        title="Outline"
        description="레이아웃에 영향을 덜 주는 outline width/style/color/offset 값을 설정합니다."
        dataAiId="copy-ai-id-editor-border-outline-group"
      >
        <div className="grid grid-cols-2 gap-3" data-ai-id="copy-ai-id-editor-border-outline-grid">
          <UnitValueInput
            label="Outline width"
            dataAiId="copy-ai-id-editor-visual-outline-width"
            value={form.outlineWidth.value}
            unit={form.outlineWidth.unit}
            units={BORDER_WIDTH_UNITS}
            disabled={!canEdit}
            placeholder="0"
            onValueChange={form.outlineWidth.setValue}
            onUnitChange={form.outlineWidth.setUnit}
            onCommit={form.outlineWidth.commit}
            onReset={form.outlineWidth.reset}
          />
          <UnitValueInput
            label="Outline offset"
            dataAiId="copy-ai-id-editor-visual-outline-offset"
            value={form.outlineOffset.value}
            unit={form.outlineOffset.unit}
            units={BORDER_WIDTH_UNITS}
            disabled={!canEdit}
            placeholder="0"
            onValueChange={form.outlineOffset.setValue}
            onUnitChange={form.outlineOffset.setUnit}
            onCommit={form.outlineOffset.commit}
            onReset={form.outlineOffset.reset}
          />
        </div>
        <CssPresetSelect
          property="outline-style"
          label="Outline style"
          dataAiId="copy-ai-id-editor-visual-outline-style"
          disabled={!canEdit}
          options={BORDER_STYLE_OPTIONS}
          category="border"
          controlPrefix="border"
        />
        <BorderColorInput
          property="outline-color"
          label="Outline color"
          dataAiId="copy-ai-id-editor-visual-outline-color"
          disabled={!canEdit}
          helperText="색상은 outline-color CSS 값으로 저장됩니다."
        />
      </StyleControlGroup>
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
}: {
  dataAiId: string;
  group: EdgeGroupApi;
  presets: readonly EdgePreset[];
  disabled: boolean;
}): ReactElement {
  return (
    <div className="flex flex-wrap items-center gap-1.5" data-ai-id={dataAiId}>
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

function RadiusPresetRow({
  dataAiId,
  disabled,
  onSelect,
}: {
  dataAiId: string;
  disabled: boolean;
  onSelect: (preset: EdgePreset) => void;
}): ReactElement {
  return (
    <div className="flex flex-wrap items-center gap-1.5" data-ai-id={dataAiId}>
      <span className="mr-1 text-[10px] font-bold uppercase tracking-[0.12em] text-gray-500" data-ai-id={`${dataAiId}-label-text`}>
        All
      </span>
      {RADIUS_PRESETS.map((preset) => (
        <button
          key={`${preset.value}${preset.unit}`}
          type="button"
          className="rounded-full border border-gray-700 bg-gray-950/70 px-2 py-1 text-[10px] font-bold text-gray-400 transition hover:border-blue-500/40 hover:bg-blue-500/10 hover:text-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={disabled}
          onClick={() => {
            onSelect(preset);
          }}
          data-ai-id={`${dataAiId}-button`}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}

function BorderColorInput({
  property,
  label,
  dataAiId,
  disabled,
  helperText,
}: {
  property: string;
  label: string;
  dataAiId: string;
  disabled: boolean;
  helperText?: string;
}): ReactElement {
  const edit = useStyleEdit();
  const committed = edit.valueOf(property);
  const [draft, setDraft] = useState(committed);

  useEffect(() => {
    setDraft(committed);
  }, [committed, property]);

  const commit = (value = draft): void => {
    edit.commitStyle(property, value, {
      category: 'border',
      control: { id: `border:${property}`, label },
    });
  };

  return (
    <ColorInput
      label={label}
      dataAiId={dataAiId}
      value={draft}
      disabled={disabled}
      helperText={helperText}
      presets={COLOR_PRESETS}
      presetValue={committed}
      onChange={setDraft}
      onPresetSelect={(value) => {
        setDraft(value);
        commit(value);
      }}
      onCommit={() => commit()}
      onReset={() => {
        setDraft('');
        edit.resetStyle(property, {
          category: 'border',
          control: { id: `border:${property}`, label },
        });
      }}
    />
  );
}

function composePresetValue(value: string, unit: string): string {
  return /^-?\d*\.?\d+$/.test(value) ? `${value}${unit}` : value;
}
