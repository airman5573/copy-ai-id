import { type ReactElement } from 'react';

import { type VisualPresetOption } from '../visual/PresetSelect';
import { useStyleEdit } from '../../visual/useStyleEdit';
import {
  CssPresetSelect,
  CssTextInput,
  StyleControlGroup,
  normalizeCssValue,
  type CssPresetSelectProps,
  type CssTextInputProps,
} from './styleControlHelpers';

const DISPLAY_PROPERTY = 'display';
const FLEX_DISPLAY_VALUES = new Set(['flex', 'inline-flex']);
const GRID_DISPLAY_VALUES = new Set(['grid', 'inline-grid']);

const DISPLAY_OPTIONS: VisualPresetOption[] = [
  { value: 'block', label: 'Block' },
  { value: 'inline-block', label: 'Inline Block' },
  { value: 'inline', label: 'Inline' },
  { value: 'list-item', label: 'List Item' },
  { value: 'flex', label: 'Flex' },
  { value: 'inline-flex', label: 'Inline Flex' },
  { value: 'grid', label: 'Grid' },
  { value: 'inline-grid', label: 'Inline Grid' },
  { value: 'none', label: '없음' },
];

const FLEX_DIRECTION_OPTIONS: VisualPresetOption[] = [
  { value: 'row', label: '가로' },
  { value: 'row-reverse', label: '가로 반대' },
  { value: 'column', label: '세로' },
  { value: 'column-reverse', label: '세로 반대' },
];

const JUSTIFY_OPTIONS: VisualPresetOption[] = [
  { value: 'flex-start', label: '앞' },
  { value: 'center', label: '가운데' },
  { value: 'flex-end', label: '끝' },
  { value: 'space-between', label: '양끝 벌리기' },
  { value: 'space-around', label: '고르게(바깥 포함)' },
  { value: 'space-evenly', label: '모두 고르게' },
];

const ALIGN_OPTIONS: VisualPresetOption[] = [
  { value: 'stretch', label: '늘려 채우기' },
  { value: 'flex-start', label: '앞' },
  { value: 'center', label: '가운데' },
  { value: 'flex-end', label: '끝' },
  { value: 'baseline', label: '글자 기준선' },
];

const PLACE_ITEMS_OPTIONS: VisualPresetOption[] = [
  { value: 'start', label: '앞' },
  { value: 'center', label: '가운데' },
  { value: 'end', label: '끝' },
  { value: 'stretch', label: '늘려 채우기' },
];

const GRID_TEMPLATE_PRESETS: VisualPresetOption[] = [
  { value: 'none', label: '없음' },
  { value: 'repeat(2, minmax(0, 1fr))', label: '2열' },
  { value: 'repeat(3, minmax(0, 1fr))', label: '3열' },
  { value: 'repeat(4, minmax(0, 1fr))', label: '4열' },
  { value: 'repeat(auto-fit, minmax(12rem, 1fr))', label: '자동 맞춤' },
];

const GRID_ROWS_PRESETS: VisualPresetOption[] = [
  { value: 'none', label: '없음' },
  { value: 'repeat(2, minmax(0, auto))', label: '2행' },
  { value: 'repeat(3, minmax(0, auto))', label: '3행' },
  { value: 'auto 1fr', label: '자동+채움' },
];

const INSET_PROPERTIES = [
  { property: 'top', label: '위' },
  { property: 'right', label: '오른쪽' },
  { property: 'bottom', label: '아래' },
  { property: 'left', label: '왼쪽' },
] as const;

export type LayoutControlsProps = {
  disabled?: boolean;
};

