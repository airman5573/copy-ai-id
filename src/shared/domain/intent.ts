// Element intent model: which kinds of quick-toolbar controls fit the
// selected element. An element may hold several intents at once; toolbar
// composition merges them in INTENT_PRIORITY order and deduplicates
// overlapping controls.
//
// Classification rules (implemented bridge-side in
// content/editor-bridge/element-intent.ts):
// - image: img/svg/picture, or a computed background-image other than none.
// - text: heading/paragraph/inline-text tags, or an element owning a direct
//   non-empty text node.
// - container: computed display flex/grid, or a block-level element with
//   element children.
// - link-button: a[href], button, [role=button],
//   input[type=button|submit|reset].
// - form: input, textarea, select, or a contenteditable element.

export type ElementIntent = 'image' | 'text' | 'container' | 'link-button' | 'form';

export const INTENT_PRIORITY = [
  'image',
  'form',
  'link-button',
  'text',
  'container',
] as const satisfies readonly ElementIntent[];

export function sortElementIntents(intents: readonly ElementIntent[]): ElementIntent[] {
  return [...new Set(intents)].sort(
    (a, b) => INTENT_PRIORITY.indexOf(a) - INTENT_PRIORITY.indexOf(b),
  );
}
