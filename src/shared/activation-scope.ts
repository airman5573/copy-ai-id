export interface ActivationScopeLocationLike {
  protocol?: string;
  hostname?: string;
  port?: string;
  pathname?: string;
  search?: string;
}

export function normalizeScopeHostname(hostname: string): string {
  const normalized = hostname.trim().toLowerCase();
  if (!normalized) {
    return 'unknown-host';
  }

  return normalized.startsWith('www.') && normalized.length > 4
    ? normalized.slice(4)
    : normalized;
}

export function normalizeScopePathname(pathname?: string): string {
  const trimmed = pathname?.trim() || '/';
  const ensuredLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;

  if (ensuredLeadingSlash === '/') {
    return '/';
  }

  return ensuredLeadingSlash.replace(/\/+$/, '') || '/';
}

export function normalizeScopeSearch(search?: string): string {
  const trimmed = search?.trim() ?? '';
  if (!trimmed || trimmed === '?') {
    return '';
  }

  return trimmed.startsWith('?') ? trimmed : `?${trimmed}`;
}

export function getActivationScopeKey(
  locationLike: ActivationScopeLocationLike,
): string {
  const protocol = locationLike.protocol?.trim().toLowerCase() || 'https:';

  if (protocol === 'file:') {
    return `file://${normalizeScopePathname(locationLike.pathname)}`;
  }

  const hostname = normalizeScopeHostname(locationLike.hostname ?? '');
  const port = locationLike.port?.trim();
  const hostnameWithPort = port ? `${hostname}:${port}` : hostname;
  const pathname = normalizeScopePathname(locationLike.pathname);
  const search = normalizeScopeSearch(locationLike.search);

  return `${protocol}//${hostnameWithPort}${pathname}${search}`;
}
