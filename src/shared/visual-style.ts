import type {
  QuickActionCategory,
  VisualBoxEdge,
  VisualBoxRegion,
  VisualStyleDeclarationMutation,
} from './editor-messages';

export type VisualStyleCategory = Exclude<QuickActionCategory, 'content'>;

export type VisualStyleControlKind =
  | 'select'
  | 'unit-input'
  | 'edge-box'
  | 'color'
  | 'slider'
  | 'text-input'
  | 'textarea';

export type VisualStyleValueKind =
  | 'keyword'
  | 'length'
  | 'length-or-keyword'
  | 'color'
  | 'number'
  | 'integer'
  | 'font-family'
  | 'shadow'
  | 'image'
  | 'position'
  | 'repeat'
  | 'text';

export type VisualStyleUnit =
  | 'px'
  | 'rem'
  | 'em'
  | '%'
  | 'vh'
  | 'vw'
  | 'dvh'
  | 'dvw'
  | 'ch'
  | 'lh';

export interface VisualStylePreset {
  label: string;
  value: string;
}

export interface VisualStylePropertyDefinition {
  property: string;
  category: VisualStyleCategory;
  group: string;
  label: string;
  description?: string;
  control: VisualStyleControlKind;
  valueKind: VisualStyleValueKind;
  defaultUnit?: VisualStyleUnit;
  units?: readonly VisualStyleUnit[];
  presets?: readonly VisualStylePreset[];
  min?: number;
  max?: number;
  step?: number;
  inherited?: boolean;
  boxRegion?: VisualBoxRegion;
  boxEdge?: VisualBoxEdge;
}

export interface VisualStylePropertyGroupDefinition {
  id: string;
  category: VisualStyleCategory;
  label: string;
  description?: string;
  properties: readonly VisualCssPropertyId[];
}

const LENGTH_UNITS = ['px', 'rem', 'em', '%', 'vh', 'vw', 'dvh', 'dvw', 'ch'] as const;
const TEXT_LENGTH_UNITS = ['px', 'rem', 'em', '%', 'ch'] as const;
const RADIUS_UNITS = ['px', 'rem', 'em', '%'] as const;
const BORDER_WIDTH_UNITS = ['px', 'rem', 'em'] as const;

const DISPLAY_PRESETS = [
  { label: 'Block', value: 'block' },
  { label: 'Inline block', value: 'inline-block' },
  { label: 'Inline', value: 'inline' },
  { label: 'Flex', value: 'flex' },
  { label: 'Inline flex', value: 'inline-flex' },
  { label: 'Grid', value: 'grid' },
  { label: 'Inline grid', value: 'inline-grid' },
  { label: 'None', value: 'none' },
] as const;

const POSITION_PRESETS = [
  { label: 'Static', value: 'static' },
  { label: 'Relative', value: 'relative' },
  { label: 'Absolute', value: 'absolute' },
  { label: 'Fixed', value: 'fixed' },
  { label: 'Sticky', value: 'sticky' },
] as const;

const OVERFLOW_PRESETS = [
  { label: 'Visible', value: 'visible' },
  { label: 'Hidden', value: 'hidden' },
  { label: 'Clip', value: 'clip' },
  { label: 'Scroll', value: 'scroll' },
  { label: 'Auto', value: 'auto' },
] as const;

const FLEX_DIRECTION_PRESETS = [
  { label: 'Row', value: 'row' },
  { label: 'Row reverse', value: 'row-reverse' },
  { label: 'Column', value: 'column' },
  { label: 'Column reverse', value: 'column-reverse' },
] as const;

const FLEX_WRAP_PRESETS = [
  { label: 'No wrap', value: 'nowrap' },
  { label: 'Wrap', value: 'wrap' },
  { label: 'Wrap reverse', value: 'wrap-reverse' },
] as const;

