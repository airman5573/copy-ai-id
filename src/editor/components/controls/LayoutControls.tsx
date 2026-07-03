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
  { value: 'none', label: 'None' },
];

const FLEX_DIRECTION_OPTIONS: VisualPresetOption[] = [
  { value: 'row', label: 'Row' },
  { value: 'row-reverse', label: 'Row reverse' },
  { value: 'column', label: 'Column' },
  { value: 'column-reverse', label: 'Column reverse' },
];

const JUSTIFY_OPTIONS: VisualPresetOption[] = [
  { value: 'flex-start', label: 'Start' },
  { value: 'center', label: 'Center' },
  { value: 'flex-end', label: 'End' },
  { value: 'space-between', label: 'Space between' },
  { value: 'space-around', label: 'Space around' },
  { value: 'space-evenly', label: 'Space evenly' },
];

const ALIGN_OPTIONS: VisualPresetOption[] = [
  { value: 'stretch', label: 'Stretch' },
  { value: 'flex-start', label: 'Start' },
  { value: 'center', label: 'Center' },
  { value: 'flex-end', label: 'End' },
  { value: 'baseline', label: 'Baseline' },
];

const PLACE_ITEMS_OPTIONS: VisualPresetOption[] = [
  { value: 'start', label: 'Start' },
  { value: 'center', label: 'Center' },
  { value: 'end', label: 'End' },
  { value: 'stretch', label: 'Stretch' },
];

const GRID_TEMPLATE_PRESETS: VisualPresetOption[] = [
  { value: 'none', label: 'None' },
  { value: 'repeat(2, minmax(0, 1fr))', label: '2 columns' },
  { value: 'repeat(3, minmax(0, 1fr))', label: '3 columns' },
  { value: 'repeat(4, minmax(0, 1fr))', label: '4 columns' },
  { value: 'repeat(auto-fit, minmax(12rem, 1fr))', label: 'Auto fit' },
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
  const isFlex = FLEX_DISPLAY_VALUES.has(display);
  const isGrid = GRID_DISPLAY_VALUES.has(display);

  return (
    <div className="space-y-4" data-ai-id="copy-ai-id-editor-layout-controls">
      <StyleControlGroup title="Display" dataAiId="copy-ai-id-editor-layout-display-group">
        <StylePresetSelect
          property="display"
          label="Display"
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
            label="Direction"
            dataAiId="copy-ai-id-editor-visual-flex-direction"
            options={FLEX_DIRECTION_OPTIONS}
            disabled={!canEdit}
          />
        ) : null}
        <StylePresetSelect
          property="justify-content"
          label="Justify content"
          dataAiId="copy-ai-id-editor-visual-justify-content"
          options={JUSTIFY_OPTIONS}
          disabled={!canEdit}
        />
        <StylePresetSelect
          property="align-items"
          label="Align items"
          dataAiId="copy-ai-id-editor-visual-align-items"
          options={ALIGN_OPTIONS}
          disabled={!canEdit}
        />
        {isFlex ? (
          <StylePresetSelect
            property="flex-wrap"
            label="Wrap"
            dataAiId="copy-ai-id-editor-visual-flex-wrap"
            disabled={!canEdit}
          />
        ) : null}
        <StylePresetSelect
          property="align-content"
          label="Align content"
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
          label="Grid columns"
          dataAiId="copy-ai-id-editor-visual-grid-cols"
          disabled={!canEdit}
          placeholder="repeat(3, minmax(0, 1fr))"
          normalize={normalizeGridTemplateColumnsInput}
          presets={GRID_TEMPLATE_PRESETS}
        />
        <StyleTextInput
          property="grid-template-rows"
          label="Grid rows"
          dataAiId="copy-ai-id-editor-visual-grid-rows"
          disabled={!canEdit}
          placeholder="auto 1fr"
          normalize={normalizeGridTemplateRowsInput}
          presets={GRID_ROWS_PRESETS}
        />
        <StylePresetSelect
          property="grid-auto-flow"
          label="Auto flow"
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
      </StyleControlGroup>

      <StyleControlGroup title="Position / Overflow" dataAiId="copy-ai-id-editor-layout-position-overflow-group">
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
          label="Overflow"
          dataAiId="copy-ai-id-editor-visual-overflow"
          disabled={!canEdit}
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
