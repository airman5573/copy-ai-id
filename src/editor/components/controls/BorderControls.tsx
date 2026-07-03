import { type ReactElement } from 'react';

import { useStyleEdit } from '../../visual/useStyleEdit';
import {
  CssColorInput,
  CssPresetSelect,
  CssStepper,
  StyleControlGroup,
} from './styleControlHelpers';

export type BorderControlsProps = {
  disabled?: boolean;
};

const BORDER_WIDTH_EDGES = [
  { property: 'border-top-width', label: '위', dataAiId: 'copy-ai-id-editor-visual-border-top-width' },
  { property: 'border-right-width', label: '오른쪽', dataAiId: 'copy-ai-id-editor-visual-border-right-width' },
  { property: 'border-bottom-width', label: '아래', dataAiId: 'copy-ai-id-editor-visual-border-bottom-width' },
  { property: 'border-left-width', label: '왼쪽', dataAiId: 'copy-ai-id-editor-visual-border-left-width' },
] as const;

const RADIUS_CORNERS = [
  { property: 'border-top-left-radius', label: '왼쪽 위', dataAiId: 'copy-ai-id-editor-visual-radius-top-left' },
  { property: 'border-top-right-radius', label: '오른쪽 위', dataAiId: 'copy-ai-id-editor-visual-radius-top-right' },
  { property: 'border-bottom-right-radius', label: '오른쪽 아래', dataAiId: 'copy-ai-id-editor-visual-radius-bottom-right' },
  { property: 'border-bottom-left-radius', label: '왼쪽 아래', dataAiId: 'copy-ai-id-editor-visual-radius-bottom-left' },
] as const;

// Border details: per-edge width steppers, style/color, per-corner radius
// steppers (the uniform radius stepper lives on the quick toolbar), outline.
export function BorderControls({ disabled = false }: BorderControlsProps): ReactElement {
  const edit = useStyleEdit();
  const canEdit = edit.canEdit && !disabled;

  return (
    <div className="space-y-4" data-ai-id="copy-ai-id-editor-border-controls">
      <StyleControlGroup title="선 굵기" dataAiId="copy-ai-id-editor-border-width-group">
        <div className="grid grid-cols-2 gap-3" data-ai-id="copy-ai-id-editor-border-width-grid">
          {BORDER_WIDTH_EDGES.map(({ property, label, dataAiId }) => (
            <CssStepper
              key={property}
              property={property}
              label={label}
              dataAiId={dataAiId}
              disabled={!canEdit}
              category="border"
            />
          ))}
        </div>
      </StyleControlGroup>

      <StyleControlGroup title="선 모양 / 색" dataAiId="copy-ai-id-editor-border-style-color-group">
        <CssPresetSelect
          property="border-style"
          label="선 모양"
          dataAiId="copy-ai-id-editor-visual-border-style"
          disabled={!canEdit}
          category="border"
        />
        <CssColorInput
          property="border-color"
          label="선 색"
          dataAiId="copy-ai-id-editor-visual-border-color"
          disabled={!canEdit}
          category="border"
        />
      </StyleControlGroup>

      <StyleControlGroup title="모서리 둥글기" dataAiId="copy-ai-id-editor-border-radius-group">
        <div className="grid grid-cols-2 gap-3" data-ai-id="copy-ai-id-editor-border-radius-grid">
          {RADIUS_CORNERS.map(({ property, label, dataAiId }) => (
            <CssStepper
              key={property}
              property={property}
              label={label}
              dataAiId={dataAiId}
              disabled={!canEdit}
              category="border"
            />
          ))}
        </div>
      </StyleControlGroup>

      <StyleControlGroup title="테두리(바깥)" dataAiId="copy-ai-id-editor-border-outline-group">
        <div className="grid grid-cols-2 gap-3" data-ai-id="copy-ai-id-editor-border-outline-grid">
          <CssStepper
            property="outline-width"
            label="바깥 선 굵기"
            dataAiId="copy-ai-id-editor-visual-outline-width"
            disabled={!canEdit}
            category="border"
          />
          <CssStepper
            property="outline-offset"
            label="바깥 선 간격"
            dataAiId="copy-ai-id-editor-visual-outline-offset"
            disabled={!canEdit}
            category="border"
          />
        </div>
        <CssPresetSelect
          property="outline-style"
          label="바깥 선 모양"
          dataAiId="copy-ai-id-editor-visual-outline-style"
          disabled={!canEdit}
          category="border"
        />
        <CssColorInput
          property="outline-color"
          label="바깥 선 색"
          dataAiId="copy-ai-id-editor-visual-outline-color"
          disabled={!canEdit}
          category="border"
        />
      </StyleControlGroup>
    </div>
  );
}
