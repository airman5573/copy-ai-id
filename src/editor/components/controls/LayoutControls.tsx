import { useEffect, useMemo, useState, type HTMLAttributes, type ReactElement, type ReactNode } from 'react';

import {
  getVisualStylePropertyDefinition,
  type VisualStylePreset,
} from '../../../shared/visual-style';
import { selectTextInputValue } from '../visual/inputSelection';
import { PresetSelect, type VisualPresetOption } from '../visual/PresetSelect';
import { VisualControl, VisualResetButton } from '../visual/VisualControl';
import { useStyleEdit } from '../../visual/useStyleEdit';

const DISPLAY_PROPERTY = 'display';
const FLEX_DISPLAY_VALUES = new Set(['flex', 'inline-flex']);
const GRID_DISPLAY_VALUES = new Set(['grid', 'inline-grid']);
const POSITIONED_VALUES = new Set(['relative', 'absolute', 'fixed', 'sticky']);

const DISPLAY_OPTIONS: VisualPresetOption[] = [
  { value: 'block', label: 'Block' },
  { value: 'inline-block', label: 'Inline Block' },
  { value: 'inline', label: 'Inline' },
  { value: 'list-item', label: 'List Item' },
  { value: 'flex', label: 'Flex' },
  { value: 'inline-flex', label: 'Inline Flex' },
  { value: 'grid', label: 'Grid' },
  { value: 'inline-grid', label: 'Inline Grid' },
  { value: 'none', label: 'Hidden (display: none)' },
];

const FLEX_DIRECTION_OPTIONS: VisualPresetOption[] = [
  { value: 'row', label: '가로 (row)' },
  { value: 'row-reverse', label: '가로 역순 (row-reverse)' },
  { value: 'column', label: '세로 (column)' },
  { value: 'column-reverse', label: '세로 역순 (column-reverse)' },
];

const JUSTIFY_OPTIONS: VisualPresetOption[] = [
  { value: 'flex-start', label: '시작 (flex-start)' },
  { value: 'center', label: '가운데 (center)' },
  { value: 'flex-end', label: '끝 (flex-end)' },
  { value: 'space-between', label: '양끝 분배 (space-between)' },
  { value: 'space-around', label: '둘레 분배 (space-around)' },
  { value: 'space-evenly', label: '균등 분배 (space-evenly)' },
];

const ALIGN_OPTIONS: VisualPresetOption[] = [
  { value: 'stretch', label: '늘이기 (stretch)' },
  { value: 'flex-start', label: '시작 (flex-start)' },
  { value: 'center', label: '가운데 (center)' },
  { value: 'flex-end', label: '끝 (flex-end)' },
  { value: 'baseline', label: '기준선 (baseline)' },
];

const PLACE_ITEMS_OPTIONS: VisualPresetOption[] = [
  { value: 'start', label: '시작 (start)' },
  { value: 'center', label: '가운데 (center)' },
  { value: 'end', label: '끝 (end)' },
  { value: 'stretch', label: '늘이기 (stretch)' },
];

const GRID_TEMPLATE_PRESETS: VisualPresetOption[] = [
  { value: 'none', label: 'None' },
  { value: 'repeat(2, minmax(0, 1fr))', label: '2 columns' },
  { value: 'repeat(3, minmax(0, 1fr))', label: '3 columns' },
  { value: 'repeat(4, minmax(0, 1fr))', label: '4 columns' },
  { value: 'repeat(auto-fit, minmax(12rem, 1fr))', label: 'Auto fit cards' },
];

const GRID_ROWS_PRESETS: VisualPresetOption[] = [
  { value: 'none', label: 'None' },
  { value: 'repeat(2, minmax(0, auto))', label: '2 rows' },
  { value: 'repeat(3, minmax(0, auto))', label: '3 rows' },
  { value: 'auto 1fr', label: 'Auto + fill' },
];

const INSET_PROPERTIES = [
  { property: 'top', label: 'Top' },
  { property: 'right', label: 'Right' },
  { property: 'bottom', label: 'Bottom' },
  { property: 'left', label: 'Left' },
] as const;

export type LayoutControlsProps = {
  disabled?: boolean;
};