const JUSTIFY_CONTENT_PRESETS = [
  { label: 'Start', value: 'flex-start' },
  { label: 'Center', value: 'center' },
  { label: 'End', value: 'flex-end' },
  { label: 'Space between', value: 'space-between' },
  { label: 'Space around', value: 'space-around' },
  { label: 'Space evenly', value: 'space-evenly' },
] as const;

const ALIGN_ITEMS_PRESETS = [
  { label: 'Stretch', value: 'stretch' },
  { label: 'Start', value: 'flex-start' },
  { label: 'Center', value: 'center' },
  { label: 'End', value: 'flex-end' },
  { label: 'Baseline', value: 'baseline' },
] as const;

const BOX_SIZING_PRESETS = [
  { label: 'Border box', value: 'border-box' },
  { label: 'Content box', value: 'content-box' },
] as const;

const SIZE_KEYWORD_PRESETS = [
  { label: 'Auto', value: 'auto' },
  { label: 'Fit content', value: 'fit-content' },
  { label: 'Max content', value: 'max-content' },
  { label: 'Min content', value: 'min-content' },
  { label: '100%', value: '100%' },
] as const;

const FONT_WEIGHT_PRESETS = [
  { label: 'Thin', value: '100' },
  { label: 'Light', value: '300' },
  { label: 'Normal', value: '400' },
  { label: 'Medium', value: '500' },
  { label: 'Semibold', value: '600' },
  { label: 'Bold', value: '700' },
  { label: 'Black', value: '900' },
] as const;

const FONT_STYLE_PRESETS = [
  { label: 'Normal', value: 'normal' },
  { label: 'Italic', value: 'italic' },
  { label: 'Oblique', value: 'oblique' },
] as const;

const TEXT_ALIGN_PRESETS = [
  { label: 'Left', value: 'left' },
  { label: 'Center', value: 'center' },
  { label: 'Right', value: 'right' },
  { label: 'Justify', value: 'justify' },
] as const;

const TEXT_DECORATION_PRESETS = [
  { label: 'None', value: 'none' },
  { label: 'Underline', value: 'underline' },
  { label: 'Line through', value: 'line-through' },
  { label: 'Overline', value: 'overline' },
] as const;

const TEXT_TRANSFORM_PRESETS = [
  { label: 'None', value: 'none' },
  { label: 'Uppercase', value: 'uppercase' },
  { label: 'Lowercase', value: 'lowercase' },
  { label: 'Capitalize', value: 'capitalize' },
] as const;

const WHITE_SPACE_PRESETS = [
  { label: 'Normal', value: 'normal' },
  { label: 'No wrap', value: 'nowrap' },
  { label: 'Pre', value: 'pre' },
  { label: 'Pre wrap', value: 'pre-wrap' },
  { label: 'Break spaces', value: 'break-spaces' },
] as const;

const BACKGROUND_SIZE_PRESETS = [
  { label: 'Auto', value: 'auto' },
  { label: 'Cover', value: 'cover' },
  { label: 'Contain', value: 'contain' },
] as const;

const BACKGROUND_POSITION_PRESETS = [
  { label: 'Center', value: 'center' },
  { label: 'Top', value: 'top' },
  { label: 'Right', value: 'right' },
  { label: 'Bottom', value: 'bottom' },
  { label: 'Left', value: 'left' },
] as const;

const BACKGROUND_REPEAT_PRESETS = [
  { label: 'Repeat', value: 'repeat' },
  { label: 'No repeat', value: 'no-repeat' },
  { label: 'Repeat X', value: 'repeat-x' },
  { label: 'Repeat Y', value: 'repeat-y' },
  { label: 'Round', value: 'round' },
  { label: 'Space', value: 'space' },
] as const;

const OBJECT_FIT_PRESETS = [
  { label: 'Fill', value: 'fill' },
  { label: 'Contain', value: 'contain' },
  { label: 'Cover', value: 'cover' },
  { label: 'None', value: 'none' },
  { label: 'Scale down', value: 'scale-down' },
] as const;

