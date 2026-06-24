import type {
  VisualAttributeMutation,
  VisualMutationError,
} from './editor-messages';

export type VisualAttributeName =
  | 'href'
  | 'target'
  | 'rel'
  | 'src'
  | 'alt'
  | 'title'
  | 'aria-label'
  | 'placeholder'
  | 'type';

export interface VisualAttributeDefinition {
  name: VisualAttributeName;
  label: string;
  helperText: string;
  placeholder?: string;
  inputMode?: 'text' | 'url';
  options?: readonly VisualAttributeOption[];
}

export interface VisualAttributeOption {
  value: string;
  label: string;
}

export type VisualAttributeSanitizeResult =
  | {
    ok: true;
    attribute: VisualAttributeMutation & { name: VisualAttributeName };
    changed: boolean;
  }
  | {
    ok: false;
    error: VisualMutationError;
  };

type NormalizedAttributeValueResult =
  | { ok: true; value: string | null }
  | { ok: false; error: VisualMutationError };

export const LINK_VISUAL_ATTRIBUTE_NAMES: readonly VisualAttributeName[] = ['href', 'target', 'rel'] as const;

export const CURATED_VISUAL_ATTRIBUTE_NAMES: readonly VisualAttributeName[] = [
  'src',
  'alt',
  'title',
  'aria-label',
  'placeholder',
  'type',
] as const;

const TARGET_OPTIONS: readonly VisualAttributeOption[] = [
  { value: '', label: 'Remove target' },
  { value: '_self', label: '_self' },
  { value: '_blank', label: '_blank' },
  { value: '_parent', label: '_parent' },
  { value: '_top', label: '_top' },
] as const;

const TYPE_OPTIONS: readonly VisualAttributeOption[] = [
  { value: '', label: 'Remove type' },
  { value: 'text', label: 'text' },
  { value: 'email', label: 'email' },
  { value: 'tel', label: 'tel' },
  { value: 'url', label: 'url' },
  { value: 'search', label: 'search' },
  { value: 'number', label: 'number' },
  { value: 'password', label: 'password' },
  { value: 'date', label: 'date' },
  { value: 'datetime-local', label: 'datetime-local' },
  { value: 'time', label: 'time' },
  { value: 'month', label: 'month' },
  { value: 'week', label: 'week' },
  { value: 'color', label: 'color' },
  { value: 'checkbox', label: 'checkbox' },
  { value: 'radio', label: 'radio' },
  { value: 'button', label: 'button' },
  { value: 'submit', label: 'submit' },
  { value: 'reset', label: 'reset' },
  { value: 'hidden', label: 'hidden' },
  { value: 'image', label: 'image' },
] as const;

export const VISUAL_ATTRIBUTE_DEFINITIONS: readonly VisualAttributeDefinition[] = [
  {
    name: 'href',
    label: 'Href',
    helperText: '링크 URL입니다. http(s), mailto, tel, 상대 경로와 #anchor만 허용합니다.',
    placeholder: 'https://example.com/page',
    inputMode: 'url',
  },
  {
    name: 'target',
    label: 'Target',
    helperText: '_blank를 선택하면 rel에 noopener noreferrer를 함께 권장합니다.',
    options: TARGET_OPTIONS,
  },
  {
    name: 'rel',
    label: 'Rel',
    helperText: '공백으로 구분된 link relationship token입니다. 예: noopener noreferrer',
    placeholder: 'noopener noreferrer',
  },
  {
    name: 'src',
    label: 'Src',
    helperText: '이미지/미디어 URL입니다. http(s), 상대 경로, #anchor, 안전한 data:image만 허용합니다.',
    placeholder: 'https://example.com/image.jpg',
    inputMode: 'url',
  },
  {
    name: 'alt',
    label: 'Alt',
    helperText: '이미지 대체 텍스트입니다.',
    placeholder: '이미지 설명',
  },
  {
    name: 'title',
    label: 'Title',
    helperText: '브라우저 tooltip과 보조 설명에 쓰이는 title attribute입니다.',
    placeholder: '보조 설명',
  },
  {
    name: 'aria-label',
    label: 'ARIA label',
    helperText: '스크린리더가 읽는 접근성 label입니다.',
    placeholder: '접근성 이름',
  },
  {
    name: 'placeholder',
    label: 'Placeholder',
    helperText: 'input/textarea placeholder입니다.',
    placeholder: '입력 안내 문구',
  },
  {
    name: 'type',
    label: 'Type',
    helperText: 'input/button type 값을 안전한 후보 중에서만 선택합니다.',
    options: TYPE_OPTIONS,
  },
] as const;

const VISUAL_ATTRIBUTE_DEFINITION_BY_NAME = new Map(
  VISUAL_ATTRIBUTE_DEFINITIONS.map((definition) => [definition.name, definition]),
);

const ATTRIBUTE_NAME_SET = new Set<VisualAttributeName>(
  VISUAL_ATTRIBUTE_DEFINITIONS.map((definition) => definition.name),
);

