import {
  type ElementIntent,
  sortElementIntents,
} from '../../../shared/domain/intent';

// Declarative quick-toolbar composition. Row 1 is intent-driven; row 2 is the
// common spacing/structure/drag/more strip shared by every intent.

export type QuickToolbarControlId =
  | 'image-replace'
  | 'width'
  | 'height'
  | 'object-fit'
  | 'radius'
  | 'font-size'
  | 'font-weight'
  | 'text-color'
  | 'text-align'
  | 'gap'
  | 'flex-direction'
  | 'justify-content'
  | 'align-items'
  | 'background-color'
  | 'href-edit'
  | 'placeholder-edit';

export const INTENT_TOOLBAR_CONTROLS: Record<ElementIntent, readonly QuickToolbarControlId[]> = {
  image: ['image-replace', 'width', 'height', 'object-fit', 'radius'],
  form: ['placeholder-edit', 'width', 'font-size', 'radius'],
  'link-button': ['background-color', 'text-color', 'radius', 'font-size', 'href-edit'],
  text: ['font-size', 'font-weight', 'text-color', 'text-align'],
  container: ['gap', 'flex-direction', 'justify-content', 'align-items', 'background-color', 'radius'],
};

// Merges multiple intents in priority order and deduplicates overlapping
// controls. Elements with no classified intent fall back to container tools.
export function resolveQuickToolbarControls(intents: readonly ElementIntent[]): QuickToolbarControlId[] {
  const sorted = intents.length > 0 ? sortElementIntents(intents) : (['container'] as const);
  const seen = new Set<QuickToolbarControlId>();
  const controls: QuickToolbarControlId[] = [];

  for (const intent of sorted) {
    for (const control of INTENT_TOOLBAR_CONTROLS[intent]) {
      if (seen.has(control)) {
        continue;
      }

      seen.add(control);
      controls.push(control);
    }
  }

  return controls;
}

export type QuickToolbarSpacingGroup = 'padding' | 'margin' | 'gap';

export const QUICK_TOOLBAR_SPACING_GROUPS: readonly QuickToolbarSpacingGroup[] = ['padding', 'margin', 'gap'];

export type QuickToolbarSpacingScope = 'all' | 'x' | 'y' | 'each';

export const QUICK_TOOLBAR_SPACING_SCOPES: readonly QuickToolbarSpacingScope[] = ['all', 'x', 'y', 'each'];

export type QuickToolbarSpacingEdge = 'top' | 'right' | 'bottom' | 'left';

// Properties stepped together for a spacing group + scope selection. Gap has
// no per-edge variant, so 'each' mirrors the x/y pair.
export function spacingPropertiesForScope(
  group: QuickToolbarSpacingGroup,
  scope: QuickToolbarSpacingScope,
): string[] {
  if (group === 'gap') {
    switch (scope) {
      case 'x':
        return ['column-gap'];
      case 'y':
        return ['row-gap'];
      default:
        return ['column-gap', 'row-gap'];
    }
  }

  switch (scope) {
    case 'x':
      return [`${group}-left`, `${group}-right`];
    case 'y':
      return [`${group}-top`, `${group}-bottom`];
    case 'each':
    case 'all':
    default:
      return [`${group}-top`, `${group}-right`, `${group}-bottom`, `${group}-left`];
  }
}

export const QUICK_TOOLBAR_STRUCTURE_OPERATIONS = ['duplicate', 'move-up', 'move-down', 'delete'] as const;
