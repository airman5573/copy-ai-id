import {
  useMemo,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react';

import { useDraftValue } from './useDraftValue';

import type { QuickActionCategory } from '../../../shared/domain/visual';
import {
  getVisualStylePropertyDefinition,
  type VisualStylePreset,
} from '../../../shared/visual-style';
import { useVisualSelectionStore } from '../../stores/useVisualSelectionStore';
import {
  formatStepperLengthDisplay,
  formatStepperOpacityDisplay,
} from '../../utils/stepperMath';
import { useStyleEdit } from '../../visual/useStyleEdit';
import { useToolbarStepper } from '../quick-toolbar/useToolbarStepper';
import { ColorInput, type ColorPresetOption } from '../visual/ColorInput';
import { PresetSelect, type VisualPresetOption } from '../visual/PresetSelect';
import { StepperControl } from '../visual/StepperControl';
import { selectTextInputValue } from '../visual/inputSelection';
import { VisualControl, VisualResetButton } from '../visual/VisualControl';

export type StyleControlGroupProps = {
  title: string;
  dataAiId: string;
  children: ReactNode;
  tone?: 'active' | 'muted';
};

// Title-only group chrome — no descriptions, no breakpoint badge (viewport
// scoping still lives in records/export, it is just not displayed here).
export function StyleControlGroup({
  title,
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
      <div className="mb-3" data-ai-id={`${dataAiId}-header`}>
        <h4 className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-300" data-ai-id={`${dataAiId}-title-text`}>
          {title}
        </h4>
      </div>
      <div className="space-y-3" data-ai-id={`${dataAiId}-body`}>
        {children}
      </div>
    </section>
  );
}

export type CssStepperProps = {
  property: string;
  label: string;
  dataAiId: string;
  disabled?: boolean;
  category?: QuickActionCategory;
  computedProperty?: string;
  mode?: 'length' | 'opacity';
};

// Panel-side percent-intent stepper bound to the selected snapshot. Shares
// the toolbar's stepper math/coalescing but records source 'floating-panel'.
export function CssStepper({
  property,
  label,
  dataAiId,
  disabled = false,
  category = 'style',
  computedProperty,
  mode,
}: CssStepperProps): ReactElement {
  const edit = useStyleEdit();
  const snapshot = useVisualSelectionStore((state) => state.snapshot);
  const stepper = useToolbarStepper(edit.target, snapshot, { source: 'floating-panel' });
  const computedValue = edit.computedValueOf(computedProperty ?? property);
  const displayValue = mode === 'opacity'
    ? formatStepperOpacityDisplay(computedValue)
    : formatStepperLengthDisplay(computedValue);

  return (
    <VisualControl
      label={label}
      dataAiId={`${dataAiId}-field`}
      disabled={disabled}
      actions={
        <VisualResetButton
          dataAiId={`${dataAiId}-reset-button`}
          disabled={disabled}
          onClick={() => edit.resetStyle(property, {
            category,
            control: { id: `style:${property}`, label },
          })}
        />
      }
    >
      <StepperControl
        label={label}
        displayValue={displayValue}
        disabled={disabled || !edit.canEdit}
        dataAiId={dataAiId}
        onStep={(direction) => stepper.stepProperty({
          property,
          computedProperty,
          category,
          mode,
        }, direction)}
      />
    </VisualControl>
  );
}

export const CSS_COLOR_PRESETS: ColorPresetOption[] = [
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

export type CssColorInputProps = {
  property: string;
  label: string;
  dataAiId: string;
  disabled?: boolean;
  category?: QuickActionCategory;
};

export function CssColorInput({
  property,
  label,
  dataAiId,
  disabled = false,
  category = 'style',
}: CssColorInputProps): ReactElement {
  const edit = useStyleEdit();
  const committed = edit.valueOf(property);
  const [draft, setDraft] = useDraftValue(committed, property);

  const commit = (value = draft): void => {
    edit.commitStyle(property, value, {
      category,
      control: { id: `style:${property}`, label },
    });
  };

  return (
    <ColorInput
      label={label}
      dataAiId={dataAiId}
      value={draft}
      disabled={disabled}
      presets={CSS_COLOR_PRESETS}
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
          category,
          control: { id: `style:${property}`, label },
        });
      }}
    />
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
  const [draft, setDraft] = useDraftValue(committed, property);

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
  const [draft, setDraft] = useDraftValue(committed, property);

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
