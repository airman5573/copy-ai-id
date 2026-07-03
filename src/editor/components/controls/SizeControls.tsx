import { type ReactElement } from 'react';

import { useStyleEdit } from '../../visual/useStyleEdit';
import {
  CssPresetSelect,
  CssStepper,
  StyleControlGroup,
} from './styleControlHelpers';

export type SizeControlsProps = {
  disabled?: boolean;
};

const CONSTRAINT_PROPERTIES = [
  { property: 'min-width', label: 'Min width', dataAiId: 'copy-ai-id-editor-visual-min-width' },
  { property: 'max-width', label: 'Max width', dataAiId: 'copy-ai-id-editor-visual-max-width' },
  { property: 'min-height', label: 'Min height', dataAiId: 'copy-ai-id-editor-visual-min-height' },
  { property: 'max-height', label: 'Max height', dataAiId: 'copy-ai-id-editor-visual-max-height' },
] as const;

// Size constraints only — width/height live on the quick toolbar, media
// (object-fit/aspect-ratio) lives in the image section.
export function SizeControls({ disabled = false }: SizeControlsProps): ReactElement {
  const edit = useStyleEdit();
  const canEdit = edit.canEdit && !disabled;

  return (
    <div className="space-y-4" data-ai-id="copy-ai-id-editor-size-controls">
      <StyleControlGroup title="Box sizing" dataAiId="copy-ai-id-editor-size-box-group">
        <CssPresetSelect
          property="box-sizing"
          label="Box sizing"
          dataAiId="copy-ai-id-editor-visual-box-sizing"
          disabled={!canEdit}
          category="size"
        />
      </StyleControlGroup>

      <StyleControlGroup title="Min / Max" dataAiId="copy-ai-id-editor-size-constraints-group">
        <div className="grid grid-cols-2 gap-3" data-ai-id="copy-ai-id-editor-size-constraints-grid">
          {CONSTRAINT_PROPERTIES.map(({ property, label, dataAiId }) => (
            <CssStepper
              key={property}
              property={property}
              label={label}
              dataAiId={dataAiId}
              disabled={!canEdit}
              category="size"
            />
          ))}
        </div>
      </StyleControlGroup>
    </div>
  );
}
