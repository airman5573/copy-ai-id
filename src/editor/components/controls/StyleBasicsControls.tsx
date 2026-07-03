import type { ReactElement } from 'react';

import type { VisualPresetOption } from '../visual/PresetSelect';
import {
  CssColorInput,
  CssPresetSelect,
  CssStepper,
  StyleControlGroup,
} from './styleControlHelpers';

export type StyleBasicsControlsProps = {
  disabled?: boolean;
};

const FONT_WEIGHT_OPTIONS: VisualPresetOption[] = [
  { value: '400', label: '보통' },
  { value: '500', label: '조금 굵게' },
  { value: '600', label: '굵게' },
  { value: '700', label: '아주 굵게' },
];

const TEXT_ALIGN_OPTIONS: VisualPresetOption[] = [
  { value: 'left', label: '왼쪽' },
  { value: 'center', label: '가운데' },
  { value: 'right', label: '오른쪽' },
  { value: 'justify', label: '양쪽 맞춤' },
];

// 스타일 tab basics: the font/color controls that also live on the quick
// toolbar, duplicated here on purpose so the panel is complete on its own.
export function StyleBasicsControls({ disabled = false }: StyleBasicsControlsProps): ReactElement {
  return (
    <div className="space-y-4" data-ai-id="copy-ai-id-editor-style-basics-controls">
      <StyleControlGroup title="글자" dataAiId="copy-ai-id-editor-style-basics-text-group">
        <div className="grid grid-cols-2 gap-3" data-ai-id="copy-ai-id-editor-style-basics-text-grid">
          <CssStepper
            property="font-size"
            label="글자 크기"
            dataAiId="copy-ai-id-editor-visual-font-size"
            disabled={disabled}
          />
          <CssPresetSelect
            property="font-weight"
            label="굵기"
            dataAiId="copy-ai-id-editor-visual-font-weight"
            options={FONT_WEIGHT_OPTIONS}
            disabled={disabled}
          />
        </div>
        <CssPresetSelect
          property="text-align"
          label="정렬"
          dataAiId="copy-ai-id-editor-visual-text-align"
          options={TEXT_ALIGN_OPTIONS}
          disabled={disabled}
        />
        <CssColorInput
          property="color"
          label="글자색"
          dataAiId="copy-ai-id-editor-visual-text-color"
          disabled={disabled}
        />
      </StyleControlGroup>

      <StyleControlGroup title="배경" dataAiId="copy-ai-id-editor-style-basics-background-group">
        <CssColorInput
          property="background-color"
          label="배경색"
          dataAiId="copy-ai-id-editor-visual-background-color"
          disabled={disabled}
        />
      </StyleControlGroup>
    </div>
  );
}