const BORDER_STYLE_PRESETS = [
  { label: 'None', value: 'none' },
  { label: 'Solid', value: 'solid' },
  { label: 'Dashed', value: 'dashed' },
  { label: 'Dotted', value: 'dotted' },
  { label: 'Double', value: 'double' },
  { label: 'Groove', value: 'groove' },
  { label: 'Ridge', value: 'ridge' },
  { label: 'Inset', value: 'inset' },
  { label: 'Outset', value: 'outset' },
] as const;

const COMMON_COLOR_PRESETS = [
  { label: 'Transparent', value: 'transparent' },
  { label: 'Current color', value: 'currentColor' },
  { label: 'Black', value: '#000000' },
  { label: 'White', value: '#ffffff' },
] as const;

export const VISUAL_STYLE_PROPERTY_DEFINITIONS = [
  // Layout
  { property: 'display', category: 'layout', group: 'display', label: 'Display', control: 'select', valueKind: 'keyword', presets: DISPLAY_PRESETS },
  { property: 'position', category: 'layout', group: 'position', label: 'Position', control: 'select', valueKind: 'keyword', presets: POSITION_PRESETS },
  { property: 'top', category: 'layout', group: 'position', label: 'Top', control: 'unit-input', valueKind: 'length-or-keyword', defaultUnit: 'px', units: LENGTH_UNITS, presets: SIZE_KEYWORD_PRESETS },
  { property: 'right', category: 'layout', group: 'position', label: 'Right', control: 'unit-input', valueKind: 'length-or-keyword', defaultUnit: 'px', units: LENGTH_UNITS, presets: SIZE_KEYWORD_PRESETS },
  { property: 'bottom', category: 'layout', group: 'position', label: 'Bottom', control: 'unit-input', valueKind: 'length-or-keyword', defaultUnit: 'px', units: LENGTH_UNITS, presets: SIZE_KEYWORD_PRESETS },
  { property: 'left', category: 'layout', group: 'position', label: 'Left', control: 'unit-input', valueKind: 'length-or-keyword', defaultUnit: 'px', units: LENGTH_UNITS, presets: SIZE_KEYWORD_PRESETS },
  { property: 'z-index', category: 'layout', group: 'position', label: 'Z index', control: 'text-input', valueKind: 'integer' },
  { property: 'overflow', category: 'layout', group: 'overflow', label: 'Overflow', control: 'select', valueKind: 'keyword', presets: OVERFLOW_PRESETS },
  { property: 'overflow-x', category: 'layout', group: 'overflow', label: 'Overflow X', control: 'select', valueKind: 'keyword', presets: OVERFLOW_PRESETS },
  { property: 'overflow-y', category: 'layout', group: 'overflow', label: 'Overflow Y', control: 'select', valueKind: 'keyword', presets: OVERFLOW_PRESETS },
  { property: 'flex-direction', category: 'layout', group: 'flex', label: 'Flex direction', control: 'select', valueKind: 'keyword', presets: FLEX_DIRECTION_PRESETS },
  { property: 'flex-wrap', category: 'layout', group: 'flex', label: 'Flex wrap', control: 'select', valueKind: 'keyword', presets: FLEX_WRAP_PRESETS },
  { property: 'justify-content', category: 'layout', group: 'flex', label: 'Justify content', control: 'select', valueKind: 'keyword', presets: JUSTIFY_CONTENT_PRESETS },
  { property: 'align-items', category: 'layout', group: 'flex', label: 'Align items', control: 'select', valueKind: 'keyword', presets: ALIGN_ITEMS_PRESETS },
  { property: 'align-content', category: 'layout', group: 'flex', label: 'Align content', control: 'select', valueKind: 'keyword', presets: JUSTIFY_CONTENT_PRESETS },
  { property: 'order', category: 'layout', group: 'flex', label: 'Order', control: 'text-input', valueKind: 'integer' },
  { property: 'grid-template-columns', category: 'layout', group: 'grid', label: 'Grid columns', control: 'text-input', valueKind: 'text' },
  { property: 'grid-template-rows', category: 'layout', group: 'grid', label: 'Grid rows', control: 'text-input', valueKind: 'text' },
  { property: 'grid-auto-flow', category: 'layout', group: 'grid', label: 'Grid auto flow', control: 'select', valueKind: 'keyword', presets: [
    { label: 'Row', value: 'row' },
    { label: 'Column', value: 'column' },
    { label: 'Dense', value: 'dense' },
    { label: 'Row dense', value: 'row dense' },
    { label: 'Column dense', value: 'column dense' },
  ] },
  { property: 'place-items', category: 'layout', group: 'grid', label: 'Place items', control: 'select', valueKind: 'keyword', presets: [
    { label: 'Start', value: 'start' },
    { label: 'Center', value: 'center' },
    { label: 'End', value: 'end' },
    { label: 'Stretch', value: 'stretch' },
  ] },

  // Spacing
  { property: 'padding-top', category: 'spacing', group: 'padding', label: 'Padding top', control: 'edge-box', valueKind: 'length', defaultUnit: 'px', units: LENGTH_UNITS, boxRegion: 'padding', boxEdge: 'top' },
  { property: 'padding-right', category: 'spacing', group: 'padding', label: 'Padding right', control: 'edge-box', valueKind: 'length', defaultUnit: 'px', units: LENGTH_UNITS, boxRegion: 'padding', boxEdge: 'right' },
  { property: 'padding-bottom', category: 'spacing', group: 'padding', label: 'Padding bottom', control: 'edge-box', valueKind: 'length', defaultUnit: 'px', units: LENGTH_UNITS, boxRegion: 'padding', boxEdge: 'bottom' },
  { property: 'padding-left', category: 'spacing', group: 'padding', label: 'Padding left', control: 'edge-box', valueKind: 'length', defaultUnit: 'px', units: LENGTH_UNITS, boxRegion: 'padding', boxEdge: 'left' },
  { property: 'margin-top', category: 'spacing', group: 'margin', label: 'Margin top', control: 'edge-box', valueKind: 'length-or-keyword', defaultUnit: 'px', units: LENGTH_UNITS, presets: [{ label: 'Auto', value: 'auto' }], boxRegion: 'margin', boxEdge: 'top' },
  { property: 'margin-right', category: 'spacing', group: 'margin', label: 'Margin right', control: 'edge-box', valueKind: 'length-or-keyword', defaultUnit: 'px', units: LENGTH_UNITS, presets: [{ label: 'Auto', value: 'auto' }], boxRegion: 'margin', boxEdge: 'right' },
  { property: 'margin-bottom', category: 'spacing', group: 'margin', label: 'Margin bottom', control: 'edge-box', valueKind: 'length-or-keyword', defaultUnit: 'px', units: LENGTH_UNITS, presets: [{ label: 'Auto', value: 'auto' }], boxRegion: 'margin', boxEdge: 'bottom' },
  { property: 'margin-left', category: 'spacing', group: 'margin', label: 'Margin left', control: 'edge-box', valueKind: 'length-or-keyword', defaultUnit: 'px', units: LENGTH_UNITS, presets: [{ label: 'Auto', value: 'auto' }], boxRegion: 'margin', boxEdge: 'left' },
  { property: 'row-gap', category: 'spacing', group: 'gap', label: 'Row gap', control: 'unit-input', valueKind: 'length', defaultUnit: 'px', units: LENGTH_UNITS, boxRegion: 'gap', boxEdge: 'row' },
  { property: 'column-gap', category: 'spacing', group: 'gap', label: 'Column gap', control: 'unit-input', valueKind: 'length', defaultUnit: 'px', units: LENGTH_UNITS, boxRegion: 'gap', boxEdge: 'column' },
  { property: 'gap', category: 'spacing', group: 'gap', label: 'Gap', control: 'unit-input', valueKind: 'length', defaultUnit: 'px', units: LENGTH_UNITS, boxRegion: 'gap', boxEdge: 'all' },

  // Size
  { property: 'box-sizing', category: 'size', group: 'box', label: 'Box sizing', control: 'select', valueKind: 'keyword', presets: BOX_SIZING_PRESETS },
  { property: 'width', category: 'size', group: 'box', label: 'Width', control: 'unit-input', valueKind: 'length-or-keyword', defaultUnit: 'px', units: LENGTH_UNITS, presets: SIZE_KEYWORD_PRESETS },
  { property: 'height', category: 'size', group: 'box', label: 'Height', control: 'unit-input', valueKind: 'length-or-keyword', defaultUnit: 'px', units: LENGTH_UNITS, presets: SIZE_KEYWORD_PRESETS },
  { property: 'min-width', category: 'size', group: 'constraints', label: 'Min width', control: 'unit-input', valueKind: 'length-or-keyword', defaultUnit: 'px', units: LENGTH_UNITS, presets: SIZE_KEYWORD_PRESETS },
  { property: 'max-width', category: 'size', group: 'constraints', label: 'Max width', control: 'unit-input', valueKind: 'length-or-keyword', defaultUnit: 'px', units: LENGTH_UNITS, presets: SIZE_KEYWORD_PRESETS },
  { property: 'min-height', category: 'size', group: 'constraints', label: 'Min height', control: 'unit-input', valueKind: 'length-or-keyword', defaultUnit: 'px', units: LENGTH_UNITS, presets: SIZE_KEYWORD_PRESETS },
  { property: 'max-height', category: 'size', group: 'constraints', label: 'Max height', control: 'unit-input', valueKind: 'length-or-keyword', defaultUnit: 'px', units: LENGTH_UNITS, presets: SIZE_KEYWORD_PRESETS },
  { property: 'aspect-ratio', category: 'size', group: 'media', label: 'Aspect ratio', control: 'text-input', valueKind: 'text', presets: [
    { label: 'Auto', value: 'auto' },
    { label: 'Square', value: '1 / 1' },
    { label: 'Video', value: '16 / 9' },
  ] },
  { property: 'object-fit', category: 'size', group: 'media', label: 'Object fit', control: 'select', valueKind: 'keyword', presets: OBJECT_FIT_PRESETS },
  { property: 'object-position', category: 'size', group: 'media', label: 'Object position', control: 'text-input', valueKind: 'position', presets: BACKGROUND_POSITION_PRESETS },

  // Style
  { property: 'color', category: 'style', group: 'color', label: 'Text color', control: 'color', valueKind: 'color', presets: COMMON_COLOR_PRESETS, inherited: true },
  { property: 'background-color', category: 'style', group: 'color', label: 'Background color', control: 'color', valueKind: 'color', presets: COMMON_COLOR_PRESETS },
  { property: 'opacity', category: 'style', group: 'effects', label: 'Opacity', control: 'slider', valueKind: 'number', min: 0, max: 1, step: 0.01 },
  { property: 'font-size', category: 'style', group: 'typography', label: 'Font size', control: 'unit-input', valueKind: 'length', defaultUnit: 'px', units: TEXT_LENGTH_UNITS, inherited: true },
  { property: 'font-weight', category: 'style', group: 'typography', label: 'Font weight', control: 'select', valueKind: 'keyword', presets: FONT_WEIGHT_PRESETS, inherited: true },
  { property: 'font-family', category: 'style', group: 'typography', label: 'Font family', control: 'text-input', valueKind: 'font-family', inherited: true },
  { property: 'font-style', category: 'style', group: 'typography', label: 'Font style', control: 'select', valueKind: 'keyword', presets: FONT_STYLE_PRESETS, inherited: true },
  { property: 'line-height', category: 'style', group: 'typography', label: 'Line height', control: 'unit-input', valueKind: 'length-or-keyword', defaultUnit: 'px', units: ['px', 'rem', 'em', '%', 'lh'], presets: [{ label: 'Normal', value: 'normal' }], inherited: true },
  { property: 'letter-spacing', category: 'style', group: 'typography', label: 'Letter spacing', control: 'unit-input', valueKind: 'length', defaultUnit: 'px', units: TEXT_LENGTH_UNITS, inherited: true },
  { property: 'text-align', category: 'style', group: 'typography', label: 'Text align', control: 'select', valueKind: 'keyword', presets: TEXT_ALIGN_PRESETS, inherited: true },
  { property: 'text-decoration-line', category: 'style', group: 'typography', label: 'Text decoration', control: 'select', valueKind: 'keyword', presets: TEXT_DECORATION_PRESETS, inherited: true },
  { property: 'text-transform', category: 'style', group: 'typography', label: 'Text transform', control: 'select', valueKind: 'keyword', presets: TEXT_TRANSFORM_PRESETS, inherited: true },
  { property: 'white-space', category: 'style', group: 'typography', label: 'White space', control: 'select', valueKind: 'keyword', presets: WHITE_SPACE_PRESETS, inherited: true },
  { property: 'box-shadow', category: 'style', group: 'effects', label: 'Box shadow', control: 'textarea', valueKind: 'shadow', presets: [{ label: 'None', value: 'none' }] },
  { property: 'text-shadow', category: 'style', group: 'effects', label: 'Text shadow', control: 'textarea', valueKind: 'shadow', presets: [{ label: 'None', value: 'none' }], inherited: true },
  { property: 'filter', category: 'style', group: 'effects', label: 'Filter', control: 'textarea', valueKind: 'text', presets: [{ label: 'None', value: 'none' }] },
  { property: 'backdrop-filter', category: 'style', group: 'effects', label: 'Backdrop filter', control: 'textarea', valueKind: 'text', presets: [{ label: 'None', value: 'none' }] },
  { property: 'background-image', category: 'style', group: 'background', label: 'Background image', control: 'textarea', valueKind: 'image', presets: [{ label: 'None', value: 'none' }] },
  { property: 'background-size', category: 'style', group: 'background', label: 'Background size', control: 'select', valueKind: 'keyword', presets: BACKGROUND_SIZE_PRESETS },
  { property: 'background-position', category: 'style', group: 'background', label: 'Background position', control: 'text-input', valueKind: 'position', presets: BACKGROUND_POSITION_PRESETS },
  { property: 'background-repeat', category: 'style', group: 'background', label: 'Background repeat', control: 'select', valueKind: 'repeat', presets: BACKGROUND_REPEAT_PRESETS },

  // Border
  { property: 'border-top-width', category: 'border', group: 'border-width', label: 'Border top width', control: 'edge-box', valueKind: 'length', defaultUnit: 'px', units: BORDER_WIDTH_UNITS, boxRegion: 'border', boxEdge: 'top' },
  { property: 'border-right-width', category: 'border', group: 'border-width', label: 'Border right width', control: 'edge-box', valueKind: 'length', defaultUnit: 'px', units: BORDER_WIDTH_UNITS, boxRegion: 'border', boxEdge: 'right' },
  { property: 'border-bottom-width', category: 'border', group: 'border-width', label: 'Border bottom width', control: 'edge-box', valueKind: 'length', defaultUnit: 'px', units: BORDER_WIDTH_UNITS, boxRegion: 'border', boxEdge: 'bottom' },
  { property: 'border-left-width', category: 'border', group: 'border-width', label: 'Border left width', control: 'edge-box', valueKind: 'length', defaultUnit: 'px', units: BORDER_WIDTH_UNITS, boxRegion: 'border', boxEdge: 'left' },
  { property: 'border-style', category: 'border', group: 'border-style', label: 'Border style', control: 'select', valueKind: 'keyword', presets: BORDER_STYLE_PRESETS, boxRegion: 'border', boxEdge: 'all' },
  { property: 'border-color', category: 'border', group: 'border-color', label: 'Border color', control: 'color', valueKind: 'color', presets: COMMON_COLOR_PRESETS, boxRegion: 'border', boxEdge: 'all' },
  { property: 'border-top-left-radius', category: 'border', group: 'radius', label: 'Radius top left', control: 'edge-box', valueKind: 'length', defaultUnit: 'px', units: RADIUS_UNITS },
  { property: 'border-top-right-radius', category: 'border', group: 'radius', label: 'Radius top right', control: 'edge-box', valueKind: 'length', defaultUnit: 'px', units: RADIUS_UNITS },
  { property: 'border-bottom-right-radius', category: 'border', group: 'radius', label: 'Radius bottom right', control: 'edge-box', valueKind: 'length', defaultUnit: 'px', units: RADIUS_UNITS },
  { property: 'border-bottom-left-radius', category: 'border', group: 'radius', label: 'Radius bottom left', control: 'edge-box', valueKind: 'length', defaultUnit: 'px', units: RADIUS_UNITS },
  { property: 'outline-width', category: 'border', group: 'outline', label: 'Outline width', control: 'unit-input', valueKind: 'length', defaultUnit: 'px', units: BORDER_WIDTH_UNITS },
  { property: 'outline-style', category: 'border', group: 'outline', label: 'Outline style', control: 'select', valueKind: 'keyword', presets: BORDER_STYLE_PRESETS },
  { property: 'outline-color', category: 'border', group: 'outline', label: 'Outline color', control: 'color', valueKind: 'color', presets: COMMON_COLOR_PRESETS },
  { property: 'outline-offset', category: 'border', group: 'outline', label: 'Outline offset', control: 'unit-input', valueKind: 'length', defaultUnit: 'px', units: BORDER_WIDTH_UNITS },
] as const satisfies readonly VisualStylePropertyDefinition[];

