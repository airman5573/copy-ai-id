import { type ReactElement } from 'react';

import { useStyleEdit } from '../../visual/useStyleEdit';
import { CssStepper, StyleControlGroup } from './styleControlHelpers';

export type SpacingControlsProps = {
  disabled?: boolean;
};

const EDGE_LABELS = [
  { suffix: 'top', label: '위' },
  { suffix: 'right', label: '오른쪽' },
  { suffix: 'bottom', label: '아래' },
  { suffix: 'left', label: '왼쪽' },
] as const;

// 간격 tab: per-edge padding/margin steppers and gap per axis. The quick
// toolbar's spacing popovers cover the common all/x/y cases; this tab is the
// full per-edge view.
export function SpacingControls({ disabled = false }: SpacingControlsProps): ReactElement {
  const edit = useStyleEdit();
  const canEdit = edit.canEdit && !disabled;

  return (
    <div className="space-y-4" data-ai-id="copy-ai-id-editor-spacing-controls">
      <StyleControlGroup title="패딩 (안쪽 여백)" dataAiId="copy-ai-id-editor-spacing-padding-group">
        <div className="grid grid-cols-2 gap-3" data-ai-id="copy-ai-id-editor-spacing-padding-grid">
          {EDGE_LABELS.map(({ suffix, label }) => (
            <CssStepper
              key={suffix}
              property={`padding-${suffix}`}
              label={label}
              dataAiId={`copy-ai-id-editor-visual-padding-${suffix}`}
              disabled={!canEdit}
              category="spacing"
            />
          ))}
        </div>
      </StyleControlGroup>

      <StyleControlGroup title="마진 (바깥 여백)" dataAiId="copy-ai-id-editor-spacing-margin-group">
        <div className="grid grid-cols-2 gap-3" data-ai-id="copy-ai-id-editor-spacing-margin-grid">
          {EDGE_LABELS.map(({ suffix, label }) => (
            <CssStepper
              key={suffix}
              property={`margin-${suffix}`}
              label={label}
              dataAiId={`copy-ai-id-editor-visual-margin-${suffix}`}
              disabled={!canEdit}
              category="spacing"
            />
          ))}
        </div>
      </StyleControlGroup>

      <StyleControlGroup title="간격 (자식 사이)" dataAiId="copy-ai-id-editor-spacing-gap-group">
        <div className="grid grid-cols-2 gap-3" data-ai-id="copy-ai-id-editor-spacing-gap-grid">
          <CssStepper
            property="column-gap"
            label="가로 간격"
            dataAiId="copy-ai-id-editor-visual-column-gap"
            disabled={!canEdit}
            category="spacing"
          />
          <CssStepper
            property="row-gap"
            label="세로 간격"
            dataAiId="copy-ai-id-editor-visual-row-gap"
            disabled={!canEdit}
            category="spacing"
          />
        </div>
      </StyleControlGroup>
    </div>
  );
}
