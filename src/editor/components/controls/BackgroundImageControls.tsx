import { type ReactElement } from 'react';

import { useDraftValue } from './useDraftValue';

import { useStyleEdit } from '../../visual/useStyleEdit';
import { CssPresetSelect, CssTextInput, StyleControlGroup } from './styleControlHelpers';
import { VisualControl, VisualResetButton } from '../visual/VisualControl';
import { selectTextInputValue } from '../visual/inputSelection';

export type BackgroundImageControlsProps = {
  disabled?: boolean;
};

const BACKGROUND_SIZE_OPTIONS = [
  { value: 'cover', label: '꽉 채우기' },
  { value: 'contain', label: '모두 보기' },
  { value: 'auto', label: '자동' },
];

const BACKGROUND_REPEAT_OPTIONS = [
  { value: 'no-repeat', label: '반복 없음' },
  { value: 'repeat', label: '반복' },
  { value: 'repeat-x', label: '가로 반복' },
  { value: 'repeat-y', label: '세로 반복' },
  { value: 'round', label: '둥글게 반복' },
  { value: 'space', label: '간격 반복' },
];

const BACKGROUND_POSITION_PRESETS = [
  { value: 'center', label: '가운데' },
  { value: 'top', label: '위' },
  { value: 'right', label: '오른쪽' },
  { value: 'bottom', label: '아래' },
  { value: 'left', label: '왼쪽' },
  { value: '50% 50%', label: '50% 50%' },
  { value: 'top right', label: '오른쪽 위' },
  { value: 'bottom left', label: '왼쪽 아래' },
];

export function BackgroundImageControls({ disabled = false }: BackgroundImageControlsProps): ReactElement {
  const edit = useStyleEdit();
  const canEdit = edit.canEdit && !disabled;
  const committed = edit.valueOf('background-image');
  const [draft, setDraft] = useDraftValue(backgroundImageToInputValue(committed));

  const commitBackgroundImage = (value: string): void => {
    const next = normalizeBackgroundImageInput(value);
    setDraft(backgroundImageToInputValue(next));
    edit.commitStyle('background-image', next, {
      category: 'style',
      control: { id: 'style:background-image', label: '배경 이미지' },
    });
  };

  return (
    <StyleControlGroup
      title="배경 이미지"
      dataAiId="copy-ai-id-editor-style-background-image-group"
    >
      <VisualControl
        label="이미지 주소 / CSS"
        dataAiId="copy-ai-id-editor-visual-background-image-field"
        disabled={!canEdit}
        actions={
          <VisualResetButton
            dataAiId="copy-ai-id-editor-visual-background-image-reset-button"
            disabled={!canEdit}
            onClick={() => {
              setDraft('');
              edit.resetStyle('background-image', {
                category: 'style',
                control: { id: 'style:background-image', label: '배경 이미지' },
              });
            }}
          />
        }
      >
        <input
          type="text"
          value={draft}
          disabled={!canEdit}
          placeholder="https://example.com/image.jpg"
          className="w-full rounded-lg border border-gray-700 bg-gray-950/80 px-2.5 py-2 font-mono text-[11px] text-gray-100 outline-none transition placeholder:text-gray-500 focus:border-blue-500/70 focus:ring-2 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:text-gray-600"
          onFocus={(event) => selectTextInputValue(event.currentTarget)}
          onClick={(event) => selectTextInputValue(event.currentTarget)}
          onChange={(event) => setDraft(event.currentTarget.value)}
          onBlur={() => commitBackgroundImage(draft)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
          data-ai-id="copy-ai-id-editor-visual-background-image-input"
        />
      </VisualControl>
      <div className="grid grid-cols-2 gap-3" data-ai-id="copy-ai-id-editor-style-background-options-grid">
        <CssPresetSelect
          property="background-size"
          label="크기"
          dataAiId="copy-ai-id-editor-visual-background-size"
          disabled={!canEdit}
          options={BACKGROUND_SIZE_OPTIONS}
        />
        <CssPresetSelect
          property="background-repeat"
          label="반복"
          dataAiId="copy-ai-id-editor-visual-background-repeat"
          disabled={!canEdit}
          options={BACKGROUND_REPEAT_OPTIONS}
        />
      </div>
      <CssTextInput
        property="background-position"
        label="위치"
        dataAiId="copy-ai-id-editor-visual-background-position"
        disabled={!canEdit}
        placeholder="center"
        presets={BACKGROUND_POSITION_PRESETS}
      />
    </StyleControlGroup>
  );
}

function normalizeBackgroundImageInput(value: string): string {
  const trimmed = value.trim();
  if (trimmed === '' || trimmed === 'none') {
    return trimmed;
  }
  if (/^(url|linear-gradient|radial-gradient|conic-gradient|image-set|var)\(/i.test(trimmed)) {
    return trimmed;
  }
  return `url("${trimmed.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}")`;
}

function backgroundImageToInputValue(value: string): string {
  const trimmed = value.trim();
  const match = /^url\((['"]?)(.*?)\1\)$/i.exec(trimmed);
  return match ? match[2] : trimmed === 'none' ? '' : trimmed;
}
