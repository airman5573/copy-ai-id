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
  { property: 'border-top-width', label: 'Top', dataAiId: 'copy-ai-id-editor-visual-border-top-width' },
  { property: 'border-right-width', label: 'Right', dataAiId: 'copy-ai-id-editor-visual-border-right-width' },
  { property: 'border-bottom-width', label: 'Bottom', dataAiId: 'copy-ai-id-editor-visual-border-bottom-width' },
  { property: 'border-left-width', label: 'Left', dataAiId: 'copy-ai-id-editor-visual-border-left-width' },
] as const;

const RADIUS_CORNERS = [
  { property: 'border-top-left-radius', label: 'Top left', dataAiId: 'copy-ai-id-editor-visual-radius-top-left' },
  { property: 'border-top-right-radius', label: 'Top right', dataAiId: 'copy-ai-id-editor-visual-radius-top-right' },
  { property: 'border-bottom-right-radius', label: 'Bottom right', dataAiId: 'copy-ai-id-editor-visual-radius-bottom-right' },
  { property: 'border-bottom-left-radius', label: 'Bottom left', dataAiId: 'copy-ai-id-editor-visual-radius-bottom-left' },
] as const;

// Border details: per-edge width steppers, style/color, per-corner radius
// steppers (the uniform radius stepper lives on the quick toolbar), outline.
export function BorderControls({ disabled = false }: BorderControlsProps): ReactElement {
  const edit = useStyleEdit();
  const canEdit = edit.canEdit && !disabled;

  return (
    <div className="space-y-4" data-ai-id="copy-ai-id-editor-border-controls">
      <StyleControlGroup title="Border width" dataAiId="copy-ai-id-editor-border-width-group">
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

      <StyleControlGroup title="Border style / color" dataAiId="copy-ai-id-editor-border-style-color-group">
        <CssPresetSelect
          property="border-style"
          label="Border style"
          dataAiId="copy-ai-id-editor-visual-border-style"
          disabled={!canEdit}
          category="border"
        />
        <CssColorInput
          property="border-color"
          label="Border color"
          dataAiId="copy-ai-id-editor-visual-border-color"
          disabled={!canEdit}
          category="border"
        />
      </StyleControlGroup>

      <StyleControlGroup title="Radius corners" dataAiId="copy-ai-id-editor-border-radius-group">
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

      <StyleControlGroup title="Outline" dataAiId="copy-ai-id-editor-border-outline-group">
        <div className="grid grid-cols-2 gap-3" data-ai-id="copy-ai-id-editor-border-outline-grid">
          <CssStepper
            property="outline-width"
            label="Outline width"
            dataAiId="copy-ai-id-editor-visual-outline-width"
            disabled={!canEdit}
            category="border"
          />
          <CssStepper
            property="outline-offset"
            label="Outline offset"
            dataAiId="copy-ai-id-editor-visual-outline-offset"
            disabled={!canEdit}
            category="border"
          />
        </div>
        <CssPresetSelect
          property="outline-style"
          label="Outline style"
          dataAiId="copy-ai-id-editor-visual-outline-style"
          disabled={!canEdit}
          category="border"
        />
        <CssColorInput
          property="outline-color"
          label="Outline color"
          dataAiId="copy-ai-id-editor-visual-outline-color"
          disabled={!canEdit}
          category="border"
        />
      </StyleControlGroup>
    </div>
  );
}
