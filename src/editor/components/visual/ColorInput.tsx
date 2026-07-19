import { useEffect, useId, useRef, useState, type ReactElement, type ReactNode } from 'react';

import { resolveEditorEventElement } from '../../editor-shadow-root';
import {
  announceVisualDropdownOpen,
  listenForOtherVisualDropdowns,
  listenForVisualDropdownCloseAll,
} from './dropdownCoordinator';
import { selectTextInputValue } from './inputSelection';
import { VisualControl, VisualResetButton } from './VisualControl';

export type ColorPresetOption = {
  value: string;
  label: string;
};

export type ColorInputProps = {
  label: string;
  dataAiId: string;
  value: string;
  disabled?: boolean;
  helperText?: string;
  presets?: ColorPresetOption[];
  presetValue?: string;
  presetDataAiId?: string;
  presetPlaceholderLabel?: string;
  renderPresetOption?: (option: ColorPresetOption) => ReactNode;
  onChange?: (value: string) => void;
  onPresetSelect?: (value: string) => void;
  onCommit?: () => void;
  onReset?: () => void;
};

export function ColorInput({
  label,
  dataAiId,
  value,
  disabled = false,
  helperText,
  presets = [],
  presetValue,
  presetDataAiId,
  presetPlaceholderLabel = '팔레트',
  renderPresetOption,
  onChange,
  onPresetSelect,
  onCommit,
  onReset,
}: ColorInputProps): ReactElement {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const dropdownId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const parsedColor = parseColorInputValue(value);
  const colorValue = parsedColor.hex;
  const opacityValue = formatOpacityInputValue(parsedColor.opacity);
  const [hexFocused, setHexFocused] = useState(false);
  const [hexDraft, setHexDraft] = useState(colorValue);
  const hasPalette = presets.length > 0;
  const activePresetValue = presetValue ?? value;
  const resolvedPresetDataAiId = presetDataAiId ?? `${dataAiId}-preset`;

  useEffect(() => {
    if (!hexFocused) {
      setHexDraft(colorValue);
    }
  }, [colorValue, hexFocused]);

  useEffect(() => listenForOtherVisualDropdowns(dropdownId, () => setPaletteOpen(false)), [dropdownId]);
  useEffect(() => listenForVisualDropdownCloseAll(() => setPaletteOpen(false)), []);

  useEffect(() => {
    if (!paletteOpen) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent): void => {
      const element = resolveEditorEventElement(event);
      if (!element || !rootRef.current?.contains(element)) {
        setPaletteOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setPaletteOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [paletteOpen]);

  const selectPreset = (nextValue: string): void => {
    onChange?.(nextValue);
    onPresetSelect?.(nextValue);
    setPaletteOpen(false);
  };

  const changeColorPreservingOpacity = (nextHex: string): void => {
    onChange?.(composeColorWithOpacity(nextHex, parsedColor.opacity));
  };

  const changeHexDraft = (nextHex: string): void => {
    setHexDraft(nextHex);
    const parsedHex = parseHexColorValue(nextHex.trim());
    if (!parsedHex) {
      return;
    }
    onChange?.(composeColorWithOpacity(parsedHex.hex, parsedHex.opacity === 100 ? parsedColor.opacity : parsedHex.opacity));
  };

  const commitHexDraft = (): void => {
    const parsedHex = parseHexColorValue(hexDraft.trim());
    if (parsedHex) {
      onChange?.(composeColorWithOpacity(parsedHex.hex, parsedHex.opacity === 100 ? parsedColor.opacity : parsedHex.opacity));
    } else {
      setHexDraft(colorValue);
    }
    setHexFocused(false);
    onCommit?.();
  };

  const changeOpacity = (nextOpacity: string | number): void => {
    onChange?.(composeColorWithOpacity(colorValue, nextOpacity));
  };

  const previewAdjacentPreset = (direction: 1 | -1): void => {
    if (!hasPalette || disabled) {
      return;
    }
    const currentIndex = presets.findIndex((option) => option.value === activePresetValue);
    const nextIndex = currentIndex < 0
      ? direction > 0 ? 0 : presets.length - 1
      : (currentIndex + direction + presets.length) % presets.length;
    const nextValue = presets[nextIndex]?.value;
    if (!nextValue) {
      return;
    }
    announceVisualDropdownOpen(dropdownId);
    setPaletteOpen(true);
    onChange?.(nextValue);
    onPresetSelect?.(nextValue);
  };

  return (
    <VisualControl
      label={label}
      dataAiId={`${dataAiId}-field`}
      helperText={helperText}
      disabled={disabled}
      actions={onReset ? <VisualResetButton dataAiId={`${dataAiId}-reset-button`} disabled={disabled} onClick={onReset} /> : undefined}
    >
      <div className="relative" ref={rootRef} onPointerDown={(event) => event.stopPropagation()} data-ai-id={`${dataAiId}-wrapper`}>
        <div
          className="flex min-w-0 overflow-hidden rounded-lg border border-gray-700 bg-gray-950/80 focus-within:border-blue-500/70 focus-within:ring-2 focus-within:ring-blue-500/30"
          data-ai-id={`${dataAiId}-control-row`}
        >
          <input
            type="color"
            value={colorValue}
            disabled={disabled}
            className="h-9 w-10 shrink-0 cursor-pointer border-0 bg-transparent p-1 disabled:cursor-not-allowed disabled:opacity-50"
            onChange={(event) => changeColorPreservingOpacity(event.currentTarget.value)}
            onBlur={onCommit}
            data-ai-id={`${dataAiId}-swatch-input`}
          />
          <input
            type="text"
            value={hexFocused ? hexDraft : colorValue}
            disabled={disabled}
            className="min-w-0 flex-1 bg-transparent px-2.5 py-2 font-mono text-[11px] text-gray-100 outline-none placeholder:text-gray-500 disabled:cursor-not-allowed disabled:text-gray-600"
            placeholder="#000000"
            onFocus={(event) => {
              setHexFocused(true);
              setHexDraft(colorValue);
              selectTextInputValue(event.currentTarget);
            }}
            onClick={(event) => selectTextInputValue(event.currentTarget)}
            onChange={(event) => changeHexDraft(event.currentTarget.value)}
            onBlur={commitHexDraft}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                event.currentTarget.blur();
              }
            }}
            data-ai-id={dataAiId}
          />
          <div
            className="flex h-9 w-20 shrink-0 items-center border-l border-gray-700 bg-gray-900/70"
            data-ai-id={`${dataAiId}-opacity-control`}
          >
            <input
              type="text"
              inputMode="decimal"
              value={opacityValue}
              disabled={disabled}
              className="min-w-0 flex-1 bg-transparent px-2 py-2 text-right font-mono text-[11px] text-gray-100 outline-none placeholder:text-gray-500 disabled:cursor-not-allowed disabled:text-gray-600"
              placeholder="100"
              onFocus={(event) => selectTextInputValue(event.currentTarget)}
              onClick={(event) => selectTextInputValue(event.currentTarget)}
              onChange={(event) => changeOpacity(event.currentTarget.value)}
              onBlur={onCommit}
              onKeyDown={(event) => {
                if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                  event.preventDefault();
                  changeOpacity(parsedColor.opacity + (event.key === 'ArrowUp' ? 1 : -1));
                  return;
                }
                if (event.key === 'Enter') {
                  event.preventDefault();
                  event.currentTarget.blur();
                }
              }}
              data-ai-id={`${dataAiId}-opacity-input`}
            />
            <span className="pr-2 text-[10px] font-bold text-gray-300" data-ai-id={`${dataAiId}-opacity-unit-text`}>
              %
            </span>
          </div>
          {hasPalette ? (
            <button
              type="button"
              className="relative flex h-9 w-8 shrink-0 items-center justify-center border-l border-gray-700 bg-gray-900 text-gray-300 outline-none transition hover:bg-gray-800 hover:text-blue-200 focus:bg-gray-800 focus:text-blue-200 disabled:cursor-not-allowed disabled:text-gray-600"
              disabled={disabled}
              aria-haspopup="listbox"
              aria-expanded={paletteOpen}
              aria-label={presetPlaceholderLabel}
              onClick={() => {
                setPaletteOpen((current) => {
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
                  setPaletteOpen(false);
                  return;
                }
                if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
                  return;
                }
                event.preventDefault();
                previewAdjacentPreset(event.key === 'ArrowUp' ? -1 : 1);
              }}
              data-ai-id={resolvedPresetDataAiId}
            >
              <span
                className="flex h-full w-full items-center justify-center text-gray-300"
                data-ai-id={`${resolvedPresetDataAiId}-toggle-button`}
              >
                <svg
                  className={`h-3.5 w-3.5 transition-transform ${paletteOpen ? 'rotate-180 text-blue-200' : ''}`}
                  viewBox="0 0 12 12"
                  fill="none"
                  aria-hidden="true"
                  data-ai-id={`${resolvedPresetDataAiId}-toggle-button-icon`}
                >
                  <path
                    d="M3 4.5 6 7.5l3-3"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    data-ai-id={`${resolvedPresetDataAiId}-toggle-button-icon-path`}
                  />
                </svg>
              </span>
            </button>
          ) : null}
        </div>
        {hasPalette && paletteOpen ? (
          <div
            className="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-lg border border-blue-500/40 bg-gray-950 py-1 shadow-xl shadow-black/40"
            role="listbox"
            data-ai-id={`${resolvedPresetDataAiId}-dropdown`}
          >
            {presets.map((option) => {
              const active = option.value === activePresetValue;
              return (
                <button
                  key={option.value}
                  type="button"
                  className={`block w-full px-2.5 py-1.5 text-left text-[11px] font-semibold transition hover:bg-blue-500/15 ${
                    active ? 'bg-blue-500/15 text-blue-100' : 'text-gray-200'
                  }`}
                  onClick={() => selectPreset(option.value)}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  role="option"
                  aria-selected={active}
                  data-ai-id={`${resolvedPresetDataAiId}-option`}
                >
                  {renderPresetOption ? renderPresetOption(option) : option.label}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </VisualControl>
  );
}

function normalizeColorInputValue(value: string): string {
  return parseColorInputValue(value).hex;
}

function parseColorInputValue(value: string): { hex: string; opacity: number } {
  const trimmed = value.trim();
  if (trimmed === '') {
    return { hex: '#000000', opacity: 100 };
  }
  if (trimmed.toLowerCase() === 'transparent') {
    return { hex: '#000000', opacity: 0 };
  }

  const hex = parseHexColorValue(trimmed);
  if (hex) {
    return hex;
  }

  const rgb = parseRgbColorValue(trimmed);
  if (rgb) {
    return rgb;
  }

  return { hex: '#000000', opacity: 100 };
}

function parseHexColorValue(value: string): { hex: string; opacity: number } | null {
  const match = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.exec(value);
  if (!match) {
    return null;
  }

  const raw = match[1];
  const expanded = raw.length === 3 || raw.length === 4
    ? raw.split('').map((char) => `${char}${char}`).join('')
    : raw;
  const hex = `#${expanded.slice(0, 6).toLowerCase()}`;
  const opacity = expanded.length === 8 ? (Number.parseInt(expanded.slice(6, 8), 16) / 255) * 100 : 100;
  return { hex, opacity: clampOpacity(opacity) };
}

function parseRgbColorValue(value: string): { hex: string; opacity: number } | null {
  const match = /^rgba?\((.+)\)$/i.exec(value);
  if (!match) {
    return null;
  }

  const parts = match[1]
    .trim()
    .split(/[\s,/]+/)
    .filter(Boolean);
  if (parts.length < 3) {
    return null;
  }

  const channels = parts.slice(0, 3).map(parseRgbChannel);
  if (channels.some((channel) => Number.isNaN(channel))) {
    return null;
  }

  return {
    hex: `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`,
    opacity: parseAlphaToOpacity(parts[3] ?? '1'),
  };
}

function parseRgbChannel(value: string): number {
  const amount = Number.parseFloat(value);
  if (!Number.isFinite(amount)) {
    return NaN;
  }
  const channel = value.trim().endsWith('%') ? (amount / 100) * 255 : amount;
  return Math.max(0, Math.min(255, Math.round(channel)));
}

function parseAlphaToOpacity(value: string): number {
  const trimmed = value.trim();
  const amount = Number.parseFloat(trimmed);
  if (!Number.isFinite(amount)) {
    return 100;
  }
  return clampOpacity(trimmed.endsWith('%') || amount > 1 ? amount : amount * 100);
}

function composeColorWithOpacity(hex: string, opacity: string | number): string {
  const normalizedHex = normalizeColorInputValue(hex);
  const normalizedOpacity = normalizeOpacityInput(opacity);
  if (normalizedOpacity >= 100) {
    return normalizedHex;
  }

  const { r, g, b } = hexToRgb(normalizedHex);
  return `rgba(${r}, ${g}, ${b}, ${formatAlpha(normalizedOpacity / 100)})`;
}

function normalizeOpacityInput(value: string | number): number {
  const amount = typeof value === 'number' ? value : Number.parseFloat(value.trim().replace(/%$/, ''));
  return clampOpacity(Number.isFinite(amount) ? amount : 100);
}

function clampOpacity(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function formatOpacityInputValue(value: number): string {
  return Number(value.toFixed(2)).toString();
}

function formatAlpha(value: number): string {
  return Number(value.toFixed(4)).toString();
}

function hexToRgb(value: string): { r: number; g: number; b: number } {
  const hex = normalizeColorInputValue(value).slice(1);
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}
