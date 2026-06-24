import { useEffect, useMemo, useState, type HTMLAttributes, type ReactElement, type ReactNode } from 'react';

import {
  getVisualStylePropertyDefinition,
  type VisualStylePreset,
} from '../../../shared/visual-style';
import {
  SIZE_UNITS,
  useVisualStyleForm,
  type LengthFieldApi,
} from '../../forms/useVisualStyleForm';
import { useStyleEdit } from '../../visual/useStyleEdit';
import { PresetSelect, type VisualPresetOption } from '../visual/PresetSelect';
import { selectTextInputValue } from '../visual/inputSelection';
import { UnitValueInput } from '../visual/UnitValueInput';
import { VisualControl, VisualResetButton } from '../visual/VisualControl';

export type SizeControlsProps = {
  disabled?: boolean;
};

const WIDTH_HEIGHT_PRESETS: readonly SizeKeywordPreset[] = [
  { label: 'Auto', value: 'auto' },
  { label: '100%', value: '100%' },
  { label: 'Fit', value: 'fit-content' },
  { label: 'Max', value: 'max-content' },
  { label: 'Min', value: 'min-content' },
];

const MIN_SIZE_PRESETS: readonly SizeKeywordPreset[] = [
  { label: '0', value: '0px' },
  { label: 'Auto', value: 'auto' },
  { label: 'Fit', value: 'fit-content' },
  { label: 'Max', value: 'max-content' },
];

const MAX_SIZE_PRESETS: readonly SizeKeywordPreset[] = [
  { label: 'None', value: 'none' },
  { label: '100%', value: '100%' },
  { label: 'Fit', value: 'fit-content' },
  { label: 'Max', value: 'max-content' },
];

const ASPECT_RATIO_PRESETS: readonly SizeKeywordPreset[] = [
  { label: 'Auto', value: 'auto' },
  { label: '1:1', value: '1 / 1' },
  { label: '4:3', value: '4 / 3' },
  { label: '16:9', value: '16 / 9' },
  { label: '3:4', value: '3 / 4' },
];

const OBJECT_POSITION_PRESETS: readonly SizeKeywordPreset[] = [
  { label: 'Center', value: 'center' },
  { label: 'Top', value: 'top' },
  { label: 'Right', value: 'right' },
  { label: 'Bottom', value: 'bottom' },
  { label: 'Left', value: 'left' },
  { label: '50% 50%', value: '50% 50%' },
];

