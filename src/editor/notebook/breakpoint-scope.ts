import { getCurrentMessages } from '../../shared/i18n';

export type NotebookBreakpointScope = 'desktop' | 'tablet' | 'mobile';

export const TAILWIND_MD_BREAKPOINT_PX = 768;
export const TAILWIND_LG_BREAKPOINT_PX = 1024;

export const NOTEBOOK_BREAKPOINT_SCOPE_ORDER: readonly NotebookBreakpointScope[] = [
  'mobile',
  'tablet',
  'desktop',
];

export function normalizeNotebookBreakpointScopes(
  scopes: Iterable<NotebookBreakpointScope>,
): NotebookBreakpointScope[] {
  const selectedScopes = new Set(scopes);
  return NOTEBOOK_BREAKPOINT_SCOPE_ORDER.filter((scope) => selectedScopes.has(scope));
}

export function getNotebookBreakpointScopeCascade(scope: NotebookBreakpointScope): NotebookBreakpointScope[] {
  const scopeIndex = NOTEBOOK_BREAKPOINT_SCOPE_ORDER.indexOf(scope);
  if (scopeIndex < 0) {
    return [];
  }

  return NOTEBOOK_BREAKPOINT_SCOPE_ORDER.slice(scopeIndex);
}

export function getNotebookBreakpointScopeSuffix(
  scopes: NotebookBreakpointScope | readonly NotebookBreakpointScope[],
): string {
  const normalizedScopes = typeof scopes === 'string'
    ? [scopes]
    : normalizeNotebookBreakpointScopes(scopes);

  if (normalizedScopes.length === 0) {
    return '';
  }

  const messages = getCurrentMessages();
  const cascadeScope = NOTEBOOK_BREAKPOINT_SCOPE_ORDER.find((scope) => (
    hasSameNotebookBreakpointScopes(normalizedScopes, getNotebookBreakpointScopeCascade(scope))
  ));

  if (cascadeScope) {
    return messages.notebook.breakpointScopeSuffix[cascadeScope];
  }

  return `${normalizedScopes.map((scope) => messages.notebook.breakpointScope[scope]).join('/')}${messages.notebook.breakpointScopeSuffix.selectedOnlySuffix}`;
}

function hasSameNotebookBreakpointScopes(
  leftScopes: readonly NotebookBreakpointScope[],
  rightScopes: readonly NotebookBreakpointScope[],
): boolean {
  if (leftScopes.length !== rightScopes.length) {
    return false;
  }

  return leftScopes.every((scope, index) => scope === rightScopes[index]);
}
