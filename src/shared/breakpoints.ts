export type BreakpointId =
  | 'base'
  | 'mobile'
  | 'tablet'
  | 'desktop'
  | 'desktop1280'
  | 'desktop1440'
  | 'desktop1536'
  | 'desktop1920';

export interface Breakpoint {
  id: BreakpointId;
  label: string;
  width: number;
  prefix: string;
}

export const BREAKPOINTS: readonly Breakpoint[] = [
  { id: 'base', label: 'Base', width: 390, prefix: '' },
  { id: 'mobile', label: 'Mobile', width: 640, prefix: 'sm:' },
  { id: 'tablet', label: 'Tablet', width: 768, prefix: 'md:' },
  { id: 'desktop', label: 'Desktop', width: 1024, prefix: 'lg:' },
  { id: 'desktop1280', label: '1280', width: 1280, prefix: 'xl:' },
  { id: 'desktop1440', label: '1440', width: 1440, prefix: '' },
  { id: 'desktop1536', label: '1536', width: 1536, prefix: '2xl:' },
  { id: 'desktop1920', label: '1920', width: 1920, prefix: '' },
] as const;

export const BREAKPOINT_ORDER: readonly BreakpointId[] = [
  'base',
  'mobile',
  'tablet',
  'desktop',
  'desktop1280',
  'desktop1440',
  'desktop1536',
  'desktop1920',
];

export function breakpointById(id: BreakpointId): Breakpoint {
  return BREAKPOINTS.find((breakpoint) => breakpoint.id === id) ?? BREAKPOINTS[0];
}

export function isBreakpointId(value: unknown): value is BreakpointId {
  return typeof value === 'string' && BREAKPOINT_ORDER.includes(value as BreakpointId);
}

export function cascadeOrder(id: BreakpointId): BreakpointId[] {
  const index = BREAKPOINT_ORDER.indexOf(id);
  return BREAKPOINT_ORDER.slice(0, index + 1).reverse() as BreakpointId[];
}
