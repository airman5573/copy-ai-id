import { type ReactElement } from 'react';

import { useDraftValue } from './useDraftValue';

import { useStyleEdit } from '../../visual/useStyleEdit';
import { selectTextInputValue } from '../visual/inputSelection';
import { VisualControl, VisualResetButton } from '../visual/VisualControl';
import { StyleControlGroup } from './styleControlHelpers';

export type OpacityControlsProps = {
  disabled?: boolean;
};

export function OpacityControls({ disabled = false }: OpacityControlsProps): ReactElement {
  const edit = useStyleEdit();
  const canEdit = edit.canEdit && !disabled;
  const committed = edit.valueOf('opacity');
  const [draft, setDraft] = useDraftValue(opacityCssToPercent(committed));

  const commitPercent = (percent: string): void => {
    const normalizedPercent = clampPercent(percent);
    setDraft(normalizedPercent);
    edit.commitStyle('opacity', percentToOpacityCss(normalizedPercent), {
      category: 'style',
      control: { id: 'style:opacity', label: 'Opacity' },
    });
  };

  return (
    <StyleControlGroup
      title="Opacity"
      description="요소 전체의 투명도를 opacity CSS 값으로 조정합니다."
      dataAiId="copy-ai-id-editor-style-opacity-group"
    >
      <VisualControl
        label="Opacity"
        dataAiId="copy-ai-id-editor-visual-opacity-field"
        disabled={!canEdit}
        helperText="0은 완전 투명, 100은 불투명입니다."
        actions={
          <VisualResetButton
            dataAiId="copy-ai-id-editor-visual-opacity-reset-button"
            disabled={!canEdit}
            onClick={() => edit.resetStyle('opacity', {
              category: 'style',
              control: { id: 'style:opacity', label: 'Opacity' },
            })}
          />
        }
      >
        <div className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-950/80 px-2.5 py-2" data-ai-id="copy-ai-id-editor-visual-opacity-control-row">
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={draft}
            disabled={!canEdit}
            className="min-w-0 flex-1 accent-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            onChange={(event) => {
              const next = event.currentTarget.value;
              setDraft(next);
              commitPercent(next);
            }}
            data-ai-id="copy-ai-id-editor-visual-opacity-slider"
          />
          <input
            type="text"
            inputMode="decimal"
            value={draft}
            disabled={!canEdit}
            className="w-14 rounded-md border border-gray-700 bg-gray-900 px-2 py-1.5 text-right font-mono text-[11px] text-gray-100 outline-none focus:border-blue-500/70 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:text-gray-600"
            onFocus={(event) => selectTextInputValue(event.currentTarget)}
            onClick={(event) => selectTextInputValue(event.currentTarget)}
            onChange={(event) => setDraft(event.currentTarget.value)}
            onBlur={() => commitPercent(draft)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                event.currentTarget.blur();
              }
            }}
            data-ai-id="copy-ai-id-editor-visual-opacity-input"
          />
          <span className="text-[10px] font-bold text-gray-500" data-ai-id="copy-ai-id-editor-visual-opacity-unit-text">%</span>
        </div>
      </VisualControl>
    </StyleControlGroup>
  );
}

function opacityCssToPercent(value: string): string {
  const amount = Number.parseFloat(value.trim());
  if (!Number.isFinite(amount)) {
    return '100';
  }
  return clampPercent(String(amount > 1 ? amount : amount * 100));
}

function percentToOpacityCss(percent: string): string {
  return Number((Number.parseFloat(clampPercent(percent)) / 100).toFixed(4)).toString();
}

function clampPercent(value: string): string {
  const amount = Number.parseFloat(value.trim().replace(/%$/, ''));
  if (!Number.isFinite(amount)) {
    return '100';
  }
  return Math.max(0, Math.min(100, Math.round(amount))).toString();
}
