import type { ReactElement } from 'react';

import { useAttributeEdit } from '../../visual/useAttributeEdit';
import {
  AttributeControlSection,
  VisualAttributeSelectField,
  VisualAttributeTextField,
  visualAttributeDefinitionOrThrow,
} from './AttributeControls';

export type LinkControlsProps = {
  disabled?: boolean;
};

export function LinkControls({ disabled = false }: LinkControlsProps): ReactElement {
  const edit = useAttributeEdit();
  const canEdit = edit.canEdit && !disabled;
  const hrefDefinition = visualAttributeDefinitionOrThrow('href');
  const targetDefinition = visualAttributeDefinitionOrThrow('target');
  const relDefinition = visualAttributeDefinitionOrThrow('rel');

  return (
    <AttributeControlSection
      title="링크"
      dataAiId="copy-ai-id-editor-content-link-group"
    >
      <div className="space-y-3" data-ai-id="copy-ai-id-editor-content-link-fields">
        <VisualAttributeTextField
          edit={edit}
          definition={hrefDefinition}
          canEdit={canEdit}
          dataAiId="copy-ai-id-editor-content-link-href-input"
        />
        <VisualAttributeSelectField
          edit={edit}
          definition={targetDefinition}
          canEdit={canEdit}
          dataAiId="copy-ai-id-editor-content-link-target-select"
        />
        <VisualAttributeTextField
          edit={edit}
          definition={relDefinition}
          canEdit={canEdit}
          dataAiId="copy-ai-id-editor-content-link-rel-input"
        />
      </div>
    </AttributeControlSection>
  );
}
