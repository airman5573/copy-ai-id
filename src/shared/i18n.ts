import type { BreakpointId } from './breakpoints';

export type CopyAiIdLocale = 'en' | 'ko';

export interface CopyAiIdMessages {
  htmlLang: string;
  /**
   * Localized breakpoint labels for UI display. The stable technical labels
   * used in copied/exported text live in shared/breakpoints.ts `label`.
   */
  breakpoints: Record<BreakpointId, string>;
  popup: {
    shortcutHintHtml: string;
    turnOn: string;
    turnOff: string;
    unavailable: string;
    fileAccessHintHtml: string;
  };
  editor: {
    title: string;
    subtitle: string;
    notePanelToggle: string;
    notePanelOpenTitle: string;
    notePanelCloseTitle: string;
    preview: string;
    close: string;
    duplicateWarning: string;
    iframeLoading: string;
    iframeBlocked: string;
    copySuccess: string;
    copyFailed: string;
    missingDataAiId: string;
    fallbackTarget: string;
    fallbackSelectorType: string;
    staleFallbackTarget: string;
    staleVisualTarget: string;
    ambiguousVisualTarget: string;
    deletedVisualTarget: string;
    zoomFit: string;
    zoomIn: string;
    zoomOut: string;
    zoomReset: string;
    customViewport: string;
    resizePreviewWidth: string;
  };
  notebook: {
    title: string;
    placeholder: string;
    targetLabel: string;
    save: string;
    reset: string;
    empty: string;
    copyFailed: string;
    copyShortcutLabel: string;
    expand: string;
    collapse: string;
    tailwind: string;
    tailwindSuffix: string;
    noticeButton: string;
    noticeDialogTitle: string;
    noticeDescription: string;
    noticePlaceholder: string;
    noticeCancel: string;
    noticeSave: string;
    defaultTargetNotice: string;
    fallbackTargetNotice: string;
    visualEditNotice: string;
    unitConversionSuffix: string;
    breakpointScope: {
      label: string;
      all: string;
      desktop: string;
      tablet: string;
      mobile: string;
    };
    breakpointScopeSuffix: {
      desktop: string;
      tablet: string;
      mobile: string;
      selectedOnlySuffix: string;
    };
  };
  codex: {
    send: string;
    sendTitle: string;
    resolving: string;
    running: string;
    confirmTitle: string;
    confirmMethodLocalhostPort: string;
    confirmMethodFilePath: string;
    confirmRun: string;
    confirmCancel: string;
    successCommitted: string;
    successNoChanges: string;
    failed: string;
    timedOut: string;
    busy: string;
    serverUnreachable: string;
    resolveFailed: string;
    unsupportedPage: string;
    fallbackCopied: string;
  };
  // The quick toolbar and 모든 옵션 panel are Korean-only by product decision;
  // their labels are hardcoded in the components, so only the shared state
  // notices remain localized here.
  visualEditor: {
    panel: {
      // Single-line state notices (title only).
      state: {
        empty: string;
        loading: string;
        ready: string;
        error: string;
        stale: string;
        deleted: string;
        waiting: string;
      };
    };
  };
}

