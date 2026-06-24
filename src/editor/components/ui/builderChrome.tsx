import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';

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

export function PanelChrome({
  children,
  side,
  dataAiId,
}: PropsWithChildren<{ side: 'left' | 'right'; dataAiId: string }>) {
  return (
    <aside
      className={`copy-ai-id-editor-panel copy-ai-id-editor-panel--${side}`}
      data-ai-id={dataAiId}
    >
      {children}
    </aside>
  );
}
