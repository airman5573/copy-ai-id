import { CircleHelp } from 'lucide-react';

import { getCurrentMessages } from '../../shared/i18n';
import {
  type CodexSetupStatus,
  useCodexSetupStore,
} from '../stores/useCodexSetupStore';
import { ToolbarButton } from './ui/builderChrome';

const STATUS_DOT_CLASSES: Record<CodexSetupStatus, string> = {
  checking: 'bg-amber-400',
  ready: 'bg-emerald-400',
  busy: 'bg-sky-400',
  maintenance: 'bg-sky-400',
  unreachable: 'bg-rose-400',
  'not-ready': 'bg-amber-400',
};

export interface CodexSetupButtonProps {
  placement: 'toolbar' | 'note-panel';
  className?: string;
}

export function CodexSetupButton({
  placement,
  className = '',
}: CodexSetupButtonProps) {
  const messages = getCurrentMessages().codex.setup;
  const status = useCodexSetupStore((state) => state.status);
  const dialogOpen = useCodexSetupStore((state) => state.dialogOpen);
  const openDialog = useCodexSetupStore((state) => state.openDialog);
  const label = placement === 'toolbar' ? messages.action : messages.helpAction;
  const statusLabel = getStatusLabel(status, messages.status);

  return (
    <ToolbarButton
      className={`copy-ai-id-editor-codex-setup-button ${className}`.trim()}
      data-ai-id={`copy-ai-id-editor-${placement}-codex-setup-button`}
      title={`${label} — ${statusLabel}`}
      aria-label={`${label}: ${statusLabel}`}
      aria-haspopup="dialog"
      aria-expanded={dialogOpen}
      aria-controls="copy-ai-id-codex-setup-dialog"
      onClick={openDialog}
    >
      <CircleHelp size={14} aria-hidden="true" />
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT_CLASSES[status]}`}
        data-ai-id={`copy-ai-id-editor-${placement}-codex-setup-status-indicator`}
        aria-hidden="true"
      />
      <span data-ai-id={`copy-ai-id-editor-${placement}-codex-setup-label`}>
        {label}
      </span>
    </ToolbarButton>
  );
}

function getStatusLabel(
  status: CodexSetupStatus,
  labels: {
    checking: string;
    ready: string;
    busy: string;
    maintenance: string;
    unreachable: string;
    notReady: string;
  },
): string {
  return status === 'not-ready' ? labels.notReady : labels[status];
}
