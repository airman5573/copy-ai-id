import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactElement,
} from 'react';

import type { VisualFormValueMutation } from '../../../shared/domain/visual';
import {
  useFormValueEdit,
  type FormValueEditApi,
} from '../../visual/useFormValueEdit';
import { VisualControl } from '../visual/VisualControl';

export type FormValueControlsProps = {
  disabled?: boolean;
};

const FORM_VALUE_COMMIT_DELAY_MS = 350;

export function FormValueControls({ disabled = false }: FormValueControlsProps): ReactElement {
  const edit = useFormValueEdit();
  const canEdit = edit.canEdit && !disabled;

  return (
    <section
      className="rounded-xl border border-gray-800 bg-gray-950/45 p-3.5 shadow-sm"
      data-ai-id="copy-ai-id-editor-content-form-value-group"
      data-ai-editor-form-value-target-kind={edit.targetKind}
    >
      <div className="mb-3" data-ai-id="copy-ai-id-editor-content-form-value-header">
        <h4 className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-300" data-ai-id="copy-ai-id-editor-content-form-value-title-text">
          Form value
        </h4>
      </div>

      {edit.targetKind === 'unsupported' || !edit.formValue ? (
        <p
          className="rounded-lg border border-dashed border-gray-800 bg-gray-950/30 px-3 py-2 text-[11px] leading-relaxed text-gray-400"
          data-ai-id="copy-ai-id-editor-content-form-value-unsupported-message"
        >
          —
        </p>
      ) : (
        <div className="space-y-3" data-ai-id="copy-ai-id-editor-content-form-value-fields">
          {edit.supportsValue ? (
            <FormValueTextField edit={edit} canEdit={canEdit} />
          ) : null}
          {edit.supportsChecked ? (
            <FormValueCheckedField edit={edit} canEdit={canEdit} />
          ) : null}
          {edit.supportsSelection ? (
            <FormValueSelectFields edit={edit} canEdit={canEdit} />
          ) : null}
        </div>
      )}
    </section>
  );
}

function FormValueTextField({
  edit,
  canEdit,
}: {
  edit: FormValueEditApi;
  canEdit: boolean;
}): ReactElement {
  const value = edit.formValue?.value ?? '';
  const [draft, setDraft] = useState(value);
  const focusedRef = useRef(false);
  const lastDispatchedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!focusedRef.current) {
      setDraft(value);
      lastDispatchedRef.current = null;
    }
  }, [edit.targetKey, value]);

  const commit = useCallback((nextValue: string) => {
    if (!canEdit || nextValue === value || nextValue === lastDispatchedRef.current) {
      return;
    }

    lastDispatchedRef.current = nextValue;
    edit.commitFormValue({ value: nextValue }, {
      control: { id: 'form-value:value', label: 'Form value' },
    });
  }, [canEdit, edit, value]);

  useEffect(() => {
    if (!canEdit || draft === value || draft === lastDispatchedRef.current) {
      return;
    }

    const timer = window.setTimeout(() => commit(draft), FORM_VALUE_COMMIT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [canEdit, commit, draft, value]);

  return (
    <VisualControl
      label="Value"
      dataAiId="copy-ai-id-editor-content-form-value-value-control"
      helperText="현재 value를 수정합니다. checkbox/radio에서는 value attribute와 checked 상태를 별도로 기록합니다."
      disabled={!canEdit}
    >
      <textarea
        value={draft}
        disabled={!canEdit}
        rows={edit.targetKind === 'textarea' || edit.targetKind === 'contenteditable' ? 4 : 2}
        className="w-full resize-y rounded-lg border border-gray-700 bg-gray-950/80 px-3 py-2 font-mono text-[11px] leading-relaxed text-gray-100 outline-none transition placeholder:text-gray-500 focus:border-blue-500/70 focus:ring-2 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:text-gray-600"
        placeholder="폼 value"
        onFocus={() => {
          focusedRef.current = true;
        }}
        onChange={(event) => setDraft(event.currentTarget.value)}
        onBlur={() => {
          focusedRef.current = false;
          commit(draft);
        }}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            event.preventDefault();
            commit(draft);
            event.currentTarget.blur();
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            setDraft(value);
            event.currentTarget.blur();
          }
        }}
        data-ai-id="copy-ai-id-editor-content-form-value-value-textarea"
      />
    </VisualControl>
  );
}

