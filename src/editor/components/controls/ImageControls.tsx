import { useEffect, useState, type ReactElement } from 'react';

import { getCurrentMessages } from '../../../shared/i18n';
import { useAttributeEdit } from '../../visual/useAttributeEdit';
import { useStyleEdit } from '../../visual/useStyleEdit';
import { selectTextInputValue } from '../visual/inputSelection';
import { VisualControl, VisualResetButton } from '../visual/VisualControl';
import { BackgroundImageControls } from './BackgroundImageControls';
import {
  CssPresetSelect,
  CssTextInput,
  StyleControlGroup,
} from './styleControlHelpers';

export type ImageControlsProps = {
  disabled?: boolean;
};

const ASPECT_RATIO_PRESETS = [
  { label: 'Auto', value: 'auto' },
  { label: '1:1', value: '1 / 1' },
  { label: '4:3', value: '4 / 3' },
  { label: '16:9', value: '16 / 9' },
  { label: '3:4', value: '3 / 4' },
] as const;

const OBJECT_POSITION_PRESETS = [
  { label: 'Center', value: 'center' },
  { label: 'Top', value: 'top' },
  { label: 'Right', value: 'right' },
  { label: 'Bottom', value: 'bottom' },
  { label: 'Left', value: 'left' },
] as const;

// Image-intent section: consolidates src/alt attributes, object sizing, and
// the background-image group that used to be scattered across categories.
export function ImageControls({ disabled = false }: ImageControlsProps): ReactElement {
  const attributeEdit = useAttributeEdit();
  const styleEdit = useStyleEdit();
  const canEdit = attributeEdit.canEdit && !disabled;
  const messages = getCurrentMessages().visualEditor.quickToolbar.attribute;

  return (
    <div className="space-y-4" data-ai-id="copy-ai-id-editor-image-controls">
      <StyleControlGroup title="Source" dataAiId="copy-ai-id-editor-image-source-group">
        <ImageAttributeInput
          name="src"
          label={messages.imageSrcLabel}
          placeholder="https://example.com/image.jpg"
          dataAiId="copy-ai-id-editor-visual-image-src"
          disabled={!canEdit}
        />
        <ImageAttributeInput
          name="alt"
          label={messages.imageAltLabel}
          dataAiId="copy-ai-id-editor-visual-image-alt"
          disabled={!canEdit}
        />
      </StyleControlGroup>

      <StyleControlGroup title="Fit" dataAiId="copy-ai-id-editor-image-fit-group">
        <div className="grid grid-cols-2 gap-3" data-ai-id="copy-ai-id-editor-image-fit-grid">
          <CssPresetSelect
            property="object-fit"
            label="Object fit"
            dataAiId="copy-ai-id-editor-visual-object-fit"
            disabled={!styleEdit.canEdit || disabled}
            category="size"
          />
          <CssTextInput
            property="object-position"
            label="Object position"
            dataAiId="copy-ai-id-editor-visual-object-position"
            disabled={!styleEdit.canEdit || disabled}
            placeholder="center"
            presets={OBJECT_POSITION_PRESETS}
            category="size"
          />
        </div>
        <CssTextInput
          property="aspect-ratio"
          label="Aspect ratio"
          dataAiId="copy-ai-id-editor-visual-aspect-ratio"
          disabled={!styleEdit.canEdit || disabled}
          placeholder="16 / 9"
          presets={ASPECT_RATIO_PRESETS}
          category="size"
        />
      </StyleControlGroup>

      <BackgroundImageControls disabled={disabled} />
    </div>
  );
}

function ImageAttributeInput({
  name,
  label,
  placeholder,
  dataAiId,
  disabled,
}: {
  name: 'src' | 'alt';
  label: string;
  placeholder?: string;
  dataAiId: string;
  disabled: boolean;
}): ReactElement {
  const edit = useAttributeEdit();
  const committed = edit.valueOf(name);
  const [draft, setDraft] = useState(committed);

  useEffect(() => {
    setDraft(committed);
  }, [committed, edit.targetKey]);

  const commit = (): void => {
    if (draft === committed) {
      return;
    }

    edit.commitAttribute(name, draft.trim() === '' ? null : draft.trim(), {
      control: { id: `attribute:${name}`, label },
    });
  };

  return (
    <VisualControl
      label={label}
      dataAiId={`${dataAiId}-field`}
      disabled={disabled}
      actions={
        <VisualResetButton
          dataAiId={`${dataAiId}-reset-button`}
          disabled={disabled}
          onClick={() => setDraft(committed)}
        />
      }
    >
      <input
        type="text"
        value={draft}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-600 bg-gray-950/80 px-2.5 py-2 font-mono text-[11px] text-gray-100 outline-none transition placeholder:text-gray-500 focus:border-blue-500/70 focus:ring-2 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:text-gray-600"
        onFocus={(event) => selectTextInputValue(event.currentTarget)}
        onChange={(event) => setDraft(event.currentTarget.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
        data-ai-id={dataAiId}
      />
    </VisualControl>
  );
}
