import type { QuickActionCategory } from '../../../shared/editor-messages';

export type VisualPanelSectionId =
  | 'copy-ai-id-editor-content-text-section'
  | 'copy-ai-id-editor-visual-layout-section'
  | 'copy-ai-id-editor-visual-spacing-section'
  | 'copy-ai-id-editor-visual-size-section'
  | 'copy-ai-id-editor-visual-style-section'
  | 'copy-ai-id-editor-visual-border-section';

export const QUICK_ACTION_SECTION_IDS: Record<QuickActionCategory, VisualPanelSectionId> = {
  content: 'copy-ai-id-editor-content-text-section',
  layout: 'copy-ai-id-editor-visual-layout-section',
  spacing: 'copy-ai-id-editor-visual-spacing-section',
  size: 'copy-ai-id-editor-visual-size-section',
  style: 'copy-ai-id-editor-visual-style-section',
  border: 'copy-ai-id-editor-visual-border-section',
};

export function sectionIdForQuickActionCategory(category: QuickActionCategory): VisualPanelSectionId {
  return QUICK_ACTION_SECTION_IDS[category];
}
