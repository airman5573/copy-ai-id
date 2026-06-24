import {
  useEffect,
  useMemo,
  useState,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react';

import { breakpointById } from '../../../shared/breakpoints';
import type { QuickActionCategory } from '../../../shared/editor-messages';
import {
  getVisualStylePropertyDefinition,
  type VisualStylePreset,
} from '../../../shared/visual-style';
import { useBreakpointStore } from '../../stores/useBreakpointStore';
import { useStyleEdit } from '../../visual/useStyleEdit';
import { PresetSelect, type VisualPresetOption } from '../visual/PresetSelect';
import { selectTextInputValue } from '../visual/inputSelection';
import { VisualControl, VisualResetButton } from '../visual/VisualControl';

export type StyleControlGroupProps = {
  title: string;
  description: string;
  dataAiId: string;
  children: ReactNode;
  tone?: 'active' | 'muted';
};

export function StyleControlGroup({
  title,
  description,
  dataAiId,
  children,
  tone = 'active',
}: StyleControlGroupProps): ReactElement {
  return (
    <section
      className={`rounded-xl border p-3.5 shadow-sm ${
        tone === 'active'
          ? 'border-gray-800 bg-gray-950/45'
          : 'border-dashed border-gray-800/90 bg-gray-950/25'
      }`}
      data-ai-id={dataAiId}
      data-ai-editor-style-control-group-tone={tone}
    >
      <div className="mb-3 flex items-start justify-between gap-3" data-ai-id={`${dataAiId}-header`}>
        <div className="min-w-0">
          <h4 className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-300" data-ai-id={`${dataAiId}-title-text`}>
            {title}
          </h4>
          <p className="mt-1 text-[11px] leading-relaxed text-gray-500" data-ai-id={`${dataAiId}-description-text`}>
            {description}
          </p>
        </div>
        <StyleControlBreakpointBadge dataAiId={`${dataAiId}-breakpoint-badge`} />
      </div>
      <div className="space-y-3" data-ai-id={`${dataAiId}-body`}>
        {children}
      </div>
    </section>
  );
}

function StyleControlBreakpointBadge({ dataAiId }: { dataAiId: string }): ReactElement {
  const activeBreakpointId = useBreakpointStore((state) => state.activeBreakpointId);
  const activeBreakpoint = breakpointById(activeBreakpointId);
  const isBaseBreakpoint = activeBreakpointId === 'base';
  const title = isBaseBreakpoint
    ? 'Style edits are recorded for the base breakpoint and applied inline in the preview.'
    : `Style edits are recorded as ${activeBreakpoint.label} breakpoint intent, while the preview applies inline styles for immediate feedback.`;

  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] shadow-sm ${
        isBaseBreakpoint
          ? 'border-gray-700 bg-gray-950/70 text-gray-400'
          : 'border-blue-500/30 bg-blue-500/10 text-blue-300'
      }`}
      title={title}
      data-ai-id={dataAiId}
      data-ai-editor-breakpoint-id={activeBreakpointId}
      data-ai-editor-breakpoint-inline-preview={isBaseBreakpoint ? 'false' : 'true'}
    >
      {isBaseBreakpoint ? activeBreakpoint.label : `${activeBreakpoint.label} intent`}
    </span>
  );
}

export type CssPresetSelectProps = {
  property: string;
  label: string;
  dataAiId: string;
  disabled?: boolean;
  helperText?: string;
  options?: VisualPresetOption[];
  placeholderLabel?: string;
  category?: QuickActionCategory;
  controlPrefix?: string;
};

export function CssPresetSelect({
  property,
  label,
  dataAiId,
  disabled = false,
  helperText,
  options,
  placeholderLabel = '—',
  category = 'style',
  controlPrefix = category,
}: CssPresetSelectProps): ReactElement {
  const edit = useStyleEdit();
  const resolvedOptions = useMemo(() => options ?? presetOptionsForProperty(property), [options, property]);

  return (
    <PresetSelect
      label={label}
      dataAiId={dataAiId}
      value={edit.valueOf(property)}
      options={resolvedOptions}
      disabled={disabled}
      helperText={helperText}
      placeholderLabel={placeholderLabel}
      showPlaceholderOption={false}
      onChange={(value) => edit.commitStyle(property, value, {
        category,
        control: { id: `${controlPrefix}:${property}`, label },
      })}
      onReset={() => edit.resetStyle(property, {
        category,
        control: { id: `${controlPrefix}:${property}`, label },
      })}
    />
  );
}

export type CssTextInputProps = {
  property: string;
  label: string;
  dataAiId: string;
  disabled?: boolean;
  placeholder?: string;
  helperText?: string;
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode'];
  presets?: readonly VisualPresetOption[];
  normalize?: (value: string) => string;
  category?: QuickActionCategory;
  controlPrefix?: string;
};

export function CssTextInput({
  property,
  label,
  dataAiId,
  disabled = false,
  placeholder,
  helperText,
  inputMode = 'text',
  presets = [],
  normalize = normalizeCssValue,
  category = 'style',
  controlPrefix = category,
}: CssTextInputProps): ReactElement {
  const edit = useStyleEdit();
  const committed = edit.valueOf(property);
  const [draft, setDraft] = useState(committed);

  useEffect(() => {
    setDraft(committed);
  }, [committed, property]);

  const commitValue = (value: string): void => {
    const next = normalize(value);
    setDraft(next);
    edit.commitStyle(property, next, {
      category,
      control: { id: `${controlPrefix}:${property}`, label },
    });
  };

  return (
    <VisualControl
      label={label}
      dataAiId={`${dataAiId}-field`}
      helperText={helperText}
      disabled={disabled}
      actions={
        <VisualResetButton
          dataAiId={`${dataAiId}-reset-button`}
          disabled={disabled}
          onClick={() => {
            setDraft('');
            edit.resetStyle(property, {
              category,
              control: { id: `${controlPrefix}:${property}`, label },
            });
          }}
        />
      }
    >
      <div className="space-y-2" data-ai-id={`${dataAiId}-text-control`}>
        <input
          type="text"
          inputMode={inputMode}
          value={draft}
          disabled={disabled}
          placeholder={placeholder}
          className="w-full rounded-lg border border-gray-700 bg-gray-950/80 px-2.5 py-2 font-mono text-[11px] text-gray-100 outline-none transition placeholder:text-gray-600 focus:border-blue-500/70 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:text-gray-600"
          onFocus={(event) => selectTextInputValue(event.currentTarget)}
          onClick={(event) => selectTextInputValue(event.currentTarget)}
          onChange={(event) => setDraft(event.currentTarget.value)}
          onBlur={() => commitValue(draft)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              event.currentTarget.blur();
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              setDraft(committed);
              event.currentTarget.blur();
            }
          }}
          data-ai-id={dataAiId}
        />
        {presets.length > 0 ? (
          <PresetButtonRow
            dataAiId={`${dataAiId}-preset-row`}
            disabled={disabled}
            presets={presets}
            onSelect={(value) => commitValue(value)}
          />
        ) : null}
      </div>
    </VisualControl>
  );
}

export type CssTextareaProps = {
  property: string;
  label: string;
  dataAiId: string;
  disabled?: boolean;
  placeholder?: string;
  helperText?: string;
  presets?: readonly VisualPresetOption[];
  rows?: number;
  normalize?: (value: string) => string;
  category?: QuickActionCategory;
  controlPrefix?: string;
};

export function CssTextarea({
  property,
  label,
  dataAiId,
  disabled = false,
  placeholder,
  helperText,
  presets = [],
  rows = 3,
  normalize = normalizeCssValue,
  category = 'style',
  controlPrefix = category,
}: CssTextareaProps): ReactElement {
  const edit = useStyleEdit();
  const committed = edit.valueOf(property);
  const [draft, setDraft] = useState(committed);

  useEffect(() => {
    setDraft(committed);
  }, [committed, property]);

  const commitValue = (value: string): void => {
    const next = normalize(value);
    setDraft(next);
    edit.commitStyle(property, next, {
      category,
      control: { id: `${controlPrefix}:${property}`, label },
    });
  };

  return (
    <VisualControl
      label={label}
      dataAiId={`${dataAiId}-field`}
      helperText={helperText}
      disabled={disabled}
      actions={
        <VisualResetButton
          dataAiId={`${dataAiId}-reset-button`}
          disabled={disabled}
          onClick={() => {
            setDraft('');
            edit.resetStyle(property, {
              category,
              control: { id: `${controlPrefix}:${property}`, label },
            });
          }}
        />
      }
    >
      <div className="space-y-2" data-ai-id={`${dataAiId}-textarea-control`}>
        <textarea
          value={draft}
          disabled={disabled}
          rows={rows}
          placeholder={placeholder}
          className="w-full resize-y rounded-lg border border-gray-700 bg-gray-950/80 px-2.5 py-2 font-mono text-[11px] leading-relaxed text-gray-100 outline-none transition placeholder:text-gray-600 focus:border-blue-500/70 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:text-gray-600"
          onFocus={(event) => selectTextInputValue(event.currentTarget)}
          onClick={(event) => selectTextInputValue(event.currentTarget)}
          onChange={(event) => setDraft(event.currentTarget.value)}
          onBlur={() => commitValue(draft)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
              event.preventDefault();
              event.currentTarget.blur();
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              setDraft(committed);
              event.currentTarget.blur();
            }
          }}
          data-ai-id={dataAiId}
        />
        {presets.length > 0 ? (
          <PresetButtonRow
            dataAiId={`${dataAiId}-preset-row`}
            disabled={disabled}
            presets={presets}
            onSelect={(value) => commitValue(value)}
          />
        ) : null}
      </div>
    </VisualControl>
  );
}

export function PresetButtonRow({
  dataAiId,
  presets,
  disabled,
  onSelect,
}: {
  dataAiId: string;
  presets: readonly VisualPresetOption[];
  disabled: boolean;
  onSelect: (value: string) => void;
}): ReactElement {
  return (
    <div className="flex flex-wrap gap-1.5" data-ai-id={dataAiId}>
      {presets.map((preset) => (
        <button
          key={preset.value}
          type="button"
          className="rounded-full border border-gray-700 bg-gray-950/70 px-2 py-1 text-[10px] font-bold text-gray-400 transition hover:border-blue-500/40 hover:bg-blue-500/10 hover:text-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={disabled}
          onClick={() => onSelect(preset.value)}
          data-ai-id={`${dataAiId}-button`}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}

export function presetOptionsForProperty(property: string): VisualPresetOption[] {
  const definition = getVisualStylePropertyDefinition(property);
  return (definition?.presets ?? []).map(visualPresetToOption);
}

function visualPresetToOption(preset: VisualStylePreset): VisualPresetOption {
  return {
    value: preset.value,
    label: preset.label,
  };
}

export function normalizeCssValue(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
