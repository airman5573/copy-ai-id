export function formatInlineCode(value: string): string {
  return `\`${value.replace(/`/g, '\\`')}\``;
}

export function truncatedPreview(value: string, maxLength = 80): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
}

export function cssPropertyLabel(property: string): string {
  return property
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
