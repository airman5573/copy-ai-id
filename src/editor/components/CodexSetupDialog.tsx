import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  ExternalLink,
  LoaderCircle,
  RefreshCw,
  ServerOff,
  X,
} from 'lucide-react';

import { CODEX_SERVER_BASE_URL } from '../../shared/codex';
import { getCurrentLocale, getCurrentMessages } from '../../shared/i18n';
import { copyText } from '../notebook/clipboard';
import {
  refreshCodexSetup,
  type CodexSetupCheck,
  type CodexSetupStatus,
  useCodexSetupStore,
} from '../stores/useCodexSetupStore';

const SETUP_RELEASE_TAG = `v${chrome.runtime.getManifest().version}`;
const SETUP_RELEASE_REF = encodeURIComponent(SETUP_RELEASE_TAG);
const SETUP_SKILL_URL = `https://github.com/airman5573/copy-ai-id/tree/${SETUP_RELEASE_REF}/skills/setup-copy-ai-id-codex`;
const SETUP_GUIDE_URLS = {
  en: `https://github.com/airman5573/copy-ai-id/blob/${SETUP_RELEASE_REF}/docs/codex-setup.md`,
  ko: `https://github.com/airman5573/copy-ai-id/blob/${SETUP_RELEASE_REF}/docs/codex-setup.ko.md`,
} as const;
const HEALTH_URL = `${CODEX_SERVER_BASE_URL}/health`;

const STATUS_CARD_CLASSES: Record<CodexSetupStatus, string> = {
  checking: 'border-amber-400/30 bg-amber-400/10 text-amber-100',
  ready: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100',
  busy: 'border-sky-400/30 bg-sky-400/10 text-sky-100',
  maintenance: 'border-sky-400/30 bg-sky-400/10 text-sky-100',
  unreachable: 'border-rose-400/30 bg-rose-400/10 text-rose-100',
  'not-ready': 'border-amber-400/30 bg-amber-400/10 text-amber-100',
};

type PromptCopyState = 'idle' | 'copied' | 'failed';