export function LayoutControls({ disabled = false }: LayoutControlsProps): ReactElement {
  const edit = useStyleEdit();
  const canEdit = edit.canEdit && !disabled;
  const display = edit.valueOf(DISPLAY_PROPERTY);
  const position = edit.valueOf('position');
  const isFlex = FLEX_DISPLAY_VALUES.has(display);
  const isGrid = GRID_DISPLAY_VALUES.has(display);
  const isPositioned = POSITIONED_VALUES.has(position);

  return (
    <div className="space-y-4" data-ai-id="copy-ai-id-editor-layout-controls">
      <LayoutControlGroup
        title="디스플레이"
        description="선택 요소가 문서 흐름 안에서 렌더링되는 기본 방식을 정합니다."
        dataAiId="copy-ai-id-editor-layout-display-group"
      >
        <StylePresetSelect
          property="display"
          label="Display"
          dataAiId="copy-ai-id-editor-visual-display"
          options={DISPLAY_OPTIONS}
          disabled={!canEdit}
          helperText="display 값은 flex/grid 하위 컨트롤 노출에도 사용됩니다."
        />
      </LayoutControlGroup>

      <LayoutControlGroup
        title="Flex / 정렬"
        description="flex 또는 grid 컨테이너의 자식 배치 방향과 정렬을 조정합니다."
        dataAiId="copy-ai-id-editor-layout-flex-group"
        tone={isFlex || isGrid ? 'active' : 'muted'}
      >
        {!isFlex && !isGrid ? (
          <LayoutHint dataAiId="copy-ai-id-editor-layout-flex-disabled-hint">
            Display를 Flex 또는 Grid로 바꾸면 정렬 컨트롤이 바로 적용됩니다. 현재 값도 선택하면 inline CSS로 저장됩니다.
          </LayoutHint>
        ) : null}
        {isFlex ? (
          <StylePresetSelect
            property="flex-direction"
            label="방향 (Direction)"
            dataAiId="copy-ai-id-editor-visual-flex-direction"
            options={FLEX_DIRECTION_OPTIONS}
            disabled={!canEdit}
          />
        ) : null}
        <StylePresetSelect
          property="justify-content"
          label="주축 정렬 (Justify)"
          dataAiId="copy-ai-id-editor-visual-justify-content"
          options={JUSTIFY_OPTIONS}
          disabled={!canEdit}
          helperText={isFlex || isGrid ? undefined : 'Flex/Grid 컨테이너에서 가장 명확하게 반영됩니다.'}
        />
        <StylePresetSelect
          property="align-items"
          label="교차축 정렬 (Align)"
          dataAiId="copy-ai-id-editor-visual-align-items"
          options={ALIGN_OPTIONS}
          disabled={!canEdit}
          helperText={isFlex || isGrid ? undefined : 'Flex/Grid 컨테이너에서 가장 명확하게 반영됩니다.'}
        />
        {isFlex ? (
          <StylePresetSelect
            property="flex-wrap"
            label="줄바꿈 (Wrap)"
            dataAiId="copy-ai-id-editor-visual-flex-wrap"
            disabled={!canEdit}
          />
        ) : null}
        <StylePresetSelect
          property="align-content"
          label="여러 줄 정렬"
          dataAiId="copy-ai-id-editor-visual-align-content"
          options={JUSTIFY_OPTIONS}
          disabled={!canEdit}
          helperText="여러 줄 flex/grid 영역에서 효과가 큽니다."
        />
      </LayoutControlGroup>

      <LayoutControlGroup
        title="Grid"
        description="CSS grid의 열/행 템플릿과 자동 배치 방식을 설정합니다."
        dataAiId="copy-ai-id-editor-layout-grid-group"
        tone={isGrid ? 'active' : 'muted'}
      >
        {!isGrid ? (
          <LayoutHint dataAiId="copy-ai-id-editor-layout-grid-disabled-hint">
            Display를 Grid 또는 Inline Grid로 바꾸면 grid template 값이 바로 눈에 보입니다.
          </LayoutHint>
        ) : null}
        <StyleTextInput
          property="grid-template-columns"
          label="그리드 칼럼"
          dataAiId="copy-ai-id-editor-visual-grid-cols"
          disabled={!canEdit}
          placeholder="repeat(3, minmax(0, 1fr))"
          helperText="숫자만 입력하면 repeat(n, minmax(0, 1fr))로 변환합니다."
          normalize={normalizeGridTemplateColumnsInput}
          presets={GRID_TEMPLATE_PRESETS}
        />
        <StyleTextInput
          property="grid-template-rows"
          label="그리드 행"
          dataAiId="copy-ai-id-editor-visual-grid-rows"
          disabled={!canEdit}
          placeholder="auto 1fr"
          normalize={normalizeGridTemplateRowsInput}
          presets={GRID_ROWS_PRESETS}
        />
        <StylePresetSelect
          property="grid-auto-flow"
          label="자동 배치"
          dataAiId="copy-ai-id-editor-visual-grid-auto-flow"
          disabled={!canEdit}
        />
        <StylePresetSelect
          property="place-items"
          label="Place items"
          dataAiId="copy-ai-id-editor-visual-place-items"
          options={PLACE_ITEMS_OPTIONS}
          disabled={!canEdit}
        />
      </LayoutControlGroup>

      <LayoutControlGroup
        title="위치 / 오버플로우"
        description="position, inset, z-index, overflow 값을 inline CSS로 적용합니다."
        dataAiId="copy-ai-id-editor-layout-position-overflow-group"
      >
        <div className="grid grid-cols-2 gap-3" data-ai-id="copy-ai-id-editor-layout-position-overflow-grid">
          <StylePresetSelect
            property="position"
            label="Position"
            dataAiId="copy-ai-id-editor-visual-position"
            disabled={!canEdit}
          />
          <StyleTextInput
            property="z-index"
            label="Z index"
            dataAiId="copy-ai-id-editor-visual-z-index"
            disabled={!canEdit}
            placeholder="auto"
            inputMode="numeric"
          />
        </div>
        {!isPositioned ? (
          <LayoutHint dataAiId="copy-ai-id-editor-layout-inset-disabled-hint">
            Top/Right/Bottom/Left는 position이 Relative, Absolute, Fixed, Sticky일 때 가장 명확하게 반영됩니다.
          </LayoutHint>
        ) : null}
        <div className="grid grid-cols-2 gap-3" data-ai-id="copy-ai-id-editor-layout-inset-grid">
          {INSET_PROPERTIES.map(({ property, label }) => (
            <StyleTextInput
              key={property}
              property={property}
              label={label}
              dataAiId={`copy-ai-id-editor-visual-${property}`}
              disabled={!canEdit}
              placeholder="auto"
              helperText={isPositioned ? undefined : 'position 변경 후 적용 권장'}
            />
          ))}
        </div>
        <StylePresetSelect
          property="overflow"
          label="Overflow"
          dataAiId="copy-ai-id-editor-visual-overflow"
          disabled={!canEdit}
          helperText="전체 overflow 값을 한 번에 설정합니다."
        />
        <div className="grid grid-cols-2 gap-3" data-ai-id="copy-ai-id-editor-layout-overflow-axis-grid">
          <StylePresetSelect
            property="overflow-x"
            label="Overflow X"
            dataAiId="copy-ai-id-editor-visual-overflow-x"
            disabled={!canEdit}
          />
          <StylePresetSelect
            property="overflow-y"
            label="Overflow Y"
            dataAiId="copy-ai-id-editor-visual-overflow-y"
            disabled={!canEdit}
          />
        </div>
      </LayoutControlGroup>
    </div>
  );
}

