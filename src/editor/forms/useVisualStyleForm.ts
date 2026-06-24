import { useEffect, useState } from 'react';

import type { VisualEdge } from '../components/visual/EdgeBoxControl';
import type { UnitOption } from '../components/visual/UnitValueInput';
import { useBreakpointStore } from '../stores/useBreakpointStore';
import { useVisualSelectionStore } from '../stores/useVisualSelectionStore';
import { convertNumericUnitValue } from '../utils/numericInput';
import { useStyleEdit } from '../visual/useStyleEdit';

export const SPACING_UNITS: UnitOption[] = [
  { value: 'px', label: 'px' },
  { value: 'rem', label: 'rem' },
  { value: '%', label: '%' },
];

export const SIZE_UNITS: UnitOption[] = [
  { value: 'px', label: 'px' },
  { value: 'rem', label: 'rem' },
  { value: '%', label: '%' },
  { value: 'auto', label: 'auto' },
];

export const BORDER_WIDTH_UNITS: UnitOption[] = [
  { value: 'px', label: 'px' },
  { value: 'rem', label: 'rem' },
  { value: 'em', label: 'em' },
];

export const RADIUS_UNITS: UnitOption[] = [
  { value: 'px', label: 'px' },
  { value: 'rem', label: 'rem' },
  { value: 'em', label: 'em' },
  { value: '%', label: '%' },
];

export type LengthField = {
  value: string;
  unit: string;
};

type LengthFieldName =
  | 'paddingTop'
  | 'paddingRight'
  | 'paddingBottom'
  | 'paddingLeft'
  | 'marginTop'
  | 'marginRight'
  | 'marginBottom'
  | 'marginLeft'
  | 'gapX'
  | 'gapY'
  | 'width'
  | 'height'
  | 'borderTopWidth'
  | 'borderRightWidth'
  | 'borderBottomWidth'
  | 'borderLeftWidth'
  | 'radius';

type VisualStyleFormValues = Record<LengthFieldName, LengthField>;

const FIELD_PROPERTY: Record<LengthFieldName, string> = {
  paddingTop: 'padding-top',
  paddingRight: 'padding-right',
  paddingBottom: 'padding-bottom',
  paddingLeft: 'padding-left',
  marginTop: 'margin-top',
  marginRight: 'margin-right',
  marginBottom: 'margin-bottom',
  marginLeft: 'margin-left',
  gapX: 'column-gap',
  gapY: 'row-gap',
  width: 'width',
  height: 'height',
  borderTopWidth: 'border-top-width',
  borderRightWidth: 'border-right-width',
  borderBottomWidth: 'border-bottom-width',
  borderLeftWidth: 'border-left-width',
  radius: 'border-top-left-radius',
};

const RADIUS_PROPERTIES = [
  'border-top-left-radius',
  'border-top-right-radius',
  'border-bottom-right-radius',
  'border-bottom-left-radius',
] as const;

const EDGE_FIELDS: Record<'padding' | 'margin' | 'border-width', Record<VisualEdge, LengthFieldName>> = {
  padding: { top: 'paddingTop', right: 'paddingRight', bottom: 'paddingBottom', left: 'paddingLeft' },
  margin: { top: 'marginTop', right: 'marginRight', bottom: 'marginBottom', left: 'marginLeft' },
  'border-width': {
    top: 'borderTopWidth',
    right: 'borderRightWidth',
    bottom: 'borderBottomWidth',
    left: 'borderLeftWidth',
  },
};

export type LengthFieldApi = {
  value: string;
  unit: string;
  setValue: (value: string) => void;
  setUnit: (unit: string) => void;
  commit: () => void;
  reset: () => void;
};

export type EdgeGroupApi = {
  values: Record<VisualEdge, string>;
  units: Record<VisualEdge, string>;
  setValue: (edge: VisualEdge, value: string) => void;
  setUnit: (edge: VisualEdge, unit: string) => void;
  setAll: (value: string, unit: string) => void;
  commit: () => void;
  commitAll: (value: string, unit: string) => void;
  resetEdge: (edge: VisualEdge) => void;
  resetAll: () => void;
};

export type VisualStyleFormApi = {
  padding: EdgeGroupApi;
  margin: EdgeGroupApi;
  gapX: LengthFieldApi;
  gapY: LengthFieldApi;
  gapEnabled: boolean;
  width: LengthFieldApi;
  height: LengthFieldApi;
  borderWidth: EdgeGroupApi;
  radius: LengthFieldApi;
};

export function parseLength(raw: string): LengthField {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return { value: '', unit: 'px' };
  }
  if (trimmed === 'auto') {
    return { value: '', unit: 'auto' };
  }
  const match = /^(-?\d*\.?\d+)(px|rem|em|%|vw|vh|dvw|dvh|ch|lh)$/.exec(trimmed);
  if (match) {
    return { value: match[1], unit: match[2] };
  }
  return { value: trimmed, unit: 'px' };
}

export function composeLength(field: LengthField): string {
  if (field.unit === 'auto') {
    return 'auto';
  }
  const trimmed = field.value.trim();
  if (trimmed === '') {
    return '';
  }
  return /^-?\d*\.?\d+$/.test(trimmed) ? `${trimmed}${field.unit}` : trimmed;
}

