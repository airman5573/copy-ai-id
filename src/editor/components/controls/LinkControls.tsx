import type { ReactElement } from 'react';

import { LINK_VISUAL_ATTRIBUTE_NAMES } from '../../../shared/visual-attributes';
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
      description="href, target, rel을 안전한 allowlist 안에서 수정합니다. javascript: 같은 위험한 URL은 적용하지 않습니다."
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
        <p
          className="rounded-lg border border-gray-800 bg-gray-950/50 px-3 py-2 text-[10px] leading-relaxed text-gray-500"
          data-ai-id="copy-ai-id-editor-content-link-helper-note"
        >
          {_blankRelHint(edit.valueOf('target'), edit.valueOf('rel'))}
        </p>
      </div>
    </AttributeControlSection>
  );
}

function _blankRelHint(target: string, rel: string): string {
  if (target === '_blank' && !hasNoopenerRel(rel)) {
    return 'target="_blank"를 사용할 때는 rel에 noopener noreferrer를 추가하는 것이 안전합니다.';
  }

  return `${LINK_VISUAL_ATTRIBUTE_NAMES.join(', ')} 속성은 visual edit diff에 attribute mutation으로 기록됩니다.`;
}

function hasNoopenerRel(rel: string): boolean {
  const tokens = new Set(rel.split(/\s+/).map((token) => token.trim().toLowerCase()).filter(Boolean));
  return tokens.has('noopener') || tokens.has('noreferrer');
}