export const COPY_AI_ID_MESSAGES: Record<CopyAiIdLocale, CopyAiIdMessages> = {
  en: {
    htmlLang: 'en',
    breakpoints: {
      base: 'Base',
      mobile: 'Mobile',
      tablet: 'Tablet',
      desktop: 'Desktop',
      desktop1280: '1280',
      desktop1440: '1440',
      desktop1536: '1536',
      desktop1920: '1920',
    },
    popup: {
      shortcutHintHtml:
        '<span><strong>Shift + Z + Space</strong>: ON/OFF</span><span><strong>Space</strong>: Note</span><span><strong>Shift + Enter</strong>: Copy</span><span><strong>Arrows</strong>: DOM traversal</span><a class="popup__guide-link" data-ai-id="popup-data-ai-id-github-link" href="https://github.com/airman5573/copy-ai-id/blob/main/docs/add-data-ai-id.md" target="_blank" rel="noreferrer">Detailed manual</a>',
      turnOn: 'Turn ON',
      turnOff: 'Turn OFF',
      unavailable: 'Unavailable',
      fileAccessHintHtml:
        '<strong>file://</strong> needs <strong>Allow access to file URLs</strong>.',
    },
    editor: {
      title: 'Copy AI ID',
      subtitle: 'data-ai-id editor',
      notePanelToggle: 'Note',
      notePanelOpenTitle: 'Open the floating note panel.',
      notePanelCloseTitle: 'Close the floating note panel.',
      preview: 'Preview',
      close: 'Close editor',
      duplicateWarning: 'Duplicate data-ai-id',
      iframeLoading: 'Loading preview…',
      iframeBlocked: 'This page blocked iframe preview.',
      copySuccess: 'Copied',
      copyFailed: 'Copy failed',
      missingDataAiId: "The element doesn't have data-ai-id.",
      fallbackTarget: 'Fallback target',
      fallbackSelectorType: 'Selector type/reliability',
      staleFallbackTarget:
        'This fallback target is stale. Move the cursor over the element again and retry.',
      staleVisualTarget:
        'The selected visual target is no longer resolvable. Hover the element again and reopen visual editing.',
      ambiguousVisualTarget:
        'The selected visual target now matches multiple elements. Hover the exact element again and reopen visual editing.',
      deletedVisualTarget:
        'The selected element was deleted. Hover another element to continue visual editing.',
      zoomFit: 'Fit',
      zoomIn: 'Zoom in',
      zoomOut: 'Zoom out',
      zoomReset: 'Reset zoom',
      customViewport: 'Custom',
      resizePreviewWidth: 'Resize preview width',
    },
    notebook: {
      title: 'Notebook',
      placeholder: 'Write a comment for this element...',
      targetLabel: 'data-ai-id',
      save: 'Copy',
      reset: 'Reset',
      empty: 'Empty',
      copyFailed: 'Copy failed',
      copyShortcutLabel: 'Shortcut',
      expand: 'Expand notebook',
      collapse: 'Collapse notebook',
      tailwind: 'Tailwind',
      tailwindSuffix: 'works with tailwind only',
      noticeButton: 'Copy notice',
      noticeDialogTitle: 'Copy notice',
      noticeDescription:
        'Shown under Rules only when the copied note includes at least one data-ai-id target.',
      noticePlaceholder: 'Leave empty to omit the data-ai-id notice.',
      noticeCancel: 'Cancel',
      noticeSave: 'Save',
      defaultTargetNotice: `[NOTICE]
1. Do not modify the data-ai-id attribute itself.
2. Modify the element with the referenced data-ai-id.`,
      fallbackTargetNotice:
        '[NOTICE] Real data-ai-id references are stable. If a fallback target lacks data-ai-id, prefer adding a stable data-ai-id in source first; otherwise re-identify it by selector/context before editing.',
      visualEditNotice: `[VISUAL EDIT NOTICE]
1. Visual edits are preview-derived implementation instructions; they are not source changes already saved in the project.
2. Apply each visual edit to the referenced target in the actual source markup, CSS, or component code.
3. Do not remove, rename, or overwrite existing data-ai-id attributes while applying visual edits.`,
      unitConversionSuffix:
        'Numeric changes are expressed as % intents relative to current values — apply them using the units already used in the source code (rem, px, %, …).',
      breakpointScope: {
        label: 'Edit scope',
        all: 'Base',
        desktop: 'Desktop',
        tablet: 'Tablet',
        mobile: 'Mobile',
      },
      breakpointScopeSuffix: {
        desktop: 'Desktop only',
        tablet: 'Tablet and up only',
        mobile: 'Mobile and up only',
        selectedOnlySuffix: ' only',
      },
    },
    codex: {
      send: 'Codex',
      sendTitle: 'Send the current note to the Codex CLI and apply it to the local project',
      resolving: 'Detecting…',
      running: 'Running…',
      confirmTitle: 'Run Codex in this project?',
      confirmMethodLocalhostPort: 'Detected from the dev server process serving this page.',
      confirmMethodFilePath: 'Detected from this file\'s path.',
      confirmRun: 'Run',
      confirmCancel: 'Cancel',
      successCommitted: 'Codex finished — committed {count} file(s).',
      successNoChanges: 'Codex finished — no file changes.',
      failed: 'Codex run failed.',
      timedOut: 'Codex run timed out.',
      busy: 'Codex is already running.',
      serverUnreachable: 'Codex server is not running. Start it with "npm run codex-server".',
      resolveFailed: 'Could not detect a local project for this page.',
      unsupportedPage: 'Codex send works only on localhost or file:// pages.',
      fallbackCopied: 'The prompt was copied to the clipboard instead.',
    },
    visualEditor: {
      panel: {
        state: {
          empty: 'Select an element',
          loading: 'Loading selected element…',
          ready: 'Ready',
          error: 'Could not load the selected element',
          stale: 'Reselect this element',
          deleted: 'Selected element was deleted',
          waiting: 'Waiting for the element snapshot',
        },
      },
    },
  },
  ko: {
    htmlLang: 'ko',
    breakpoints: {
      base: '기본',
      mobile: '모바일',
      tablet: '태블릿',
      desktop: '데스크톱',
      desktop1280: '1280',
      desktop1440: '1440',
      desktop1536: '1536',
      desktop1920: '1920',
    },
    popup: {
      shortcutHintHtml:
        '<span><strong>Shift + Z + Space</strong>: ON/OFF</span><span><strong>Space</strong>: 노트</span><span><strong>Shift + Enter</strong>: 복사</span><span><strong>방향키</strong>: DOM 이동</span><a class="popup__guide-link" data-ai-id="popup-data-ai-id-github-link" href="https://github.com/airman5573/copy-ai-id/blob/main/docs/add-data-ai-id.md" target="_blank" rel="noreferrer">상세 메뉴얼</a>',
      turnOn: '켜기',
      turnOff: '끄기',
      unavailable: '사용 불가',
      fileAccessHintHtml:
        '<strong>file://</strong> 사용 시 <strong>파일 URL에 대한 액세스 허용</strong> 필요.',
    },
    editor: {
      title: 'Copy AI ID',
      subtitle: 'data-ai-id 에디터',
      notePanelToggle: '노트',
      notePanelOpenTitle: '플로팅 노트 패널을 엽니다.',
      notePanelCloseTitle: '플로팅 노트 패널을 닫습니다.',
      preview: '미리보기',
      close: '에디터 닫기',
      duplicateWarning: '중복 data-ai-id',
      iframeLoading: '미리보기 로딩 중…',
      iframeBlocked: '이 페이지가 iframe 미리보기를 차단했습니다.',
      copySuccess: '복사됨',
      copyFailed: '복사 실패',
      missingDataAiId: '이 요소에는 data-ai-id가 없습니다.',
      fallbackTarget: '대체 target',
      fallbackSelectorType: 'Selector 종류/신뢰도',
      staleFallbackTarget:
        '이 fallback target은 오래되었습니다. 요소 위에 다시 커서를 올린 뒤 재시도하세요.',
      staleVisualTarget:
        '선택한 visual target을 더 이상 정확히 찾을 수 없습니다. 요소를 다시 hover한 뒤 visual editing을 다시 여세요.',
      ambiguousVisualTarget:
        '선택한 visual target이 여러 요소와 겹칩니다. 정확한 요소를 다시 hover한 뒤 visual editing을 다시 여세요.',
      deletedVisualTarget:
        '선택한 요소가 삭제되었습니다. 다른 요소를 hover해서 visual editing을 계속하세요.',
      zoomFit: '맞춤',
      zoomIn: '확대',
      zoomOut: '축소',
      zoomReset: '확대 초기화',
      customViewport: '사용자 지정',
      resizePreviewWidth: '미리보기 너비 조절',
    },
    notebook: {
      title: '노트북',
      placeholder: '이 요소에 남길 코멘트를 작성하세요...',
      targetLabel: 'data-ai-id',
      save: '복사',
      reset: '초기화',
      empty: '비어 있음',
      copyFailed: '복사 실패',
      copyShortcutLabel: '단축키',
      expand: '노트북 펼치기',
      collapse: '노트북 접기',
      tailwind: '테일윈드',
      tailwindSuffix: 'tailwind에서만 동작합니다',
      noticeButton: '복사 Notice',
      noticeDialogTitle: '복사 Notice',
      noticeDescription:
        '복사한 노트에 data-ai-id target이 하나 이상 있을 때만 Rules에 붙습니다.',
      noticePlaceholder: '비우면 data-ai-id notice를 붙이지 않습니다.',
      noticeCancel: '취소',
      noticeSave: '저장',
      defaultTargetNotice: `[NOTICE]
1. data-ai-id attribute 자체를 수정하지 말 것
2. 해당 data-ai-id를 가진 element를 수정할 것`,
      fallbackTargetNotice:
        '[NOTICE] 실제 data-ai-id reference는 안정적입니다. fallback target에 data-ai-id가 없으면 source에 안정적인 data-ai-id를 먼저 추가하는 것을 우선하고, 불가할 때만 selector/context로 재식별하세요.',
      visualEditNotice: `[VISUAL EDIT NOTICE]
1. visual edit은 preview에서 만든 구현 지시이며, 프로젝트 source에 이미 저장된 변경이 아닙니다.
2. 각 visual edit을 실제 source markup, CSS, component code의 참조 target에 적용하세요.
3. visual edit을 적용할 때 기존 data-ai-id attribute를 제거하거나 이름을 바꾸거나 덮어쓰지 마세요.`,
      unitConversionSuffix:
        '수치 변경은 현재 값 대비 % 의도로 표현되어 있습니다 — 소스 코드에서 이미 사용 중인 단위(rem, px, % 등)로 환산해 적용하세요.',
      breakpointScope: {
        label: '수정 범위',
        all: '기본',
        desktop: '데스크톱',
        tablet: '태블릿',
        mobile: '모바일',
      },
      breakpointScopeSuffix: {
        desktop: '데스크톱에서만',
        tablet: '태블릿 이상에서만',
        mobile: '모바일 이상에서만',
        selectedOnlySuffix: '에서만',
      },
    },
    codex: {
      send: 'Codex',
      sendTitle: '현재 노트를 Codex CLI로 보내 로컬 프로젝트에 적용합니다',
      resolving: '감지 중…',
      running: '실행 중…',
      confirmTitle: '이 프로젝트에서 Codex를 실행할까요?',
      confirmMethodLocalhostPort: '이 페이지를 서빙하는 개발 서버 프로세스에서 감지했습니다.',
      confirmMethodFilePath: '이 파일의 경로에서 감지했습니다.',
      confirmRun: '실행',
      confirmCancel: '취소',
      successCommitted: 'Codex 완료 — 파일 {count}개를 커밋했습니다.',
      successNoChanges: 'Codex 완료 — 변경된 파일이 없습니다.',
      failed: 'Codex 실행이 실패했습니다.',
      timedOut: 'Codex 실행이 시간 초과되었습니다.',
      busy: '이미 Codex가 실행 중입니다.',
      serverUnreachable: 'Codex 서버가 실행 중이 아닙니다. "npm run codex-server"로 실행하세요.',
      resolveFailed: '이 페이지의 로컬 프로젝트를 찾지 못했습니다.',
      unsupportedPage: 'Codex 전송은 localhost 또는 file:// 페이지에서만 동작합니다.',
      fallbackCopied: '프롬프트를 클립보드에 복사해 두었습니다.',
    },
    visualEditor: {
      panel: {
        state: {
          empty: '요소를 선택하세요',
          loading: '선택 요소 정보를 불러오는 중…',
          ready: '준비됨',
          error: '선택 요소 정보를 불러오지 못했습니다',
          stale: '요소를 다시 선택해 주세요',
          deleted: '선택 요소가 삭제되었습니다',
          waiting: '요소 스냅샷을 기다리는 중',
        },
      },
    },
  },
};

