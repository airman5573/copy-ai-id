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
  { value: 'none', label: '없음' },
  { value: '0 2px 4px rgba(0, 0, 0, 0.12)', label: '작게' },
  { value: '0 8px 20px rgba(0, 0, 0, 0.18)', label: '중간' },
  { value: '0 18px 42px rgba(0, 0, 0, 0.28)', label: '크게' },
  { value: 'inset 0 2px 8px rgba(0, 0, 0, 0.18)', label: '안쪽' },
] as const;

const TEXT_SHADOW_PRESETS = [
  { value: 'none', label: '없음' },
  { value: '0 1px 1px rgba(0, 0, 0, 0.28)', label: '부드럽게' },
  { value: '0 2px 4px rgba(0, 0, 0, 0.38)', label: '강하게' },
] as const;

const FILTER_PRESETS = [
  { value: 'none', label: '없음' },
  { value: 'blur(4px)', label: '흐리게' },
  { value: 'brightness(1.1)', label: '밝게' },
  { value: 'contrast(1.1)', label: '대비' },
  { value: 'grayscale(1)', label: '흑백' },
] as const;

// Effects section: opacity stepper (percentage points), shadows/filters, and
// the preset-only transform control.
export function EffectsControls({ disabled = false }: EffectsControlsProps): ReactElement {
  return (
    <StyleControlGroup title="효과" dataAiId="copy-ai-id-editor-style-effects-group">
      <div className="grid grid-cols-2 gap-3" data-ai-id="copy-ai-id-editor-style-effects-grid">
        <CssStepper
          property="opacity"
          label="투명도"
          dataAiId="copy-ai-id-editor-visual-opacity"
          disabled={disabled}
          mode="opacity"
        />
        <CssPresetSelect
          property="transform"
          label="변형"
          dataAiId="copy-ai-id-editor-visual-transform"
          disabled={disabled}
        />
      </div>
      <CssTextarea
        property="box-shadow"
        label="그림자"
        dataAiId="copy-ai-id-editor-visual-box-shadow"
        disabled={disabled}
        placeholder="0 8px 20px rgba(0, 0, 0, 0.18)"
        presets={BOX_SHADOW_PRESETS}
        rows={2}
      />
      <CssTextarea
        property="text-shadow"
        label="글자 그림자"
        dataAiId="copy-ai-id-editor-visual-text-shadow"
        disabled={disabled}
        placeholder="0 2px 4px rgba(0, 0, 0, 0.38)"
        presets={TEXT_SHADOW_PRESETS}
        rows={2}
      />
      <CssTextarea
        property="filter"
        label="필터"
        dataAiId="copy-ai-id-editor-visual-filter"
        disabled={disabled}
        placeholder="blur(4px) brightness(1.1)"
        presets={FILTER_PRESETS}
        rows={2}
      />
      <CssTextarea
        property="backdrop-filter"
        label="배경 필터"
        dataAiId="copy-ai-id-editor-visual-backdrop-filter"
        disabled={disabled}
        placeholder="blur(12px)"
        presets={FILTER_PRESETS}
        rows={2}
      />
    </StyleControlGroup>
  );
}
