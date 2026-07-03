import type { ReactElement } from 'react';

import {
  CssPresetSelect,
  CssStepper,
  CssTextInput,
  StyleControlGroup,
} from './styleControlHelpers';

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

// Extended typography — font-size/weight/align/color live on the quick
// toolbar, so only the long-tail text properties remain here.
export function TypographyControls({ disabled = false }: TypographyControlsProps): ReactElement {
  return (
    <StyleControlGroup
      title="Typography"
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
        <CssStepper
          property="line-height"
          label="Line height"
          dataAiId="copy-ai-id-editor-visual-line-height"
          disabled={disabled}
        />
        <CssStepper
          property="letter-spacing"
          label="Letter spacing"
          dataAiId="copy-ai-id-editor-visual-letter-spacing"
          disabled={disabled}
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