const REL_TOKEN_PATTERN = /^[a-z0-9:-]+$/i;
const CUSTOM_TARGET_PATTERN = /^[A-Za-z][\w:.-]*$/;
const SAFE_RELATIVE_URL_PATTERN = /^(?:#|\/|\.\/|\.\.\/|\?)/;
const SAFE_IMAGE_DATA_URL_PATTERN = /^data:image\/(?:avif|bmp|gif|jpeg|jpg|png|svg\+xml|webp);/i;
const ALLOWED_HREF_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:']);
const ALLOWED_SRC_SCHEMES = new Set(['http:', 'https:']);
const ALLOWED_TYPE_VALUES = new Set(TYPE_OPTIONS.map((option) => option.value).filter(Boolean));

export function visualAttributeDefinitionByName(name: string): VisualAttributeDefinition | null {
  const normalizedName = normalizeVisualAttributeName(name);
  return normalizedName ? VISUAL_ATTRIBUTE_DEFINITION_BY_NAME.get(normalizedName) ?? null : null;
}

export function isSupportedVisualAttributeName(name: string): name is VisualAttributeName {
  const normalizedName = normalizeVisualAttributeName(name);
  return Boolean(normalizedName && ATTRIBUTE_NAME_SET.has(normalizedName));
}

export function sanitizeVisualAttributeMutation(
  mutation: VisualAttributeMutation,
): VisualAttributeSanitizeResult {
  const name = normalizeVisualAttributeName(mutation.name);

  if (!name || !ATTRIBUTE_NAME_SET.has(name)) {
    return {
      ok: false,
      error: invalidAttributeError(
        'unsupported-target',
        `Attribute "${mutation.name}" is not part of the curated visual editing allowlist.`,
      ),
    };
  }

  const rawValue = mutation.value;
  const normalizedValue = normalizeAttributeValue(name, rawValue);

  if (!normalizedValue.ok) {
    return normalizedValue;
  }

  return {
    ok: true,
    attribute: {
      name,
      value: normalizedValue.value,
      previousValue: mutation.previousValue,
    },
    changed: normalizedValue.value !== rawValue,
  };
}

function normalizeVisualAttributeName(name: string): VisualAttributeName | null {
  const normalized = name.trim().toLowerCase();
  return ATTRIBUTE_NAME_SET.has(normalized as VisualAttributeName)
    ? normalized as VisualAttributeName
    : null;
}

function normalizeAttributeValue(
  name: VisualAttributeName,
  value: string | null,
): NormalizedAttributeValueResult {
  if (value === null || value.trim() === '') {
    return { ok: true, value: null };
  }

  switch (name) {
    case 'href':
      return normalizeUrlAttribute(name, value);
    case 'src':
      return normalizeUrlAttribute(name, value);
    case 'target':
      return normalizeTargetAttribute(value);
    case 'rel':
      return normalizeRelAttribute(value);
    case 'type':
      return normalizeTypeAttribute(value);
    case 'alt':
    case 'title':
    case 'aria-label':
    case 'placeholder':
      return { ok: true, value };
    default:
      return exhaustiveAttributeName(name);
  }
}

function normalizeUrlAttribute(
  name: 'href' | 'src',
  value: string,
): NormalizedAttributeValueResult {
  const trimmed = value.trim();
  const scheme = extractUrlScheme(trimmed);

  if (!scheme || SAFE_RELATIVE_URL_PATTERN.test(trimmed) || trimmed.startsWith('//')) {
    return { ok: true, value: trimmed };
  }

  const lowerScheme = scheme.toLowerCase();
  const allowedSchemes = name === 'href' ? ALLOWED_HREF_SCHEMES : ALLOWED_SRC_SCHEMES;
  if (allowedSchemes.has(lowerScheme)) {
    return { ok: true, value: trimmed };
  }

  if (name === 'src' && SAFE_IMAGE_DATA_URL_PATTERN.test(trimmed)) {
    return { ok: true, value: trimmed };
  }

  return {
    ok: false,
    error: invalidAttributeError(
      'invalid-value',
      `The ${name} value uses a blocked or unsupported URL scheme: ${scheme}`,
    ),
  };
}

function normalizeTargetAttribute(value: string): NormalizedAttributeValueResult {
  const trimmed = value.trim();
  const allowedSpecialTargets = new Set(['_self', '_blank', '_parent', '_top']);

  if (allowedSpecialTargets.has(trimmed) || CUSTOM_TARGET_PATTERN.test(trimmed)) {
    return { ok: true, value: trimmed };
  }

  return {
    ok: false,
    error: invalidAttributeError('invalid-value', `The target value "${value}" is not a safe browsing context name.`),
  };
}

function normalizeRelAttribute(value: string): NormalizedAttributeValueResult {
  const tokens = value
    .split(/\s+/)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
  const invalidToken = tokens.find((token) => !REL_TOKEN_PATTERN.test(token));

  if (invalidToken) {
    return {
      ok: false,
      error: invalidAttributeError('invalid-value', `The rel token "${invalidToken}" is invalid.`),
    };
  }

  const uniqueTokens = Array.from(new Set(tokens));
  return { ok: true, value: uniqueTokens.length > 0 ? uniqueTokens.join(' ') : null };
}

function normalizeTypeAttribute(value: string): NormalizedAttributeValueResult {
  const normalized = value.trim().toLowerCase();

  if (ALLOWED_TYPE_VALUES.has(normalized)) {
    return { ok: true, value: normalized };
  }

  return {
    ok: false,
    error: invalidAttributeError('invalid-value', `The type value "${value}" is not in the curated safe type list.`),
  };
}

function extractUrlScheme(value: string): string | null {
  const compact = value.replace(/[\u0000-\u001f\u007f\s]+/g, '');
  const match = compact.match(/^([a-zA-Z][a-zA-Z0-9+.-]*:)/);
  return match?.[1] ?? null;
}

function invalidAttributeError(code: VisualMutationError['code'], detail: string): VisualMutationError {
  return {
    code,
    message: 'The visual attribute mutation is not allowed.',
    detail,
  };
}

function exhaustiveAttributeName(name: never): never {
  throw new Error(`Unsupported visual attribute name: ${name}`);
}
