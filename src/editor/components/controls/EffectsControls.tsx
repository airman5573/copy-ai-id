import type { ReactElement } from 'react';

import {
  CssPresetSelect,
  CssStepper,
  CssTextarea,
  StyleControlGroup,
} from './styleControlHelpers';

export type EffectsControlsProps = {
  disabled?: boolean;
};

const BOX_SHADOW_PRESETS = [
  { value: 'none', label: 'None' },
  { value: '0 2px 4px rgba(0, 0, 0, 0.12)', label: 'Small' },
  { value: '0 8px 20px rgba(0, 0, 0, 0.18)', label: 'Medium' },
  { value: '0 18px 42px rgba(0, 0, 0, 0.28)', label: 'Large' },
  { value: 'inset 0 2px 8px rgba(0, 0, 0, 0.18)', label: 'Inset' },
] as const;

const TEXT_SHADOW_PRESETS = [
  { value: 'none', label: 'None' },
  { value: '0 1px 1px rgba(0, 0, 0, 0.28)', label: 'Soft' },
  { value: '0 2px 4px rgba(0, 0, 0, 0.38)', label: 'Strong' },
] as const;

const FILTER_PRESETS = [
  { value: 'none', label: 'None' },
  { value: 'blur(4px)', label: 'Blur' },
  { value: 'brightness(1.1)', label: 'Bright' },
  { value: 'contrast(1.1)', label: 'Contrast' },
  { value: 'grayscale(1)', label: 'Gray' },
] as const;

// Effects section: opacity stepper (percentage points), shadows/filters, and
// the preset-only transform control.
export function EffectsControls({ disabled = false }: EffectsControlsProps): ReactElement {
  return (
    <StyleControlGroup title="Effects" dataAiId="copy-ai-id-editor-style-effects-group">
      <div className="grid grid-cols-2 gap-3" data-ai-id="copy-ai-id-editor-style-effects-grid">
        <CssStepper
          property="opacity"
          label="Opacity"
          dataAiId="copy-ai-id-editor-visual-opacity"
          disabled={disabled}
          mode="opacity"
        />
        <CssPresetSelect
          property="transform"
          label="Transform"
          dataAiId="copy-ai-id-editor-visual-transform"
          disabled={disabled}
        />
      </div>
      <CssTextarea
        property="box-shadow"
        label="Box shadow"
        dataAiId="copy-ai-id-editor-visual-box-shadow"
        disabled={disabled}
        placeholder="0 8px 20px rgba(0, 0, 0, 0.18)"
        presets={BOX_SHADOW_PRESETS}
        rows={2}
      />
      <CssTextarea
        property="text-shadow"
        label="Text shadow"
        dataAiId="copy-ai-id-editor-visual-text-shadow"
        disabled={disabled}
        placeholder="0 2px 4px rgba(0, 0, 0, 0.38)"
        presets={TEXT_SHADOW_PRESETS}
        rows={2}
      />
      <CssTextarea
        property="filter"
        label="Filter"
        dataAiId="copy-ai-id-editor-visual-filter"
        disabled={disabled}
        placeholder="blur(4px) brightness(1.1)"
        presets={FILTER_PRESETS}
        rows={2}
      />
      <CssTextarea
        property="backdrop-filter"
        label="Backdrop filter"
        dataAiId="copy-ai-id-editor-visual-backdrop-filter"
        disabled={disabled}
        placeholder="blur(12px)"
        presets={FILTER_PRESETS}
        rows={2}
      />
    </StyleControlGroup>
  );
}