type LayoutControlGroupProps = {
  title: string;
  description: string;
  dataAiId: string;
  children: ReactNode;
  tone?: 'active' | 'muted';
};

function LayoutControlGroup({
  title,
  description,
  dataAiId,
  children,
  tone = 'active',
}: LayoutControlGroupProps): ReactElement {
  return (
    <section
      className={`rounded-xl border p-3.5 shadow-sm ${
        tone === 'active'
          ? 'border-gray-800 bg-gray-950/45'
          : 'border-dashed border-gray-800/90 bg-gray-950/25'
      }`}
      data-ai-id={dataAiId}
      data-ai-editor-layout-control-group-tone={tone}
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

function LayoutHint({ dataAiId, children }: { dataAiId: string; children: ReactNode }): ReactElement {
  return (
    <p
      className="rounded-lg border border-blue-500/15 bg-blue-500/10 px-3 py-2 text-[11px] leading-relaxed text-blue-100/80"
      data-ai-id={dataAiId}
    >
      {children}
    </p>
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
        category: 'layout',
        control: { id: `layout:${property}`, label },
      })}
      onReset={() => edit.resetStyle(property, {
        category: 'layout',
        control: { id: `layout:${property}`, label },
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
  normalize?: (value: string) => string;
  presets?: VisualPresetOption[];
};

function StyleTextInput({
  property,
  label,
  dataAiId,
  disabled = false,
  placeholder,
  helperText,
  inputMode = 'text',
  normalize = normalizeTextInput,
  presets = [],
}: StyleTextInputProps): ReactElement {
  const edit = useStyleEdit();
  const committed = edit.valueOf(property);
  const [draft, setDraft] = useState(committed);

  useEffect(() => {
    setDraft(committed);
  }, [committed, property]);

  const commit = (): void => {
    const next = normalize(draft);
    setDraft(next);
    edit.commitStyle(property, next, {
      category: 'layout',
      control: { id: `layout:${property}`, label },
    });
  };

  const selectPreset = (value: string): void => {
    const next = normalize(value);
    setDraft(next);
    edit.commitStyle(property, next, {
      category: 'layout',
      control: { id: `layout:${property}`, label },
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
              category: 'layout',
              control: { id: `layout:${property}`, label },
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
          onBlur={commit}
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
                onClick={() => selectPreset(preset.value)}
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

function normalizeGridTemplateColumnsInput(value: string): string {
  const normalized = normalizeTextInput(value);
  if (/^[1-9]\d*$/.test(normalized)) {
    return `repeat(${normalized}, minmax(0, 1fr))`;
  }
  return normalized;
}

function normalizeGridTemplateRowsInput(value: string): string {
  const normalized = normalizeTextInput(value);
  if (/^[1-9]\d*$/.test(normalized)) {
    return `repeat(${normalized}, minmax(0, auto))`;
  }
  return normalized;
}
