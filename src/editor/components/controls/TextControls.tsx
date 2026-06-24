import type { ReactElement } from 'react';

import { useStyleEdit } from '../../visual/useStyleEdit';
import { VisualResetButton } from '../visual/VisualControl';
import { StyleControlGroup } from './styleControlHelpers';

export type TextControlsProps = {
  disabled?: boolean;
};

type FormatKind = 'bold' | 'italic' | 'underline' | 'strike';

const FORMAT_ACTIONS: Array<{ kind: FormatKind; label: string; shortcut: string }> = [
  { kind: 'bold', label: 'B', shortcut: '굵게' },
  { kind: 'italic', label: 'I', shortcut: '기울임' },
  { kind: 'underline', label: 'U', shortcut: '밑줄' },
  { kind: 'strike', label: 'S', shortcut: '취소선' },
];

export function TextControls({ disabled = false }: TextControlsProps): ReactElement {
  const edit = useStyleEdit();
  const canEdit = edit.canEdit && !disabled;
  const fontWeight = edit.valueOf('font-weight');
  const fontStyle = edit.valueOf('font-style');
  const textDecorationLine = edit.valueOf('text-decoration-line');

  const isActive = (kind: FormatKind): boolean => {
    switch (kind) {
      case 'bold':
        return isBoldWeight(fontWeight);
      case 'italic':
        return fontStyle === 'italic' || fontStyle === 'oblique';
      case 'underline':
        return decorationParts(textDecorationLine).includes('underline');
      case 'strike':
        return decorationParts(textDecorationLine).includes('line-through');
      default:
        return exhaustiveFormatKind(kind);
    }
  };

  const toggleFormat = (kind: FormatKind): void => {
    switch (kind) {
      case 'bold':
        edit.commitStyle('font-weight', isBoldWeight(fontWeight) ? '400' : '700', {
          category: 'style',
          control: { id: 'text-format:bold', label: 'Bold' },
        });
        return;
      case 'italic':
        edit.commitStyle('font-style', fontStyle === 'italic' ? 'normal' : 'italic', {
          category: 'style',
          control: { id: 'text-format:italic', label: 'Italic' },
        });
        return;
      case 'underline':
        edit.commitStyle('text-decoration-line', toggleDecoration(textDecorationLine, 'underline'), {
          category: 'style',
          control: { id: 'text-format:underline', label: 'Underline' },
        });
        return;
      case 'strike':
        edit.commitStyle('text-decoration-line', toggleDecoration(textDecorationLine, 'line-through'), {
          category: 'style',
          control: { id: 'text-format:strike', label: 'Strikethrough' },
        });
        return;
      default:
        exhaustiveFormatKind(kind);
    }
  };

  const resetFormats = (): void => {
    edit.commitStyles([
      { propertyId: 'font-weight', value: '' },
      { propertyId: 'font-style', value: '' },
      { propertyId: 'text-decoration-line', value: '' },
    ], {
      category: 'style',
      control: { id: 'text-format', label: 'Text format' },
    });
  };

  return (
    <StyleControlGroup
      title="텍스트 형식"
      description="선택 요소 전체에 굵기, 기울임, 밑줄, 취소선 CSS를 적용합니다."
      dataAiId="copy-ai-id-editor-style-text-format-group"
    >
      <div className="flex items-center gap-2" data-ai-id="copy-ai-id-editor-style-text-format-row">
        <div className="grid flex-1 grid-cols-4 gap-1.5 rounded-lg border border-gray-800 bg-gray-950/70 p-1" data-ai-id="copy-ai-id-editor-style-text-format-buttons">
          {FORMAT_ACTIONS.map((action) => {
            const active = isActive(action.kind);
            return (
              <button
                key={action.kind}
                type="button"
                className={`rounded-md px-2 py-2 text-xs font-black transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 ${
                  active
                    ? 'bg-blue-500/25 text-blue-50 ring-1 ring-blue-400/40'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
                } ${action.kind === 'italic' ? 'italic' : ''} ${action.kind === 'underline' ? 'underline' : ''} ${action.kind === 'strike' ? 'line-through' : ''}`}
                disabled={!canEdit}
                aria-pressed={active}
                title={action.shortcut}
                onClick={() => toggleFormat(action.kind)}
                data-ai-id={`copy-ai-id-editor-style-text-format-${action.kind}-button`}
              >
                {action.label}
              </button>
            );
          })}
        </div>
        <VisualResetButton
          dataAiId="copy-ai-id-editor-style-text-format-reset-button"
          disabled={!canEdit}
          onClick={resetFormats}
          label="텍스트 형식 초기화"
        />
      </div>
    </StyleControlGroup>
  );
}

function isBoldWeight(value: string): boolean {
  const numeric = Number.parseInt(value, 10);
  return Number.isFinite(numeric) ? numeric >= 600 : value === 'bold' || value === 'bolder';
}

function decorationParts(value: string): string[] {
  return value.split(/\s+/).map((part) => part.trim()).filter(Boolean).filter((part) => part !== 'none');
}

function toggleDecoration(current: string, token: 'underline' | 'line-through'): string {
  const parts = new Set(decorationParts(current));
  if (parts.has(token)) {
    parts.delete(token);
  } else {
    parts.add(token);
  }
  return parts.size > 0 ? Array.from(parts).join(' ') : 'none';
}

function exhaustiveFormatKind(kind: never): never {
  throw new Error(`Unsupported text format kind: ${kind}`);
}
