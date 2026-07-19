import { useEffect, useId, useRef, useState, type ReactElement, type ReactNode } from 'react';

import { resolveEditorEventElement } from '../../editor-shadow-root';
import {
  announceVisualDropdownOpen,
  listenForOtherVisualDropdowns,
  listenForVisualDropdownCloseAll,
} from './dropdownCoordinator';

export type DropdownSelectOption = {
  value: string;
  label: string;
};

export type DropdownSelectProps = {
  dataAiId: string;
  value: string;
  options: DropdownSelectOption[];
  placeholderLabel?: string;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
  buttonClassName?: string;
  dropdownClassName?: string;
  optionDataAiId?: string;
  placeholderDataAiId?: string;
  showPlaceholderOption?: boolean;
  renderValue?: (option: DropdownSelectOption | null) => ReactNode;
  renderOption?: (option: DropdownSelectOption) => ReactNode;
  onChange?: (value: string) => void;
};

const DEFAULT_BUTTON_CLASS =
  'relative w-full rounded-lg border border-gray-700 bg-gray-950/80 py-2 pl-2.5 pr-8 text-left text-[11px] font-semibold text-gray-100 outline-none transition hover:border-gray-600 focus:border-blue-500/70 focus:ring-2 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:text-gray-600';
const DEFAULT_DROPDOWN_CLASS =
  'absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-lg border border-blue-500/40 bg-gray-950 py-1 shadow-xl shadow-black/40';

export function DropdownSelect({
  dataAiId,
  value,
  options,
  placeholderLabel = '—',
  disabled = false,
  ariaLabel,
  className = 'relative',
  buttonClassName = DEFAULT_BUTTON_CLASS,
  dropdownClassName = DEFAULT_DROPDOWN_CLASS,
  optionDataAiId,
  placeholderDataAiId,
  showPlaceholderOption = false,
  renderValue,
  renderOption,
  onChange,
}: DropdownSelectProps): ReactElement {
  const [open, setOpen] = useState(false);
  const dropdownId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selected = options.find((option) => option.value === value) ?? null;

  useEffect(() => listenForOtherVisualDropdowns(dropdownId, () => setOpen(false)), [dropdownId]);
  useEffect(() => listenForVisualDropdownCloseAll(() => setOpen(false)), []);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent): void => {
      const element = resolveEditorEventElement(event);
      if (!element || !rootRef.current?.contains(element)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const selectValue = (next: string): void => {
    onChange?.(next);
    setOpen(false);
  };

  const previewAdjacentOption = (direction: 1 | -1): void => {
    if (options.length === 0 || disabled) {
      return;
    }
    const currentIndex = options.findIndex((option) => option.value === value);
    const nextIndex = currentIndex < 0
      ? direction > 0 ? 0 : options.length - 1
      : (currentIndex + direction + options.length) % options.length;
    announceVisualDropdownOpen(dropdownId);
    onChange?.(options[nextIndex].value);
    setOpen(true);
  };

  const label = renderValue ? renderValue(selected) : selected?.label;

  return (
    <div className={className} ref={rootRef} onPointerDown={(event) => event.stopPropagation()} data-ai-id={`${dataAiId}-wrapper`} data-ai-editor-dropdown-id={dropdownId}>
      <button
        type="button"
        className={buttonClassName}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => {
          setOpen((current) => {
            if (current) {
              return false;
            }
            announceVisualDropdownOpen(dropdownId);
            return true;
          });
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
            return;
          }
          if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
            return;
          }
          event.preventDefault();
          previewAdjacentOption(event.key === 'ArrowUp' ? -1 : 1);
        }}
        data-ai-id={dataAiId}
      >
        <span
          className={selected ? 'block min-w-0 truncate' : 'block min-w-0 truncate text-gray-300'}
          data-ai-id={`${dataAiId}-value-text`}
        >
          {label || placeholderLabel}
        </span>
        <span
          className="absolute inset-y-0 right-0 flex w-8 items-center justify-center text-gray-300 transition hover:text-blue-200"
          data-ai-id={`${dataAiId}-toggle-button`}
        >
          <svg
            className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180 text-blue-200' : ''}`}
            viewBox="0 0 12 12"
            fill="none"
            aria-hidden="true"
            data-ai-id={`${dataAiId}-toggle-button-icon`}
          >
            <path
              d="M3 4.5 6 7.5l3-3"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              data-ai-id={`${dataAiId}-toggle-button-icon-path`}
            />
          </svg>
        </span>
      </button>
      {open ? (
        <div className={dropdownClassName} role="listbox" data-ai-id={`${dataAiId}-dropdown`}>
          {showPlaceholderOption ? (
            <button
              type="button"
              className={`block w-full px-2.5 py-1.5 text-left text-[11px] font-semibold transition hover:bg-blue-500/15 ${
                value === '' ? 'bg-blue-500/15 text-blue-100' : 'text-gray-400'
              }`}
              onClick={() => selectValue('')}
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              role="option"
              aria-selected={value === ''}
              data-ai-id={placeholderDataAiId ?? `${dataAiId}-placeholder-option`}
            >
              {placeholderLabel}
            </button>
          ) : null}
          {options.map((option) => {
            const active = value === option.value;
            return (
              <button
                key={option.value}
                type="button"
                className={`block w-full px-2.5 py-1.5 text-left text-[11px] font-semibold transition hover:bg-blue-500/15 ${
                  active ? 'bg-blue-500/15 text-blue-100' : 'text-gray-200'
                }`}
                onClick={() => selectValue(option.value)}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                role="option"
                aria-selected={active}
                data-ai-id={optionDataAiId ?? `${dataAiId}-option`}
              >
                {renderOption ? renderOption(option) : option.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
