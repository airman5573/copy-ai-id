import type { ReactElement, ReactNode } from 'react';

import { DropdownSelect, type DropdownSelectOption } from './DropdownSelect';
import { VisualControl, VisualResetButton } from './VisualControl';

export type VisualPresetOption = {
  value: string;
  label: string;
};

export type PresetSelectProps = {
  label: string;
  dataAiId: string;
  value: string;
  options: VisualPresetOption[];
  disabled?: boolean;
  helperText?: string;
  placeholderLabel?: string;
  showPlaceholderOption?: boolean;
  renderValue?: (option: DropdownSelectOption | null) => ReactNode;
  renderOption?: (option: DropdownSelectOption) => ReactNode;
  onChange?: (value: string) => void;
  onReset?: () => void;
};

export function PresetSelect({
  label,
  dataAiId,
  value,
  options,
  disabled = false,
  helperText,
  placeholderLabel = '—',
  showPlaceholderOption = false,
  renderValue,
  renderOption,
  onChange,
  onReset,
}: PresetSelectProps): ReactElement {
  return (
    <VisualControl
      label={label}
      dataAiId={`${dataAiId}-field`}
      helperText={helperText}
      disabled={disabled}
      actions={onReset ? <VisualResetButton dataAiId={`${dataAiId}-reset-button`} disabled={disabled} onClick={onReset} /> : undefined}
    >
      <DropdownSelect
        dataAiId={dataAiId}
        value={value}
        options={options}
        disabled={disabled}
        placeholderLabel={placeholderLabel}
        showPlaceholderOption={showPlaceholderOption}
        renderValue={renderValue}
        renderOption={renderOption}
        onChange={onChange}
      />
    </VisualControl>
  );
}
