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
  { value: 'cover', label: 'Cover' },
  { value: 'contain', label: 'Contain' },
  { value: 'auto', label: 'Auto' },
];

const BACKGROUND_REPEAT_OPTIONS = [
  { value: 'no-repeat', label: 'No repeat' },
  { value: 'repeat', label: 'Repeat' },
  { value: 'repeat-x', label: 'Repeat X' },
  { value: 'repeat-y', label: 'Repeat Y' },
  { value: 'round', label: 'Round' },
  { value: 'space', label: 'Space' },
];

const BACKGROUND_POSITION_PRESETS = [
  { value: 'center', label: 'Center' },
  { value: 'top', label: 'Top' },
  { value: 'right', label: 'Right' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'left', label: 'Left' },
  { value: '50% 50%', label: '50% 50%' },
  { value: 'top right', label: 'Top right' },
  { value: 'bottom left', label: 'Bottom left' },
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
      control: { id: 'style:background-image', label: 'Background image' },
    });
  };

  return (
    <StyleControlGroup
      title="Background image"
      dataAiId="copy-ai-id-editor-style-background-image-group"
    >
      <VisualControl
        label="Image URL / CSS image"
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
                control: { id: 'style:background-image', label: 'Background image' },
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
          label="Size"
          dataAiId="copy-ai-id-editor-visual-background-size"
          disabled={!canEdit}
          options={BACKGROUND_SIZE_OPTIONS}
        />
        <CssPresetSelect
          property="background-repeat"
          label="Repeat"
          dataAiId="copy-ai-id-editor-visual-background-repeat"
          disabled={!canEdit}
          options={BACKGROUND_REPEAT_OPTIONS}
        />
      </div>
      <CssTextInput
        property="background-position"
        label="Position"
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