export function CodexSetupDialog() {
  const messages = getCurrentMessages().codex.setup;
  const locale = getCurrentLocale();
  const isOpen = useCodexSetupStore((state) => state.dialogOpen);
  const status = useCodexSetupStore((state) => state.status);
  const checks = useCodexSetupStore((state) => state.checks);
  const errorDetail = useCodexSetupStore((state) => state.errorDetail);
  const isRefreshing = useCodexSetupStore((state) => state.isRefreshing);
  const closeDialog = useCodexSetupStore((state) => state.closeDialog);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const [copyState, setCopyState] = useState<PromptCopyState>('idle');

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const rootNode = closeButtonRef.current?.getRootNode();
    const activeElement = rootNode instanceof ShadowRoot
      ? rootNode.activeElement
      : document.activeElement;
    restoreFocusRef.current = activeElement instanceof HTMLElement ? activeElement : null;
    setCopyState('idle');

    const focusFrame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(focusFrame);
      restoreFocusRef.current?.focus();
      restoreFocusRef.current = null;
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const statusText = getStatusText(status, messages.status);
  const statusDescription = getStatusText(status, messages.statusDescription);
  const failedChecks = checks.filter((check) => !check.ok);
  const bootstrapPrompt = messages.bootstrapPrompt
    .replaceAll('{releaseTag}', SETUP_RELEASE_TAG)
    .replace('{skillUrl}', SETUP_SKILL_URL)
    .replace('{healthUrl}', HEALTH_URL);
  const guideUrl = SETUP_GUIDE_URLS[locale];

  const handleCopyPrompt = async (): Promise<void> => {
    const result = await copyText(bootstrapPrompt);
    setCopyState(result.ok ? 'copied' : 'failed');
  };

  return (
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center bg-black/60 p-4"
      data-ai-id="copy-ai-id-editor-codex-setup-overlay"
      onClick={closeDialog}
    >
      <div
        id="copy-ai-id-codex-setup-dialog"
        className="flex max-h-[calc(100vh-32px)] w-[620px] max-w-[96vw] flex-col overflow-hidden rounded-2xl border border-blue-500/30 bg-[color:var(--ai-editor-chrome-bg,#111827)] text-gray-100 shadow-[0_24px_70px_rgba(0,0,0,0.58)] ring-1 ring-white/5"
        data-ai-id="copy-ai-id-editor-codex-setup-dialog"
        data-copy-ai-id-visual-focus-guard="true"
        role="dialog"
        aria-modal="true"
        aria-labelledby="copy-ai-id-codex-setup-title"
        aria-describedby="copy-ai-id-codex-setup-description"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => handleDialogKeyDown(event, closeDialog)}
      >
        <header
          className="flex items-start justify-between gap-4 border-b border-gray-700/80 px-5 py-4"
          data-ai-id="copy-ai-id-editor-codex-setup-header"
        >
          <div data-ai-id="copy-ai-id-editor-codex-setup-heading-group">
            <h2
              id="copy-ai-id-codex-setup-title"
              className="m-0 text-base font-bold text-gray-50"
              data-ai-id="copy-ai-id-editor-codex-setup-title"
            >
              {messages.title}
            </h2>
            <p
              id="copy-ai-id-codex-setup-description"
              className="mb-0 mt-1 text-xs leading-5 text-gray-400"
              data-ai-id="copy-ai-id-editor-codex-setup-description"
            >
              {messages.description}
            </p>
          </div>
          <button
            type="button"
            ref={closeButtonRef}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-700 bg-gray-900 text-gray-300 transition hover:border-gray-500 hover:bg-gray-800 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70"
            data-ai-id="copy-ai-id-editor-codex-setup-close-button"
            title={messages.close}
            aria-label={messages.close}
            onClick={closeDialog}
          >
            <X size={15} aria-hidden="true" />
          </button>
        </header>

        <div
          className="overflow-y-auto px-5 py-4"
          data-ai-id="copy-ai-id-editor-codex-setup-scroll-content"
        >
          <section
            className={`rounded-xl border p-3 ${STATUS_CARD_CLASSES[status]}`}
            data-ai-id="copy-ai-id-editor-codex-setup-status-card"
            data-codex-setup-status={status}
            role="status"
            aria-live="polite"
          >
            <div
              className="flex items-start gap-2.5"
              data-ai-id="copy-ai-id-editor-codex-setup-status-content"
            >
              <StatusIcon status={status} />
              <div data-ai-id="copy-ai-id-editor-codex-setup-status-text-group">
                <h3
                  className="m-0 text-sm font-semibold"
                  data-ai-id="copy-ai-id-editor-codex-setup-status-label"
                >
                  {statusText}
                </h3>
                <p
                  className="mb-0 mt-1 text-xs leading-5 opacity-80"
                  data-ai-id="copy-ai-id-editor-codex-setup-status-description"
                >
                  {statusDescription}
                </p>
              </div>
            </div>
          </section>

          {((status !== 'checking' && status !== 'maintenance') || failedChecks.length > 0) && (
            <section
              className="mt-4"
              data-ai-id="copy-ai-id-editor-codex-setup-issues-section"
              aria-labelledby="copy-ai-id-codex-setup-issues-title"
            >
              <h3
                id="copy-ai-id-codex-setup-issues-title"
                className="m-0 text-xs font-semibold uppercase tracking-wide text-gray-300"
                data-ai-id="copy-ai-id-editor-codex-setup-issues-title"
              >
                {messages.issuesTitle}
              </h3>
              {failedChecks.length > 0 ? (
                <ul
                  className="mb-0 mt-2 space-y-2 p-0"
                  data-ai-id="copy-ai-id-editor-codex-setup-issue-list"
                >
                  {failedChecks.map((check) => (
                    <SetupIssue key={`${check.id}:${check.issueCode ?? ''}`} check={check} />
                  ))}
                </ul>
              ) : (
                <p
                  className="mb-0 mt-2 rounded-lg border border-gray-700 bg-gray-950/45 px-3 py-2 text-xs leading-5 text-gray-400"
                  data-ai-id="copy-ai-id-editor-codex-setup-no-issues"
                >
                  {status === 'unreachable' && errorDetail
                    ? `${messages.technicalDetail}: ${errorDetail}`
                    : messages.noIssues}
                </p>
              )}
            </section>
          )}

          <section
            className="mt-5"
            data-ai-id="copy-ai-id-editor-codex-setup-instructions-section"
            aria-labelledby="copy-ai-id-codex-setup-instructions-title"
          >
            <div
              className="flex items-center justify-between gap-3"
              data-ai-id="copy-ai-id-editor-codex-setup-instructions-heading-row"
            >
              <h3
                id="copy-ai-id-codex-setup-instructions-title"
                className="m-0 text-sm font-semibold text-gray-100"
                data-ai-id="copy-ai-id-editor-codex-setup-instructions-title"
              >
                {messages.instructionsTitle}
              </h3>
              <span
                className="rounded-full border border-gray-700 bg-gray-900 px-2 py-0.5 text-[10px] font-semibold text-gray-400"
                data-ai-id="copy-ai-id-editor-codex-setup-macos-only-badge"
              >
                {messages.macOnly}
              </span>
            </div>
            <ol
              className="mb-0 mt-2 space-y-1.5 pl-5 text-xs leading-5 text-gray-300"
              data-ai-id="copy-ai-id-editor-codex-setup-instructions-list"
            >
              <li data-ai-id="copy-ai-id-editor-codex-setup-instruction-prerequisites">
                {messages.instructionPrerequisites}
              </li>
              <li data-ai-id="copy-ai-id-editor-codex-setup-instruction-bootstrap">
                {messages.instructionBootstrap}
              </li>
              <li data-ai-id="copy-ai-id-editor-codex-setup-instruction-retry">
                {messages.instructionRetry}
              </li>
            </ol>
          </section>

          <section
            className="mt-4 rounded-xl border border-gray-700 bg-gray-950/55 p-3"
            data-ai-id="copy-ai-id-editor-codex-setup-bootstrap-section"
            aria-labelledby="copy-ai-id-codex-setup-bootstrap-title"
          >
            <h3
              id="copy-ai-id-codex-setup-bootstrap-title"
              className="m-0 text-xs font-semibold text-gray-200"
              data-ai-id="copy-ai-id-editor-codex-setup-bootstrap-title"
            >
              {messages.bootstrapTitle}
            </h3>
            <p
              className="mb-0 mt-1 text-[11px] leading-4 text-gray-500"
              data-ai-id="copy-ai-id-editor-codex-setup-bootstrap-description"
            >
              {messages.bootstrapDescription}
            </p>
            <textarea
              className="mt-2 block h-28 w-full resize-y rounded-lg border border-gray-700 bg-black/40 px-3 py-2 font-mono text-[11px] leading-4 text-gray-200 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              data-ai-id="copy-ai-id-editor-codex-setup-bootstrap-prompt"
              readOnly
              spellCheck={false}
              value={bootstrapPrompt}
              aria-label={messages.bootstrapTitle}
            />
            <div
              className="mt-2 flex flex-wrap items-center justify-between gap-2"
              data-ai-id="copy-ai-id-editor-codex-setup-bootstrap-actions"
            >
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/70 bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:border-blue-400 hover:bg-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70"
                data-ai-id="copy-ai-id-editor-codex-setup-copy-prompt-button"
                onClick={() => {
                  void handleCopyPrompt();
                }}
              >
                <Clipboard size={13} aria-hidden="true" />
                {copyState === 'copied'
                  ? messages.promptCopied
                  : copyState === 'failed'
                    ? messages.promptCopyFailed
                    : messages.copyPrompt}
              </button>
              <a
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-300 underline decoration-blue-400/40 underline-offset-2 hover:text-blue-200"
                data-ai-id="copy-ai-id-editor-codex-setup-skill-link"
                href={SETUP_SKILL_URL}
                target="_blank"
                rel="noreferrer"
              >
                {messages.openSkill}
                <ExternalLink size={12} aria-hidden="true" />
              </a>
            </div>
          </section>
        </div>

        <footer
          className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-700/80 px-5 py-3"
          data-ai-id="copy-ai-id-editor-codex-setup-footer"
        >
          <a
            className="inline-flex items-center gap-1 text-xs font-medium text-gray-300 underline decoration-gray-500 underline-offset-2 hover:text-white"
            data-ai-id="copy-ai-id-editor-codex-setup-guide-link"
            href={guideUrl}
            target="_blank"
            rel="noreferrer"
          >
            {messages.openGuide}
            <ExternalLink size={12} aria-hidden="true" />
          </a>
          <div
            className="flex items-center gap-2"
            data-ai-id="copy-ai-id-editor-codex-setup-footer-actions"
          >
            <button
              type="button"
              className="rounded-lg border border-gray-600 bg-gray-900 px-3 py-1.5 text-xs text-gray-200 transition hover:border-gray-500 hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70"
              data-ai-id="copy-ai-id-editor-codex-setup-footer-close-button"
              onClick={closeDialog}
            >
              {messages.close}
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500 bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:border-blue-400 hover:bg-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 disabled:cursor-wait disabled:opacity-60"
              data-ai-id="copy-ai-id-editor-codex-setup-retry-button"
              disabled={isRefreshing}
              onClick={() => {
                void refreshCodexSetup({ showChecking: true });
              }}
            >
              <RefreshCw
                size={13}
                className={isRefreshing ? 'animate-spin' : ''}
                aria-hidden="true"
              />
              {isRefreshing ? messages.retrying : messages.retry}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: CodexSetupStatus }) {
  const className = 'mt-0.5 h-4 w-4 shrink-0';
  if (status === 'ready') {
    return <CheckCircle2 className={className} data-ai-id="copy-ai-id-editor-codex-setup-ready-icon" aria-hidden="true" />;
  }
  if (status === 'checking' || status === 'maintenance') {
    return <LoaderCircle className={`${className} animate-spin`} data-ai-id="copy-ai-id-editor-codex-setup-checking-icon" aria-hidden="true" />;
  }
  if (status === 'unreachable') {
    return <ServerOff className={className} data-ai-id="copy-ai-id-editor-codex-setup-unreachable-icon" aria-hidden="true" />;
  }

  return <AlertTriangle className={className} data-ai-id="copy-ai-id-editor-codex-setup-attention-icon" aria-hidden="true" />;
}

