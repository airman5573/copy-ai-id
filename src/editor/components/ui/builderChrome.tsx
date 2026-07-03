import type { ButtonHTMLAttributes, HTMLAttributes, PropsWithChildren } from 'react';

export function ToolbarButton({
  children,
  className = '',
  ...props
}: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>>) {
  return (
    <button className={`copy-ai-id-editor-toolbar-button ${className}`.trim()} type="button" {...props}>
      {children}
    </button>
  );
}

export function ToolbarSegment({ children }: PropsWithChildren) {
  return <div className="copy-ai-id-editor-toolbar-segment">{children}</div>;
}

interface PanelChromeProps extends HTMLAttributes<HTMLElement> {
  side: 'right';
  dataAiId: string;
  'data-ai-editor-note-panel-variant'?: string;
}

export function PanelChrome({
  children,
  className = '',
  side,
  dataAiId,
  ...props
}: PropsWithChildren<PanelChromeProps>) {
  const panelClassName = `copy-ai-id-editor-panel copy-ai-id-editor-panel--${side} ${className}`.trim();

  return (
    <aside
      className={panelClassName}
      data-ai-id={dataAiId}
      {...props}
    >
      {children}
    </aside>
  );
}