function resolveSupportedLocale(languageTag: string): CopyAiIdLocale | null {
  const normalizedLanguageTag = languageTag.trim().toLowerCase();
  const primaryLanguage = normalizedLanguageTag.split(/[-_]/)[0];

  if (primaryLanguage === 'ko') {
    return 'ko';
  }

  if (primaryLanguage === 'en') {
    return 'en';
  }

  return null;
}

export function resolveCopyAiIdLocale(languageTags: readonly string[]): CopyAiIdLocale {
  for (const languageTag of languageTags) {
    const locale = resolveSupportedLocale(languageTag);

    if (locale) {
      return locale;
    }
  }

  return 'en';
}

function getChromeUiLanguage(): string | null {
  try {
    if (typeof chrome === 'undefined' || typeof chrome.i18n?.getUILanguage !== 'function') {
      return null;
    }

    return chrome.i18n.getUILanguage();
  } catch {
    // Chrome throws "Extension context invalidated" from extension APIs when an
    // unpacked extension is reloaded while an old content-script instance still
    // exists in the page. Locale detection should fall back to navigator
    // language instead of breaking editor render/debug diagnostics.
    return null;
  }
}

function getNavigatorLanguageTags(): string[] {
  if (typeof navigator === 'undefined') {
    return [];
  }

  if (Array.isArray(navigator.languages) && navigator.languages.length > 0) {
    return [...navigator.languages];
  }

  return typeof navigator.language === 'string' ? [navigator.language] : [];
}

export function getBrowserLanguageTags(): string[] {
  return [
    getChromeUiLanguage(),
    ...getNavigatorLanguageTags(),
  ].filter((languageTag): languageTag is string => Boolean(languageTag));
}

export function getCurrentLocale(): CopyAiIdLocale {
  return resolveCopyAiIdLocale(getBrowserLanguageTags());
}

export function getCurrentMessages(): CopyAiIdMessages {
  return COPY_AI_ID_MESSAGES[getCurrentLocale()];
}