export function SizeControls({ disabled = false }: SizeControlsProps): ReactElement {
  const form = useVisualStyleForm();
  const edit = useStyleEdit();
  const canEdit = edit.canEdit && !disabled;

  return (
    <div className="space-y-4" data-ai-id="copy-ai-id-editor-size-controls">
      <SizeControlGroup
        title="Box sizing"
        description="요소의 width/height 계산 방식과 기본 크기를 조정합니다."
        dataAiId="copy-ai-id-editor-size-box-group"
      >
        <StylePresetSelect
          property="box-sizing"
          label="Box sizing"
          dataAiId="copy-ai-id-editor-visual-box-sizing"
          disabled={!canEdit}
          helperText="border-box는 padding/border를 포함한 크기로 계산합니다."
        />
        <div className="grid grid-cols-2 gap-3" data-ai-id="copy-ai-id-editor-size-width-height-grid">
          <SizeLengthField
            property="width"
            label="너비 (W)"
            dataAiId="copy-ai-id-editor-visual-width"
            field={form.width}
            disabled={!canEdit}
            presets={WIDTH_HEIGHT_PRESETS}
          />
          <SizeLengthField
            property="height"
            label="높이 (H)"
            dataAiId="copy-ai-id-editor-visual-height"
            field={form.height}
            disabled={!canEdit}
            presets={WIDTH_HEIGHT_PRESETS}
          />
        </div>
      </SizeControlGroup>

      <SizeControlGroup
        title="Min / Max"
        description="반응형 레이아웃에서 요소가 줄어들거나 커지는 한계를 설정합니다."
        dataAiId="copy-ai-id-editor-size-constraints-group"
      >
        <div className="grid grid-cols-2 gap-3" data-ai-id="copy-ai-id-editor-size-constraints-grid">
          <SizeLengthField
            property="min-width"
            label="Min width"
            dataAiId="copy-ai-id-editor-visual-min-width"
            field={form.minWidth}
            disabled={!canEdit}
            presets={MIN_SIZE_PRESETS}
          />
          <SizeLengthField
            property="max-width"
            label="Max width"
            dataAiId="copy-ai-id-editor-visual-max-width"
            field={form.maxWidth}
            disabled={!canEdit}
            presets={MAX_SIZE_PRESETS}
          />
          <SizeLengthField
            property="min-height"
            label="Min height"
            dataAiId="copy-ai-id-editor-visual-min-height"
            field={form.minHeight}
            disabled={!canEdit}
            presets={MIN_SIZE_PRESETS}
          />
          <SizeLengthField
            property="max-height"
            label="Max height"
            dataAiId="copy-ai-id-editor-visual-max-height"
            field={form.maxHeight}
            disabled={!canEdit}
            presets={MAX_SIZE_PRESETS}
          />
        </div>
      </SizeControlGroup>

      <SizeControlGroup
        title="Media"
        description="이미지, 비디오, iframe 같은 replaced element의 비율과 채우기 방식을 설정합니다."
        dataAiId="copy-ai-id-editor-size-media-group"
      >
        <StyleTextInput
          property="aspect-ratio"
          label="Aspect ratio"
          dataAiId="copy-ai-id-editor-visual-aspect-ratio"
          disabled={!canEdit}
          placeholder="16 / 9"
          helperText="예: auto, 1 / 1, 16 / 9"
          presets={ASPECT_RATIO_PRESETS}
        />
        <StylePresetSelect
          property="object-fit"
          label="Object fit"
          dataAiId="copy-ai-id-editor-visual-object-fit"
          disabled={!canEdit}
          helperText="img/video처럼 object box를 가진 요소에서 가장 잘 보입니다."
        />
        <StyleTextInput
          property="object-position"
          label="Object position"
          dataAiId="copy-ai-id-editor-visual-object-position"
          disabled={!canEdit}
          placeholder="center"
          helperText="예: center, top right, 50% 50%"
          presets={OBJECT_POSITION_PRESETS}
        />
      </SizeControlGroup>
    </div>
  );
}

type SizeControlGroupProps = {
  title: string;
  description: string;
  dataAiId: string;
  children: ReactNode;
};

