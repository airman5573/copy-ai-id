import type { ReactElement } from 'react';

import { CssTextarea, StyleControlGroup } from './styleControlHelpers';

export type ShadowControlsProps = {
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
  { value: '1px 1px 0 rgba(0, 0, 0, 0.55)', label: 'Outline' },
] as const;

const FILTER_PRESETS = [
  { value: 'none', label: 'None' },
  { value: 'blur(4px)', label: 'Blur' },
  { value: 'brightness(1.1)', label: 'Bright' },
  { value: 'contrast(1.1)', label: 'Contrast' },
  { value: 'grayscale(1)', label: 'Gray' },
] as const;

export function ShadowControls({ disabled = false }: ShadowControlsProps): ReactElement {
  return (
    <StyleControlGroup
      title="Effects"
      description="box-shadow, text-shadow, filter, backdrop-filter 값을 직접 조정합니다."
      dataAiId="copy-ai-id-editor-style-effects-group"
    >
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
      <div className="rounded-lg border border-gray-800 bg-gray-950/35 p-3" data-ai-id="copy-ai-id-editor-style-filter-group">
        <CssTextarea
          property="filter"
          label="Filter"
          dataAiId="copy-ai-id-editor-visual-filter"
          disabled={disabled}
          placeholder="blur(4px) brightness(1.1)"
          presets={FILTER_PRESETS}
          rows={2}
        />
        <div className="mt-3" data-ai-id="copy-ai-id-editor-style-backdrop-filter-wrapper">
          <CssTextarea
            property="backdrop-filter"
            label="Backdrop filter"
            dataAiId="copy-ai-id-editor-visual-backdrop-filter"
            disabled={disabled}
            placeholder="blur(12px)"
            presets={FILTER_PRESETS}
            rows={2}
          />
        </div>
      </div>
    </StyleControlGroup>
  );
}

