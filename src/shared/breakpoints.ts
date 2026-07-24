export type BreakpointId =
  | 'base'
  | 'tablet'
  | 'desktop';

export interface Breakpoint {
  id: BreakpointId;
  /**
   * Stable technical label used in copied/exported text (visual-edit
   * summaries, breakpoint intent notes). Localized UI labels live in the
   * i18n `breakpoints` map — the two are intentionally separate sources.
   */
  label: string;
  width: number;
  height: number;
  prefix: string;
}

export const BREAKPOINTS: readonly Breakpoint[] = [
  { id: 'base', label: 'Base', width: 390, height: 844, prefix: '' },
  { id: 'tablet', label: 'Tablet', width: 768, height: 1024, prefix: 'md:' },
  { id: 'desktop', label: 'Desktop', width: 1920, height: 1080, prefix: 'lg:' },
] as const;

export const BREAKPOINT_ORDER: readonly BreakpointId[] = [
  'base',
  'tablet',
  'desktop',
];

export function breakpointById(id: BreakpointId): Breakpoint {
  return BREAKPOINTS.find((breakpoint) => breakpoint.id === id) ?? BREAKPOINTS[0];
}