function SetupIssue({ check }: { check: CodexSetupCheck }) {
  const messages = getCurrentMessages().codex.setup;
  const checkLabel = getCheckLabel(check.id, messages.checkLabels);
  const issueMessage = check.issueCode
    ? messages.issueMessages[check.issueCode] ?? messages.unknownIssue
    : messages.unknownIssue;
  const aiIdSegment = toAiIdSegment(check.id);

  return (
    <li
      className="list-none rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2"
      data-ai-id={`copy-ai-id-editor-codex-setup-issue-${aiIdSegment}`}
    >
      <div
        className="flex items-start gap-2"
        data-ai-id={`copy-ai-id-editor-codex-setup-issue-${aiIdSegment}-content`}
      >
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" aria-hidden="true" />
        <div data-ai-id={`copy-ai-id-editor-codex-setup-issue-${aiIdSegment}-text-group`}>
          <strong
            className="block text-xs font-semibold text-amber-100"
            data-ai-id={`copy-ai-id-editor-codex-setup-issue-${aiIdSegment}-label`}
          >
            {checkLabel}
          </strong>
          <p
            className="mb-0 mt-0.5 text-xs leading-5 text-gray-300"
            data-ai-id={`copy-ai-id-editor-codex-setup-issue-${aiIdSegment}-remediation`}
          >
            {issueMessage}
          </p>
          {check.detail ? (
            <p
              className="mb-0 mt-0.5 break-words font-mono text-[10px] leading-4 text-gray-500"
              data-ai-id={`copy-ai-id-editor-codex-setup-issue-${aiIdSegment}-detail`}
            >
              {check.detail}
            </p>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function getStatusText<T extends {
  checking: string;
  ready: string;
  busy: string;
  maintenance: string;
  unreachable: string;
  notReady: string;
}>(status: CodexSetupStatus, messages: T): string {
  return status === 'not-ready' ? messages.notReady : messages[status];
}

function getCheckLabel(
  id: string,
  labels: {
    protocol: string;
    platform: string;
    node: string;
    codex: string;
    codexExec: string;
    codexLogin: string;
    git: string;
    lsof: string;
    unknown: string;
  },
): string {
  switch (id) {
    case 'protocol':
      return labels.protocol;
    case 'platform':
      return labels.platform;
    case 'node':
      return labels.node;
    case 'codex':
      return labels.codex;
    case 'codex-exec':
      return labels.codexExec;
    case 'codex-login':
      return labels.codexLogin;
    case 'git':
      return labels.git;
    case 'lsof':
      return labels.lsof;
    default:
      return labels.unknown;
  }
}

function handleDialogKeyDown(
  event: ReactKeyboardEvent<HTMLDivElement>,
  closeDialog: () => void,
): void {
  if (event.key === 'Escape' && !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey) {
    event.preventDefault();
    event.stopPropagation();
    closeDialog();
    return;
  }

  if (event.key !== 'Tab') {
    return;
  }

  const focusableElements = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )).filter((element) => element.getAttribute('aria-hidden') !== 'true');
  if (focusableElements.length === 0) {
    event.preventDefault();
    return;
  }

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  const activeElement = event.currentTarget.getRootNode() instanceof ShadowRoot
    ? (event.currentTarget.getRootNode() as ShadowRoot).activeElement
    : document.activeElement;

  if (event.shiftKey && activeElement === firstElement) {
    event.preventDefault();
    lastElement.focus();
  } else if (!event.shiftKey && activeElement === lastElement) {
    event.preventDefault();
    firstElement.focus();
  }
}

function toAiIdSegment(value: string): string {
  const segment = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return segment || 'unknown';
}
