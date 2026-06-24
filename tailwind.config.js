/** @type {import('tailwindcss').Config} */
export default {
  // Keep Tailwind scoped to the editor Shadow DOM. The inspected page should
  // never receive these styles; editorCss is injected under data-ai-editor-ui.
  content: ['./src/**/*.tsx'],
  important: '[data-ai-editor-ui]',
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        editor: {
          bg: '#030712',
          canvas: '#0f1117',
          shell: '#0b1120',
          surface: '#111827',
          panel: '#111827',
          raised: '#1f2937',
          border: '#374151',
          'border-muted': '#1f2937',
          primary: '#3b82f6',
          'primary-hover': '#2563eb',
          accent: '#8b5cf6',
          muted: '#9ca3af',
          subtle: '#6b7280',
          success: '#10b981',
          warning: '#f59e0b',
          error: '#ef4444',
        },
      },
      boxShadow: {
        editor: 'none',
        'editor-panel': '0 18px 50px rgba(0, 0, 0, 0.32)',
        'editor-toolbar': '0 1px 0 rgba(255, 255, 255, 0.06), 0 16px 40px rgba(0, 0, 0, 0.24)',
        'editor-focus': '0 0 0 2px rgba(59, 130, 246, 0.5)',
      },
      fontFamily: {
        editor: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'editor-canvas-grid':
          'linear-gradient(rgba(148, 163, 184, 0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.07) 1px, transparent 1px)',
      },
      keyframes: {
        'editor-fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'editor-slide-up': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'editor-scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'editor-pulse-subtle': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.72' },
        },
      },
      animation: {
        'editor-fade-in': 'editor-fade-in 200ms ease-out',
        'editor-slide-up': 'editor-slide-up 250ms ease-out',
        'editor-scale-in': 'editor-scale-in 180ms ease-out',
        'editor-pulse-subtle': 'editor-pulse-subtle 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