export function LayoutControls({ disabled = false }: LayoutControlsProps): ReactElement {
  const edit = useStyleEdit();
  const canEdit = edit.canEdit && !disabled;
  const display = edit.valueOf(DISPLAY_PROPERTY);
  const isFlex = FLEX_DISPLAY_VALUES.has(display);
  const isGrid = GRID_DISPLAY_VALUES.has(display);

  return (
    <div className="space-y-4" data-ai-id="copy-ai-id-editor-layout-controls">
      <StyleControlGroup title="표시 방식" dataAiId="copy-ai-id-editor-layout-display-group">
        <StylePresetSelect
          property="display"
          label="표시 방식"
          dataAiId="copy-ai-id-editor-visual-display"
          options={DISPLAY_OPTIONS}
          disabled={!canEdit}
        />
      </StyleControlGroup>

      <StyleControlGroup
        title="Flex"
        dataAiId="copy-ai-id-editor-layout-flex-group"
        tone={isFlex || isGrid ? 'active' : 'muted'}
      >
        {isFlex ? (
          <StylePresetSelect
            property="flex-direction"
            label="방향"
            dataAiId="copy-ai-id-editor-visual-flex-direction"
            options={FLEX_DIRECTION_OPTIONS}
            disabled={!canEdit}
          />
        ) : null}
        <StylePresetSelect
          property="justify-content"
          label="정렬 (진행 방향)"
          dataAiId="copy-ai-id-editor-visual-justify-content"
          options={JUSTIFY_OPTIONS}
          disabled={!canEdit}
        />
        <StylePresetSelect
          property="align-items"
          label="정렬 (교차 방향)"
          dataAiId="copy-ai-id-editor-visual-align-items"
          options={ALIGN_OPTIONS}
          disabled={!canEdit}
        />
        {isFlex ? (
          <StylePresetSelect
            property="flex-wrap"
            label="줄바꿈"
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
        />
      </StyleControlGroup>

      <StyleControlGroup
        title="Grid"
        dataAiId="copy-ai-id-editor-layout-grid-group"
        tone={isGrid ? 'active' : 'muted'}
      >
        <StyleTextInput
          property="grid-template-columns"
          label="그리드 열"
          dataAiId="copy-ai-id-editor-visual-grid-cols"
          disabled={!canEdit}
          placeholder="repeat(3, minmax(0, 1fr))"
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
          label="칸 안 정렬"
          dataAiId="copy-ai-id-editor-visual-place-items"
          options={PLACE_ITEMS_OPTIONS}
          disabled={!canEdit}
        />
      </StyleControlGroup>

      <StyleControlGroup title="위치 / 넘침 처리" dataAiId="copy-ai-id-editor-layout-position-overflow-group">
        <div className="grid grid-cols-2 gap-3" data-ai-id="copy-ai-id-editor-layout-position-overflow-grid">
          <StylePresetSelect
            property="position"
            label="위치 기준"
            dataAiId="copy-ai-id-editor-visual-position"
            disabled={!canEdit}
          />
          <StyleTextInput
            property="z-index"
            label="쌓임 순서"
            dataAiId="copy-ai-id-editor-visual-z-index"
            disabled={!canEdit}
            placeholder="auto"
            inputMode="numeric"
          />
        </div>
        <div className="grid grid-cols-2 gap-3" data-ai-id="copy-ai-id-editor-layout-inset-grid">
          {INSET_PROPERTIES.map(({ property, label }) => (
            <StyleTextInput
              key={property}
              property={property}
              label={label}
              dataAiId={`copy-ai-id-editor-visual-${property}`}
              disabled={!canEdit}
              placeholder="auto"
            />
          ))}
        </div>
        <StylePresetSelect
          property="overflow"
          label="넘침 처리"
          dataAiId="copy-ai-id-editor-visual-overflow"
          disabled={!canEdit}
        />
        <div className="grid grid-cols-2 gap-3" data-ai-id="copy-ai-id-editor-layout-overflow-axis-grid">
          <StylePresetSelect
            property="overflow-x"
            label="가로 넘침"
            dataAiId="copy-ai-id-editor-visual-overflow-x"
            disabled={!canEdit}
          />
          <StylePresetSelect
            property="overflow-y"
            label="세로 넘침"
            dataAiId="copy-ai-id-editor-visual-overflow-y"
            disabled={!canEdit}
          />
        </div>
      </StyleControlGroup>
    </div>
  );
}

function StylePresetSelect(props: Omit<CssPresetSelectProps, 'category' | 'controlPrefix'>): ReactElement {
  return <CssPresetSelect {...props} category="layout" />;
}

function StyleTextInput(props: Omit<CssTextInputProps, 'category' | 'controlPrefix'>): ReactElement {
  return <CssTextInput {...props} category="layout" />;
}

function normalizeGridTemplateColumnsInput(value: string): string {
  const normalized = normalizeCssValue(value);
  if (/^[1-9]\d*$/.test(normalized)) {
    return `repeat(${normalized}, minmax(0, 1fr))`;
  }
  return normalized;
}

function normalizeGridTemplateRowsInput(value: string): string {
  const normalized = normalizeCssValue(value);
  if (/^[1-9]\d*$/.test(normalized)) {
    return `repeat(${normalized}, minmax(0, auto))`;
  }
  return normalized;
}