function SizeControlGroup({ title, description, dataAiId, children }: SizeControlGroupProps): ReactElement {
  return (
    <section
      className="rounded-xl border border-gray-800 bg-gray-950/45 p-3.5 shadow-sm"
      data-ai-id={dataAiId}
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

type SizeKeywordPreset = {
  label: string;
  value: string;
};

function SizeLengthField({
  property,
  label,
  dataAiId,
  field,
  disabled,
  presets,
}: {
  property: string;
  label: string;
  dataAiId: string;
  field: LengthFieldApi;
  disabled: boolean;
  presets: readonly SizeKeywordPreset[];
}): ReactElement {
  const edit = useStyleEdit();
  const valueReadOnly = field.unit === 'auto' || field.unit === 'none';

  const commitPreset = (preset: SizeKeywordPreset): void => {
    edit.commitStyle(property, preset.value, {
      category: 'size',
      control: { id: `size:${property}`, label },
    });
  };

  return (
    <div className="space-y-2" data-ai-id={`${dataAiId}-wrapper`}>
      <UnitValueInput
        label={label}
        dataAiId={dataAiId}
        value={field.value}
        unit={field.unit}
        units={SIZE_UNITS}
        disabled={disabled}
        valueReadOnly={valueReadOnly}
        helperText={valueReadOnly ? `${field.unit} keyword가 적용되어 있습니다.` : undefined}
        placeholder={valueReadOnly ? field.unit : '0'}
        onValueChange={field.setValue}
        onUnitChange={field.setUnit}
        onCommit={field.commit}
        onReset={field.reset}
      />
      <div className="flex flex-wrap gap-1.5" data-ai-id={`${dataAiId}-preset-row`}>
        {presets.map((preset) => (
          <button
            key={preset.value}
            type="button"
            className="rounded-full border border-gray-700 bg-gray-950/70 px-2 py-1 text-[10px] font-bold text-gray-400 transition hover:border-blue-500/40 hover:bg-blue-500/10 hover:text-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={disabled}
            onClick={() => commitPreset(preset)}
            data-ai-id={`${dataAiId}-preset-button`}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}

type StylePresetSelectProps = {
  property: string;
  label: string;
  dataAiId: string;
  disabled?: boolean;
  helperText?: string;
  options?: VisualPresetOption[];
};

function StylePresetSelect({
  property,
  label,
  dataAiId,
  disabled = false,
  helperText,
  options,
}: StylePresetSelectProps): ReactElement {
  const edit = useStyleEdit();
  const resolvedOptions = useMemo(() => options ?? presetOptionsForProperty(property), [options, property]);

  return (
    <PresetSelect
      label={label}
      dataAiId={dataAiId}
      value={edit.valueOf(property)}
      options={resolvedOptions}
      disabled={disabled}
      helperText={helperText}
      showPlaceholderOption={false}
      onChange={(value) => edit.commitStyle(property, value, {
        category: 'size',
        control: { id: `size:${property}`, label },
      })}
      onReset={() => edit.resetStyle(property, {
        category: 'size',
        control: { id: `size:${property}`, label },
      })}
    />
  );
}

type StyleTextInputProps = {
  property: string;
  label: string;
  dataAiId: string;
  disabled?: boolean;
  placeholder?: string;
  helperText?: string;
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode'];
  presets?: readonly SizeKeywordPreset[];
};

function StyleTextInput({
  property,
  label,
  dataAiId,
  disabled = false,
  placeholder,
  helperText,
  inputMode = 'text',
  presets = [],
}: StyleTextInputProps): ReactElement {
  const edit = useStyleEdit();
  const committed = edit.valueOf(property);
  const [draft, setDraft] = useState(committed);

  useEffect(() => {
    setDraft(committed);
  }, [committed, property]);

  const commitValue = (value: string): void => {
    const next = normalizeTextInput(value);
    setDraft(next);
    edit.commitStyle(property, next, {
      category: 'size',
      control: { id: `size:${property}`, label },
    });
  };

  return (
    <VisualControl
      label={label}
      dataAiId={`${dataAiId}-field`}
      helperText={helperText}
      disabled={disabled}
      actions={
        <VisualResetButton
          dataAiId={`${dataAiId}-reset-button`}
          disabled={disabled}
          onClick={() => {
            setDraft('');
            edit.resetStyle(property, {
              category: 'size',
              control: { id: `size:${property}`, label },
            });
          }}
        />
      }
    >
      <div className="space-y-2" data-ai-id={`${dataAiId}-text-control`}>
        <input
          type="text"
          inputMode={inputMode}
          value={draft}
          disabled={disabled}
          placeholder={placeholder}
          className="w-full rounded-lg border border-gray-700 bg-gray-950/80 px-2.5 py-2 font-mono text-[11px] text-gray-100 outline-none transition placeholder:text-gray-600 focus:border-blue-500/70 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:text-gray-600"
          onFocus={(event) => selectTextInputValue(event.currentTarget)}
          onClick={(event) => selectTextInputValue(event.currentTarget)}
          onChange={(event) => setDraft(event.currentTarget.value)}
          onBlur={() => commitValue(draft)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              event.currentTarget.blur();
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              setDraft(committed);
              event.currentTarget.blur();
            }
          }}
          data-ai-id={dataAiId}
        />
        {presets.length > 0 ? (
          <div className="flex flex-wrap gap-1.5" data-ai-id={`${dataAiId}-preset-row`}>
            {presets.map((preset) => (
              <button
                key={preset.value}
                type="button"
                className="rounded-full border border-gray-700 bg-gray-950/70 px-2 py-1 text-[10px] font-bold text-gray-400 transition hover:border-blue-500/40 hover:bg-blue-500/10 hover:text-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={disabled}
                onClick={() => commitValue(preset.value)}
                data-ai-id={`${dataAiId}-preset-button`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </VisualControl>
  );
}

function presetOptionsForProperty(property: string): VisualPresetOption[] {
  const definition = getVisualStylePropertyDefinition(property);
  return (definition?.presets ?? []).map(visualPresetToOption);
}

function visualPresetToOption(preset: VisualStylePreset): VisualPresetOption {
  return {
    value: preset.value,
    label: preset.label,
  };
}

function normalizeTextInput(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
