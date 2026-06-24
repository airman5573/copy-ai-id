import { useEffect, useRef, type ReactElement, type ReactNode } from 'react';

import { DropdownSelect } from './DropdownSelect';
import { selectTextInputValue } from './inputSelection';
import { VisualControl, VisualResetButton } from './VisualControl';
import { stepNumericInputValue, type NumericStepDirection } from '../../utils/numericInput';

export type UnitOption = {
  value: string;
  label: string;
};

export type UnitValueInputProps = {
  label: string;
  dataAiId: string;
  value: string;
  unit: string;
  units: UnitOption[];
  disabled?: boolean;
  readOnly?: boolean;
  valueReadOnly?: boolean;
  helperText?: string;
  errorText?: string;
  placeholder?: string;
  leadingControl?: ReactNode;
  labelLayout?: 'stacked' | 'inline';
  onValueChange?: (value: string) => void;
  onUnitChange?: (unit: string) => void;
  onCommit?: () => void;
  onReset?: () => void;
  onHighlightChange?: (active: boolean) => void;
};

export function UnitValueInput({
  label,
  dataAiId,
  value,
  unit,
  units,
  disabled = false,
  readOnly = false,
  valueReadOnly = false,
  helperText,
  errorText,
  placeholder = '0',
  leadingControl,
  labelLayout = 'stacked',
  onValueChange,
  onUnitChange,
  onCommit,
  onReset,
  onHighlightChange,
}: UnitValueInputProps): ReactElement {
  const canEditValue = !disabled && !readOnly && !valueReadOnly;
  const canSelectUnit = !disabled && !readOnly && units.length > 1;

  const hoveredRef = useRef(false);
  const focusedRef = useRef(false);
  const highlightActiveRef = useRef(false);
  const onHighlightChangeRef = useRef(onHighlightChange);
  onHighlightChangeRef.current = onHighlightChange;

  const syncHighlight = (): void => {
    const next = !disabled && (hoveredRef.current || focusedRef.current);
    if (next === highlightActiveRef.current) {
      return;
    }
    highlightActiveRef.current = next;
    onHighlightChangeRef.current?.(next);
  };

  const stepValue = (direction: NumericStepDirection): void => {
    if (!canEditValue) {
      return;
    }
    const next = stepNumericInputValue(value, direction, unit === 'rem' || unit === 'em' ? 0.1 : 1);
    if (next === value) {
      return;
    }
    onValueChange?.(next);
    onCommit?.();
  };

  useEffect(
    () => () => {
      if (highlightActiveRef.current) {
        onHighlightChangeRef.current?.(false);
      }
    },
    [],
  );

  return (
    <VisualControl
      label={label}
      dataAiId={`${dataAiId}-field`}
      helperText={helperText}
      errorText={errorText}
      disabled={disabled}
      layout={labelLayout}
      leadingLabelControl={labelLayout === 'inline' ? leadingControl : undefined}
      actions={onReset ? <VisualResetButton dataAiId={`${dataAiId}-reset-button`} disabled={disabled} onClick={onReset} /> : undefined}
    >
      <div
        className="flex min-w-0 rounded-lg border border-gray-700 bg-gray-950/80 focus-within:border-blue-500/70 focus-within:ring-2 focus-within:ring-blue-500/20"
        data-ai-id={`${dataAiId}-control-row`}
        onMouseEnter={() => {
          hoveredRef.current = true;
          syncHighlight();
        }}
        onMouseLeave={() => {
          hoveredRef.current = false;
          syncHighlight();
        }}
        onFocus={() => {
          focusedRef.current = true;
          syncHighlight();
        }}
        onBlur={(event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
            return;
          }
          focusedRef.current = false;
          syncHighlight();
        }}
      >
        {leadingControl && labelLayout !== 'inline' ? (
          <span
            className="flex shrink-0 items-center justify-center border-r border-gray-700 bg-gray-900/70 px-1.5 text-gray-400"
            data-ai-id={`${dataAiId}-leading-control`}
          >
            {leadingControl}
          </span>
        ) : null}
        <input
          type="text"
          inputMode="decimal"
          value={value}
          readOnly={!canEditValue}
          disabled={disabled}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent px-2.5 py-2 font-mono text-[11px] text-gray-100 outline-none placeholder:text-gray-600 disabled:cursor-not-allowed disabled:text-gray-600"
          onFocus={(event) => selectTextInputValue(event.currentTarget)}
          onClick={(event) => selectTextInputValue(event.currentTarget)}
          onChange={(event) => onValueChange?.(event.currentTarget.value)}
          onBlur={onCommit}
          onKeyDown={(event) => {
            if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
              event.preventDefault();
              stepValue(event.key === 'ArrowUp' ? 1 : -1);
              return;
            }
            if (event.key === 'Enter') {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
          data-ai-id={dataAiId}
        />
        <DropdownSelect
          dataAiId={`${dataAiId}-unit-select`}
          value={unit}
          disabled={!canSelectUnit}
          options={units}
          showPlaceholderOption={false}
          className="relative shrink-0 border-l border-gray-700"
          buttonClassName="relative h-full w-14 rounded-r-lg bg-gray-900 py-2 pl-2 pr-6 text-left text-[11px] font-bold text-gray-300 outline-none transition hover:bg-gray-800 focus:bg-gray-800 disabled:cursor-not-allowed disabled:text-gray-600"
          dropdownClassName="absolute right-0 z-20 mt-1 w-20 overflow-hidden rounded-lg border border-blue-500/40 bg-gray-950 py-1 shadow-xl shadow-black/40"
          optionDataAiId={`${dataAiId}-unit-select-option`}
          onChange={onUnitChange}
        />
      </div>
    </VisualControl>
  );
}