export type VisualCssPropertyId = (typeof VISUAL_STYLE_PROPERTY_DEFINITIONS)[number]['property'];

export const VISUAL_STYLE_PROPERTY_BY_ID = Object.fromEntries(
  VISUAL_STYLE_PROPERTY_DEFINITIONS.map((definition) => [definition.property, definition]),
) as Record<VisualCssPropertyId, VisualStylePropertyDefinition>;

export const VISUAL_STYLE_CATEGORIES = ['layout', 'spacing', 'size', 'style', 'border'] as const satisfies readonly VisualStyleCategory[];

export const VISUAL_STYLE_PROPERTY_GROUPS = [
  { id: 'display', category: 'layout', label: 'Display', properties: ['display'] },
  { id: 'position', category: 'layout', label: 'Position', properties: ['position', 'top', 'right', 'bottom', 'left', 'z-index'] },
  { id: 'overflow', category: 'layout', label: 'Overflow', properties: ['overflow', 'overflow-x', 'overflow-y'] },
  { id: 'flex', category: 'layout', label: 'Flex', properties: ['flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'align-content', 'order'] },
  { id: 'grid', category: 'layout', label: 'Grid', properties: ['grid-template-columns', 'grid-template-rows', 'grid-auto-flow', 'place-items'] },
  { id: 'padding', category: 'spacing', label: 'Padding', properties: ['padding-top', 'padding-right', 'padding-bottom', 'padding-left'] },
  { id: 'margin', category: 'spacing', label: 'Margin', properties: ['margin-top', 'margin-right', 'margin-bottom', 'margin-left'] },
  { id: 'gap', category: 'spacing', label: 'Gap', properties: ['row-gap', 'column-gap', 'gap'] },
  { id: 'box', category: 'size', label: 'Box', properties: ['box-sizing', 'width', 'height'] },
  { id: 'constraints', category: 'size', label: 'Constraints', properties: ['min-width', 'max-width', 'min-height', 'max-height'] },
  { id: 'media', category: 'size', label: 'Media', properties: ['aspect-ratio', 'object-fit', 'object-position'] },
  { id: 'color', category: 'style', label: 'Color', properties: ['color', 'background-color'] },
  { id: 'typography', category: 'style', label: 'Typography', properties: ['font-size', 'font-weight', 'font-family', 'font-style', 'line-height', 'letter-spacing', 'text-align', 'text-decoration-line', 'text-transform', 'white-space'] },
  { id: 'effects', category: 'style', label: 'Effects', properties: ['opacity', 'box-shadow', 'text-shadow', 'filter', 'backdrop-filter'] },
  { id: 'background', category: 'style', label: 'Background image', properties: ['background-image', 'background-size', 'background-position', 'background-repeat'] },
  { id: 'border-width', category: 'border', label: 'Border width', properties: ['border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width'] },
  { id: 'border-style', category: 'border', label: 'Border style', properties: ['border-style'] },
  { id: 'border-color', category: 'border', label: 'Border color', properties: ['border-color'] },
  { id: 'radius', category: 'border', label: 'Radius', properties: ['border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius'] },
  { id: 'outline', category: 'border', label: 'Outline', properties: ['outline-width', 'outline-style', 'outline-color', 'outline-offset'] },
] as const satisfies readonly VisualStylePropertyGroupDefinition[];

export const VISUAL_STYLE_COMPUTED_PROPERTIES = VISUAL_STYLE_PROPERTY_DEFINITIONS.map(
  (definition) => definition.property,
) as VisualCssPropertyId[];

export function isVisualCssPropertyId(property: string): property is VisualCssPropertyId {
  return Object.prototype.hasOwnProperty.call(VISUAL_STYLE_PROPERTY_BY_ID, property);
}

export function getVisualStylePropertyDefinition(
  property: string,
): VisualStylePropertyDefinition | null {
  return isVisualCssPropertyId(property) ? VISUAL_STYLE_PROPERTY_BY_ID[property] : null;
}

export function getVisualStylePropertiesByCategory(
  category: VisualStyleCategory,
): VisualStylePropertyDefinition[] {
  return VISUAL_STYLE_PROPERTY_DEFINITIONS.filter((definition) => definition.category === category);
}

export function getVisualStylePropertiesByGroup(group: string): VisualStylePropertyDefinition[] {
  return VISUAL_STYLE_PROPERTY_DEFINITIONS.filter((definition) => definition.group === group);
}

export function getVisualStyleGroupDefinition(
  group: string,
): VisualStylePropertyGroupDefinition | null {
  return VISUAL_STYLE_PROPERTY_GROUPS.find((definition) => definition.id === group) ?? null;
}

export function createVisualStyleDeclaration(
  property: VisualCssPropertyId,
  value: string,
  previousValue?: string | null,
  priority: '' | 'important' = '',
): VisualStyleDeclarationMutation {
  return {
    property,
    value: normalizeVisualStyleValue(value),
    priority,
    previousValue,
  };
}

export function normalizeVisualStyleValue(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function cssNumberWithUnit(value: number | string, unit: VisualStyleUnit = 'px'): string {
  if (typeof value === 'string') {
    const normalized = normalizeVisualStyleValue(value);
    if (
      normalized === ''
      || normalized === '0'
      || /^-?\d*\.?\d+[a-z%]+$/i.test(normalized)
      || /^(auto|none|fit-content|max-content|min-content|inherit|initial|revert|unset)$/i.test(normalized)
      || /^(calc|min|max|clamp|var)\(/i.test(normalized)
    ) {
      return normalized;
    }

    return `${normalized}${unit}`;
  }

  return value === 0 ? '0' : `${value}${unit}`;
}
