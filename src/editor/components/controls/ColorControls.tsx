import { type ReactElement } from 'react';

import { useDraftValue } from './useDraftValue';

import { useStyleEdit } from '../../visual/useStyleEdit';
import { ColorInput, type ColorPresetOption } from '../visual/ColorInput';
import { StyleControlGroup } from './styleControlHelpers';

export type ColorControlsProps = {
  disabled?: boolean;
};

const COLOR_PRESETS: ColorPresetOption[] = [
  { value: 'transparent', label: 'Transparent' },
  { value: 'currentColor', label: 'Current color' },
  { value: '#000000', label: 'Black' },
  { value: '#ffffff', label: 'White' },
  { value: '#ef4444', label: 'Red' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#10b981', label: 'Green' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#8b5cf6', label: 'Violet' },
];

export function ColorControls({ disabled = false }: ColorControlsProps): ReactElement {
  const edit = useStyleEdit();
  const canEdit = edit.canEdit && !disabled;

  return (
    <StyleControlGroup
      title="Color"
      description="텍스트 색상과 배경 색상을 CSS color/background-color로 적용합니다."
      dataAiId="copy-ai-id-editor-style-color-group"
    >
      <ColorStyleInput
        property="color"
        label="Text color"
        dataAiId="copy-ai-id-editor-visual-text-color"
        disabled={!canEdit}
        helperText="hex, rgba, transparent 값을 사용할 수 있습니다."
      />
      <ColorStyleInput
        property="background-color"
        label="Background color"
        dataAiId="copy-ai-id-editor-visual-background-color"
        disabled={!canEdit}
        helperText="배경을 지우려면 reset을 누르거나 transparent를 선택하세요."
      />
    </StyleControlGroup>
  );
}

function ColorStyleInput({
  property,
  label,
  dataAiId,
  disabled,
  helperText,
}: {
  property: string;
  label: string;
  dataAiId: string;
  disabled: boolean;
  helperText?: string;
}): ReactElement {
  const edit = useStyleEdit();
  const committed = edit.valueOf(property);
  const [draft, setDraft] = useDraftValue(committed, property);

  const commit = (value = draft): void => {
    edit.commitStyle(property, value, {
      category: 'style',
      control: { id: `style:${property}`, label },
    });
  };

  return (
    <ColorInput
      label={label}
      dataAiId={dataAiId}
      value={draft}
      disabled={disabled}
      helperText={helperText}
      presets={COLOR_PRESETS}
      presetValue={committed}
      onChange={setDraft}
      onPresetSelect={(value) => {
        setDraft(value);
        commit(value);
      }}
      onCommit={() => commit()}
      onReset={() => {
        setDraft('');
        edit.resetStyle(property, {
          category: 'style',
          control: { id: `style:${property}`, label },
        });
      }}
    />
  );
}
