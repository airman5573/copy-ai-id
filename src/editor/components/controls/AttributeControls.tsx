import {
  useEffect,
  useMemo,
  useState,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react';

import {
  CURATED_VISUAL_ATTRIBUTE_NAMES,
  VISUAL_ATTRIBUTE_DEFINITIONS,
  visualAttributeDefinitionByName,
  type VisualAttributeDefinition,
  type VisualAttributeName,
} from '../../../shared/visual-attributes';
import {
  useAttributeEdit,
  type AttributeEditApi,
} from '../../visual/useAttributeEdit';
import { VisualControl, VisualResetButton } from '../visual/VisualControl';

export type AttributeControlsProps = {
  disabled?: boolean;
};

export function AttributeControls({ disabled = false }: AttributeControlsProps): ReactElement {
  const edit = useAttributeEdit();
  const canEdit = edit.canEdit && !disabled;
  const definitions = useMemo(() => (
    CURATED_VISUAL_ATTRIBUTE_NAMES
      .map((name) => visualAttributeDefinitionByName(name))
      .filter((definition): definition is VisualAttributeDefinition => Boolean(definition))
  ), []);

  return (
    <AttributeControlSection
      title="Attributes"
      dataAiId="copy-ai-id-editor-content-attribute-group"
    >
      <div className="space-y-3" data-ai-id="copy-ai-id-editor-content-attribute-fields">
        {definitions.map((definition) => (
          definition.options ? (
            <VisualAttributeSelectField
              key={definition.name}
              edit={edit}
              definition={definition}
              canEdit={canEdit}
              dataAiId={`copy-ai-id-editor-content-attribute-${definition.name}-select`}
            />
          ) : (
            <VisualAttributeTextField
              key={definition.name}
              edit={edit}
              definition={definition}
              canEdit={canEdit}
              dataAiId={`copy-ai-id-editor-content-attribute-${definition.name}-input`}
            />
          )
        ))}
      </div>
    </AttributeControlSection>
  );
}

export function AttributeControlSection({
  title,
  dataAiId,
  children,
}: {
  title: string;
  dataAiId: string;
  children: ReactNode;
}): ReactElement {
  return (
    <section
      className="rounded-xl border border-gray-800 bg-gray-950/45 p-3.5 shadow-sm"
      data-ai-id={dataAiId}
    >
      <div className="mb-3" data-ai-id={`${dataAiId}-header`}>
        <h4 className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-300" data-ai-id={`${dataAiId}-title-text`}>
          {title}
        </h4>
      </div>
      <div className="space-y-3" data-ai-id={`${dataAiId}-body`}>
        {children}
      </div>
    </section>
  );
}

export function VisualAttributeTextField({
  edit,
  definition,
  canEdit,
  dataAiId,
}: {
  edit: AttributeEditApi;
  definition: VisualAttributeDefinition;
  canEdit: boolean;
  dataAiId: string;
}): ReactElement {
  const currentValue = edit.valueOf(definition.name);
  const [draft, setDraft] = useState(currentValue);
  const [errorText, setErrorText] = useState('');

  useEffect(() => {
    setDraft(currentValue);
    setErrorText('');
  }, [currentValue, definition.name, edit.targetKey]);

  const commit = (value: string | null): void => {
    if (!canEdit) {
      return;
    }

    const sanitized = edit.sanitizeAttribute(definition.name, value);
    if (!sanitized.ok) {
      setErrorText(sanitized.error.detail ?? sanitized.error.message);
      return;
    }

    const nextValue = sanitized.attribute.value;
    setDraft(nextValue ?? '');
    const result = edit.commitAttribute(definition.name, nextValue, {
      control: {
        id: `attribute:${definition.name}`,
        label: definition.label,
      },
    });

    if (!result.ok) {
      setErrorText(result.error.detail ?? result.error.message);
      return;
    }

    setErrorText('');
  };

  return (
    <VisualControl
      label={definition.label}
      dataAiId={`${dataAiId}-control`}
      helperText={definition.helperText}
      errorText={errorText || undefined}
      disabled={!canEdit}
      actions={
        <VisualResetButton
          dataAiId={`${dataAiId}-reset-button`}
          disabled={!canEdit || currentValue === ''}
          label={`${definition.label} 제거`}
          onClick={() => commit(null)}
        />
      }
    >
      <input
        type="text"
        inputMode={definition.inputMode as HTMLAttributes<HTMLInputElement>['inputMode'] ?? 'text'}
        value={draft}
        disabled={!canEdit}
        placeholder={definition.placeholder}
        className="w-full rounded-lg border border-gray-700 bg-gray-950/80 px-2.5 py-2 font-mono text-[11px] text-gray-100 outline-none transition placeholder:text-gray-500 focus:border-blue-500/70 focus:ring-2 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:text-gray-600"
        onChange={(event) => setDraft(event.currentTarget.value)}
        onBlur={() => commit(draft)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit(draft);
            event.currentTarget.blur();
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            setDraft(currentValue);
            setErrorText('');
            event.currentTarget.blur();
          }
        }}
        data-ai-id={dataAiId}
      />
    </VisualControl>
  );
}

export function VisualAttributeSelectField({
  edit,
  definition,
  canEdit,
  dataAiId,
}: {
  edit: AttributeEditApi;
  definition: VisualAttributeDefinition;
  canEdit: boolean;
  dataAiId: string;
}): ReactElement {
  const currentValue = edit.valueOf(definition.name);
  const [errorText, setErrorText] = useState('');

  useEffect(() => {
    setErrorText('');
  }, [currentValue, definition.name, edit.targetKey]);

  const commit = (value: string | null): void => {
    if (!canEdit) {
      return;
    }

    const result = edit.commitAttribute(definition.name, value, {
      control: {
        id: `attribute:${definition.name}`,
        label: definition.label,
      },
    });

    if (!result.ok) {
      setErrorText(result.error.detail ?? result.error.message);
      return;
    }

    setErrorText('');
  };

  return (
    <VisualControl
      label={definition.label}
      dataAiId={`${dataAiId}-control`}
      helperText={definition.helperText}
      errorText={errorText || undefined}
      disabled={!canEdit}
    >
      <select
        value={currentValue}
        disabled={!canEdit}
        className="w-full rounded-lg border border-gray-700 bg-gray-950/80 px-2.5 py-2 font-mono text-[11px] text-gray-100 outline-none transition focus:border-blue-500/70 focus:ring-2 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:text-gray-600"
        onChange={(event) => commit(event.currentTarget.value || null)}
        data-ai-id={dataAiId}
      >
        {(definition.options ?? []).map((option) => (
          <option key={option.value || '__remove'} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </VisualControl>
  );
}

export function visualAttributeDefinitionOrThrow(name: VisualAttributeName): VisualAttributeDefinition {
  const definition = VISUAL_ATTRIBUTE_DEFINITIONS.find((candidate) => candidate.name === name);
  if (!definition) {
    throw new Error(`Missing visual attribute definition for ${name}`);
  }

  return definition;
}