function FormValueCheckedField({
  edit,
  canEdit,
}: {
  edit: FormValueEditApi;
  canEdit: boolean;
}): ReactElement {
  const checked = Boolean(edit.formValue?.checked);

  return (
    <VisualControl
      label="Checked"
      dataAiId="copy-ai-id-editor-content-form-value-checked-control"
      helperText="checkbox/radio의 checked 상태를 value와 별도로 기록합니다."
      disabled={!canEdit}
    >
      <label
        className="flex items-center justify-between gap-3 rounded-lg border border-gray-700 bg-gray-950/80 px-3 py-2 text-xs text-gray-200"
        data-ai-id="copy-ai-id-editor-content-form-value-checked-row"
      >
        <span data-ai-id="copy-ai-id-editor-content-form-value-checked-label">
          {checked ? '선택됨' : '선택 안 됨'}
        </span>
        <input
          type="checkbox"
          checked={checked}
          disabled={!canEdit}
          className="h-4 w-4 rounded border-gray-600 bg-gray-950 text-blue-500 focus:ring-blue-500/40 disabled:cursor-not-allowed"
          onChange={(event) => edit.commitFormValue({ checked: event.currentTarget.checked }, {
            control: { id: 'form-value:checked', label: 'Checked state' },
          })}
          data-ai-id="copy-ai-id-editor-content-form-value-checked-input"
        />
      </label>
    </VisualControl>
  );
}

function FormValueSelectFields({
  edit,
  canEdit,
}: {
  edit: FormValueEditApi;
  canEdit: boolean;
}): ReactElement {
  const selectedIndex = edit.formValue?.selectedIndex ?? -1;
  const selectedValues = edit.formValue?.selectedValues ?? [];
  const [selectedIndexDraft, setSelectedIndexDraft] = useState(String(selectedIndex));
  const [selectedValuesDraft, setSelectedValuesDraft] = useState(selectedValues.join('\n'));

  useEffect(() => {
    setSelectedIndexDraft(String(selectedIndex));
    setSelectedValuesDraft(selectedValues.join('\n'));
  }, [edit.targetKey, selectedIndex, selectedValues.join('\n')]);

  const commitSelectedIndex = (): void => {
    const nextIndex = Number.parseInt(selectedIndexDraft, 10);
    edit.commitFormValue({ selectedIndex: Number.isFinite(nextIndex) ? nextIndex : -1 }, {
      control: { id: 'form-value:selected-index', label: 'Selected index' },
    });
  };

  const commitSelectedValues = (): void => {
    const values = selectedValuesDraft
      .split(/\n+/)
      .map((value) => value.trim())
      .filter(Boolean);
    const mutation: VisualFormValueMutation = {
      selectedValues: values,
    };

    if (values.length === 1) {
      mutation.value = values[0];
    }

    edit.commitFormValue(mutation, {
      control: { id: 'form-value:selected-values', label: 'Selected values' },
    });
  };

  return (
    <div className="space-y-3" data-ai-id="copy-ai-id-editor-content-form-value-select-fields">
      <VisualControl
        label="Selected index"
        dataAiId="copy-ai-id-editor-content-form-value-selected-index-control"
        helperText="select의 selectedIndex입니다. -1은 선택 없음입니다."
        disabled={!canEdit}
      >
        <input
          type="number"
          value={selectedIndexDraft}
          disabled={!canEdit}
          className="w-full rounded-lg border border-gray-700 bg-gray-950/80 px-2.5 py-2 font-mono text-[11px] text-gray-100 outline-none transition placeholder:text-gray-500 focus:border-blue-500/70 focus:ring-2 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:text-gray-600"
          onChange={(event) => setSelectedIndexDraft(event.currentTarget.value)}
          onBlur={commitSelectedIndex}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commitSelectedIndex();
              event.currentTarget.blur();
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              setSelectedIndexDraft(String(selectedIndex));
              event.currentTarget.blur();
            }
          }}
          data-ai-id="copy-ai-id-editor-content-form-value-selected-index-input"
        />
      </VisualControl>
      <VisualControl
        label="Selected values"
        dataAiId="copy-ai-id-editor-content-form-value-selected-values-control"
        helperText="multiple select는 줄마다 하나의 option value를 입력합니다. 단일 select는 첫 값이 value로도 적용됩니다."
        disabled={!canEdit}
      >
        <textarea
          value={selectedValuesDraft}
          disabled={!canEdit}
          rows={3}
          className="w-full resize-y rounded-lg border border-gray-700 bg-gray-950/80 px-3 py-2 font-mono text-[11px] leading-relaxed text-gray-100 outline-none transition placeholder:text-gray-500 focus:border-blue-500/70 focus:ring-2 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:text-gray-600"
          placeholder="option value를 줄마다 입력"
          onChange={(event) => setSelectedValuesDraft(event.currentTarget.value)}
          onBlur={commitSelectedValues}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
              event.preventDefault();
              commitSelectedValues();
              event.currentTarget.blur();
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              setSelectedValuesDraft(selectedValues.join('\n'));
              event.currentTarget.blur();
            }
          }}
          data-ai-id="copy-ai-id-editor-content-form-value-selected-values-textarea"
        />
      </VisualControl>
    </div>
  );
}