export function useVisualStyleForm(): VisualStyleFormApi {
  const edit = useStyleEdit();
  const selectedKey = useVisualSelectionStore((state) => {
    const target = state.panelTarget?.target ?? state.snapshot?.target;
    if (!target) {
      return '';
    }
    return target.kind === 'ai-id'
      ? `ai-id:${target.aiId}:${target.instanceIndex}:${state.panelTarget?.nodeId ?? state.snapshot?.nodeId ?? ''}`
      : `fallback:${target.nodeId}:${target.selector}:${state.panelTarget?.nodeId ?? state.snapshot?.nodeId ?? ''}`;
  });
  const snapshotReceivedAt = useVisualSelectionStore((state) => state.snapshotReceivedAt);
  const breakpointId = useBreakpointStore((state) => state.activeBreakpointId);
  const [values, setValues] = useState<VisualStyleFormValues>(() => buildFormValues(edit.valueOf));

  useEffect(() => {
    setValues(buildFormValues(edit.valueOf));
  }, [breakpointId, edit.valueOf, selectedKey, snapshotReceivedAt]);

  const commitFieldValue = (controlKind: string, name: LengthFieldName, value: LengthField): void => {
    edit.commitStyle(FIELD_PROPERTY[name], composeLength(value), {
      control: { id: `${controlKind}:${FIELD_PROPERTY[name]}`, label: controlKind },
    });
  };

  const commitField = (controlKind: string, name: LengthFieldName): void => {
    commitFieldValue(controlKind, name, values[name]);
  };

  const setField = (name: LengthFieldName, value: LengthField): void => {
    setValues((current) => ({ ...current, [name]: value }));
  };

  const fieldApi = (controlKind: string, name: LengthFieldName): LengthFieldApi => ({
    value: values[name]?.value ?? '',
    unit: values[name]?.unit ?? 'px',
    setValue: (value) => setField(name, { ...values[name], value }),
    setUnit: (unit) => {
      const current = values[name];
      const next = {
        value: convertNumericUnitValue(current.value, current.unit, unit),
        unit,
      };
      setField(name, next);
      commitFieldValue(controlKind, name, next);
    },
    commit: () => commitField(controlKind, name),
    reset: () => edit.resetStyle(FIELD_PROPERTY[name], {
      control: { id: `${controlKind}:${FIELD_PROPERTY[name]}`, label: controlKind },
    }),
  });

  const edgeGroupApi = (group: 'padding' | 'margin' | 'border-width'): EdgeGroupApi => {
    const fields = EDGE_FIELDS[group];
    const apiByEdge = Object.fromEntries(
      (Object.keys(fields) as VisualEdge[]).map((edge) => [edge, fieldApi(group, fields[edge])]),
    ) as Record<VisualEdge, LengthFieldApi>;

    return {
      values: mapEdges(apiByEdge, (api) => api.value),
      units: mapEdges(apiByEdge, (api) => api.unit),
      setValue: (edge, value) => apiByEdge[edge].setValue(value),
      setUnit: (edge, unit) => apiByEdge[edge].setUnit(unit),
      setAll: (value, unit) => {
        setValues((current) => {
          const next = { ...current };
          (Object.keys(fields) as VisualEdge[]).forEach((edge) => {
            next[fields[edge]] = { value, unit };
          });
          return next;
        });
      },
      commit: () => (Object.keys(fields) as VisualEdge[]).forEach((edge) => apiByEdge[edge].commit()),
      commitAll: (value, unit) => {
        const composed = composeLength({ value, unit });
        edit.commitStyles((Object.keys(fields) as VisualEdge[]).map((edge) => ({
          propertyId: FIELD_PROPERTY[fields[edge]],
          value: composed,
          control: { id: group, label: group },
        })));
      },
      resetEdge: (edge) => apiByEdge[edge].reset(),
      resetAll: () => edit.commitStyles((Object.keys(fields) as VisualEdge[]).map((edge) => ({
        propertyId: FIELD_PROPERTY[fields[edge]],
        value: '',
        control: { id: group, label: group },
      }))),
    };
  };

  const display = edit.valueOf('display');
  const gapEnabled = ['flex', 'inline-flex', 'grid', 'inline-grid'].includes(display);

  const radiusBase = fieldApi('border-radius', 'radius');
  const radius: LengthFieldApi = {
    ...radiusBase,
    commit: () => {
      const composed = composeLength(values.radius);
      edit.commitStyles(RADIUS_PROPERTIES.map((propertyId) => ({
        propertyId,
        value: composed,
        control: { id: 'border-radius', label: 'Border radius' },
      })));
    },
    reset: () => edit.commitStyles(RADIUS_PROPERTIES.map((propertyId) => ({
      propertyId,
      value: '',
      control: { id: 'border-radius', label: 'Border radius' },
    }))),
  };

  return {
    padding: edgeGroupApi('padding'),
    margin: edgeGroupApi('margin'),
    gapX: fieldApi('gap', 'gapX'),
    gapY: fieldApi('gap', 'gapY'),
    gapEnabled,
    width: fieldApi('width', 'width'),
    height: fieldApi('height', 'height'),
    borderWidth: edgeGroupApi('border-width'),
    radius,
  };
}

function buildFormValues(valueOf: (propertyId: string) => string): VisualStyleFormValues {
  return Object.fromEntries(
    (Object.keys(FIELD_PROPERTY) as LengthFieldName[]).map((name) => [
      name,
      parseLength(valueOf(FIELD_PROPERTY[name])),
    ]),
  ) as VisualStyleFormValues;
}

function mapEdges<T>(apiByEdge: Record<VisualEdge, LengthFieldApi>, mapper: (api: LengthFieldApi) => T): Record<VisualEdge, T> {
  return {
    top: mapper(apiByEdge.top),
    right: mapper(apiByEdge.right),
    bottom: mapper(apiByEdge.bottom),
    left: mapper(apiByEdge.left),
  };
}
