import type { ReactElement } from 'react';

import { CssPresetSelect, CssTextInput, StyleControlGroup } from './styleControlHelpers';

export type TypographyControlsProps = {
  disabled?: boolean;
};

const FONT_FAMILY_PRESETS = [
  { value: 'system-ui', label: 'System' },
  { value: 'Inter, system-ui, sans-serif', label: 'Inter' },
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: 'Times New Roman, serif', label: 'Times' },
  { value: 'monospace', label: 'Mono' },
] as const;

const FONT_SIZE_PRESETS = [
  { value: '12px', label: '12px' },
  { value: '14px', label: '14px' },
  { value: '16px', label: '16px' },
  { value: '18px', label: '18px' },
  { value: '20px', label: '20px' },
  { value: '24px', label: '24px' },
  { value: '30px', label: '30px' },
  { value: '36px', label: '36px' },
  { value: '48px', label: '48px' },
] as const;

const LINE_HEIGHT_PRESETS = [
  { value: 'normal', label: 'Normal' },
  { value: '1', label: '1' },
  { value: '1.25', label: '1.25' },
  { value: '1.5', label: '1.5' },
  { value: '1.75', label: '1.75' },
  { value: '2', label: '2' },
] as const;

const LETTER_SPACING_PRESETS = [
  { value: '-0.05em', label: '-.05em' },
  { value: '-0.025em', label: '-.025em' },
  { value: '0em', label: '0' },
  { value: '0.025em', label: '.025em' },
  { value: '0.05em', label: '.05em' },
  { value: '0.1em', label: '.1em' },
] as const;

const FONT_WEIGHT_OPTIONS = [
  { value: '100', label: '100 — Thin' },
  { value: '300', label: '300 — Light' },
  { value: '400', label: '400 — Regular' },
  { value: '500', label: '500 — Medium' },
  { value: '600', label: '600 — Semibold' },
  { value: '700', label: '700 — Bold' },
  { value: '900', label: '900 — Black' },
];

export function TypographyControls({ disabled = false }: TypographyControlsProps): ReactElement {
  return (
    <StyleControlGroup
      title="Typography"
      description="글꼴, 크기, 행간, 자간, 정렬 등 텍스트 CSS 속성을 조정합니다."
      dataAiId="copy-ai-id-editor-style-typography-group"
    >
      <CssTextInput
        property="font-family"
        label="Font family"
        dataAiId="copy-ai-id-editor-visual-font-family"
        disabled={disabled}
        placeholder="system-ui"
        presets={FONT_FAMILY_PRESETS}
      />
      <div className="grid grid-cols-2 gap-3" data-ai-id="copy-ai-id-editor-style-typography-size-grid">
        <CssTextInput
          property="font-size"
          label="Font size"
          dataAiId="copy-ai-id-editor-visual-font-size"
          disabled={disabled}
          placeholder="16px"
          presets={FONT_SIZE_PRESETS}
        />
        <CssPresetSelect
          property="font-weight"
          label="Font weight"
          dataAiId="copy-ai-id-editor-visual-font-weight"
          disabled={disabled}
          options={FONT_WEIGHT_OPTIONS}
        />
        <CssTextInput
          property="line-height"
          label="Line height"
          dataAiId="copy-ai-id-editor-visual-line-height"
          disabled={disabled}
          placeholder="1.5 또는 24px"
          presets={LINE_HEIGHT_PRESETS}
        />
        <CssTextInput
          property="letter-spacing"
          label="Letter spacing"
          dataAiId="copy-ai-id-editor-visual-letter-spacing"
          disabled={disabled}
          placeholder="0.02em"
          presets={LETTER_SPACING_PRESETS}
        />
      </div>
      <div className="grid grid-cols-2 gap-3" data-ai-id="copy-ai-id-editor-style-typography-select-grid">
        <CssPresetSelect
          property="font-style"
          label="Font style"
          dataAiId="copy-ai-id-editor-visual-font-style"
          disabled={disabled}
        />
        <CssPresetSelect
          property="text-align"
          label="Text align"
          dataAiId="copy-ai-id-editor-visual-text-align"
          disabled={disabled}
        />
        <CssPresetSelect
          property="text-decoration-line"
          label="Text decoration"
          dataAiId="copy-ai-id-editor-visual-text-decoration"
          disabled={disabled}
        />
        <CssPresetSelect
          property="text-transform"
          label="Text transform"
          dataAiId="copy-ai-id-editor-visual-text-transform"
          disabled={disabled}
        />
        <CssPresetSelect
          property="white-space"
          label="White space"
          dataAiId="copy-ai-id-editor-visual-white-space"
          disabled={disabled}
        />
      </div>
    </StyleControlGroup>
  );
}
