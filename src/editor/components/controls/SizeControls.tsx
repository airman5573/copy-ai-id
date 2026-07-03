import { type ReactElement } from 'react';

import { useStyleEdit } from '../../visual/useStyleEdit';
import {
  CssPresetSelect,
  CssStepper,
  CssTextInput,
  StyleControlGroup,
} from './styleControlHelpers';

export type SizeControlsProps = {
  disabled?: boolean;
};

const SIZE_KEYWORD_PRESETS = [
  { value: 'auto', label: '자동' },
  { value: '100%', label: '꽉 차게' },
  { value: 'fit-content', label: '내용만큼' },
] as const;

const CONSTRAINT_PROPERTIES = [
  { property: 'min-width', label: '최소 너비', dataAiId: 'copy-ai-id-editor-visual-min-width' },
  { property: 'max-width', label: '최대 너비', dataAiId: 'copy-ai-id-editor-visual-max-width' },
  { property: 'min-height', label: '최소 높이', dataAiId: 'copy-ai-id-editor-visual-min-height' },
  { property: 'max-height', label: '최대 높이', dataAiId: 'copy-ai-id-editor-visual-max-height' },
] as const;

// 크기 tab: width/height (also on the quick toolbar, duplicated on purpose)
// plus min/max constraints and box-sizing.
export function SizeControls({ disabled = false }: SizeControlsProps): ReactElement {
  const edit = useStyleEdit();
  const canEdit = edit.canEdit && !disabled;

  return (
    <div className="space-y-4" data-ai-id="copy-ai-id-editor-size-controls">
      <StyleControlGroup title="크기" dataAiId="copy-ai-id-editor-size-dimension-group">
        <div className="grid grid-cols-2 gap-3" data-ai-id="copy-ai-id-editor-size-dimension-grid">
          <CssTextInput
            property="width"
            label="너비"
            dataAiId="copy-ai-id-editor-visual-width"
            disabled={!canEdit}
            placeholder="auto"
            presets={SIZE_KEYWORD_PRESETS}
            category="size"
          />
          <CssTextInput
            property="height"
            label="높이"
            dataAiId="copy-ai-id-editor-visual-height"
            disabled={!canEdit}
            placeholder="auto"
            presets={SIZE_KEYWORD_PRESETS}
            category="size"
          />
        </div>
      </StyleControlGroup>

      <StyleControlGroup title="최소 / 최대" dataAiId="copy-ai-id-editor-size-constraints-group">
        <div className="grid grid-cols-2 gap-3" data-ai-id="copy-ai-id-editor-size-constraints-grid">
          {CONSTRAINT_PROPERTIES.map(({ property, label, dataAiId }) => (
            <CssStepper
              key={property}
              property={property}
              label={label}
              dataAiId={dataAiId}
              disabled={!canEdit}
              category="size"
            />
          ))}
        </div>
        <CssPresetSelect
          property="box-sizing"
          label="크기 계산 기준"
          dataAiId="copy-ai-id-editor-visual-box-sizing"
          disabled={!canEdit}
          category="size"
        />
      </StyleControlGroup>
    </div>
  );
}
