import { useState, type ReactElement } from 'react';

import { ToolbarPopover } from './ToolbarPopover';

export interface ColorSwatchControlProps {
  label: string;
  value: string;
  disabled?: boolean;
  dataAiId: string;
  onCommit: (value: string) => void;
}

const PRESET_PALETTE: readonly string[] = [
  '#ffffff', '#f3f4f6', '#9ca3af', '#4b5563', '#1f2937', '#000000',
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
  '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899',
];

// Toolbar color swatch: preset palette grid + a simplified custom picker
// (native color input + hex field).
export function ColorSwatchControl({
  label,
  value,
  disabled = false,
  dataAiId,
  onCommit,
}: ColorSwatchControlProps): ReactElement {
  return (
    <ToolbarPopover
      label={label}
      dataAiId={dataAiId}
      disabled={disabled}
      panelWidthPx={196}
      buttonContent={(
        <span className="flex items-center gap-1.5">
          <span
            className="h-4 w-4 rounded-sm border border-gray-500"
            style={{ backgroundColor: value || 'transparent' }}
            aria-hidden="true"
            data-ai-id={`${dataAiId}-swatch-preview`}
          />
          <span>{label}</span>
        </span>
      )}
    >
      {(close) => (
        <ColorSwatchPanel
          value={value}
          messagesApply="적용"
          messagesCustom="직접 고르기"
          messagesPresets="색상 고르기"
          dataAiId={dataAiId}
          onCommit={(nextValue) => {
            onCommit(nextValue);
            close();
          }}
        />
      )}
    </ToolbarPopover>
  );
}

function ColorSwatchPanel({
  value,
  messagesApply,
  messagesCustom,
  messagesPresets,
  dataAiId,
  onCommit,
}: {
  value: string;
  messagesApply: string;
  messagesCustom: string;
  messagesPresets: string;
  dataAiId: string;
  onCommit: (value: string) => void;
}): ReactElement {
  const [customValue, setCustomValue] = useState(toHexColor(value) ?? '#3b82f6');
  const [hexDraft, setHexDraft] = useState(toHexColor(value) ?? '#3b82f6');

  const applyCustom = (): void => {
    const parsed = normalizeHexInput(hexDraft) ?? customValue;
    onCommit(parsed);
  };

  return (
    <div className="flex flex-col gap-2.5" data-ai-id={`${dataAiId}-panel-body`}>
      <div
        className="grid grid-cols-6 gap-1"
        role="listbox"
        aria-label={messagesPresets}
        data-ai-id={`${dataAiId}-preset-grid`}
      >
        {PRESET_PALETTE.map((preset) => (
          <button
            key={preset}
            type="button"
            className={`h-6 w-6 rounded-sm border transition hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 ${
              colorsEqual(preset, value) ? 'border-blue-400 ring-1 ring-blue-400/70' : 'border-gray-600'
            }`}
            style={{ backgroundColor: preset }}
            role="option"
            aria-selected={colorsEqual(preset, value)}
            aria-label={preset}
            onClick={() => onCommit(preset)}
            data-ai-id={`${dataAiId}-preset-swatch`}
          />
        ))}
      </div>
      <div className="flex items-center gap-1.5" data-ai-id={`${dataAiId}-custom-row`}>
        <input
          type="color"
          className="h-7 w-8 shrink-0 cursor-pointer rounded border border-gray-600 bg-transparent p-0.5"
          value={customValue}
          aria-label={messagesCustom}
          onChange={(event) => {
            setCustomValue(event.currentTarget.value);
            setHexDraft(event.currentTarget.value);
          }}
          data-ai-id={`${dataAiId}-custom-picker-input`}
        />
        <input
          type="text"
          className="h-7 min-w-0 flex-1 rounded border border-gray-600 bg-gray-900 px-2 font-mono text-[11px] text-gray-100 outline-none placeholder:text-gray-500 focus:border-blue-500/70"
          value={hexDraft}
          placeholder="#000000"
          onChange={(event) => setHexDraft(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              applyCustom();
            }
          }}
          data-ai-id={`${dataAiId}-custom-hex-input`}
        />
        <button
          type="button"
          className="h-7 shrink-0 rounded border border-blue-500/60 bg-blue-600/40 px-2 text-[11px] font-semibold text-white transition hover:bg-blue-600/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70"
          onClick={applyCustom}
          data-ai-id={`${dataAiId}-custom-apply-button`}
        >
          {messagesApply}
        </button>
      </div>
    </div>
  );
}

function normalizeHexInput(value: string): string | null {
  const trimmed = value.trim();
  const match = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(trimmed);
  if (!match) {
    return null;
  }

  const raw = match[1];
  const expanded = raw.length === 3
    ? raw.split('').map((char) => `${char}${char}`).join('')
    : raw;
  return `#${expanded.toLowerCase()}`;
}

function toHexColor(value: string): string | null {
  const direct = normalizeHexInput(value);
  if (direct) {
    return direct;
  }

  const match = /^rgba?\((\d+)[\s,]+(\d+)[\s,]+(\d+)/.exec(value.trim());
  if (!match) {
    return null;
  }

  const channels = [match[1], match[2], match[3]]
    .map((channel) => Math.max(0, Math.min(255, Number.parseInt(channel, 10))));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

function colorsEqual(first: string, second: string): boolean {
  const firstHex = toHexColor(first);
  const secondHex = toHexColor(second);
  return firstHex !== null && firstHex === secondHex;
}
