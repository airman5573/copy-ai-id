import type { BreakpointId } from './breakpoints';
import type { QuickActionCategory } from './domain/visual';

export type CopyAiIdLocale = 'en' | 'ko';

type VisualStructureQuickAction = 'duplicate' | 'move-up' | 'move-down' | 'delete';

interface VisualCategoryMessages {
  label: string;
  description: string;
  placeholder: string;
}

interface VisualPanelStateMessage {
  title: string;
  message: string;
}

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
    notePanel: string;
    notePanelFloatingToggle: string;
    notePanelFloatingEnableTitle: string;
    notePanelFloatingDisableTitle: string;
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
    resizePreviewHeight: string;
    resizePreviewWidth: string;
    resizeNotePanel: string;
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
    fontSize: string;
    fontSizeDecrease: string;
    fontSizeReset: string;
    fontSizeIncrease: string;
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
  visualEditor: {
    categories: Record<QuickActionCategory, VisualCategoryMessages>;
    quickActions: {
      toolbarLabel: string;
      dragMoveTitle: string;
      structure: Record<VisualStructureQuickAction, {
        label: string;
        title: string;
      }>;
    };
    panel: {
      editPanelLabelSuffix: string;
      categoriesLabel: string;
      close: string;
      readyStatus: string;
      waitingStatus: string;
      controlsWaitingPlaceholder: string;
      reasonLabel: string;
      codeLabel: string;
      selectedElementFallback: string;
      hiddenPromptLabel: string;
      pendingLabel: string;
      failedLabel: string;
      latestCodeLabel: string;
      countSuffix: string;
      copyOnlySuffix: string;
      state: {
        empty: VisualPanelStateMessage;
        loading: VisualPanelStateMessage;
        ready: VisualPanelStateMessage;
        error: VisualPanelStateMessage;
        stale: VisualPanelStateMessage;
        deleted: VisualPanelStateMessage;
        waiting: VisualPanelStateMessage;
      };
    };
    staleReasons: Record<string, string>;
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
      notePanel: 'Note panel',
      notePanelFloatingToggle: 'Floating note',
      notePanelFloatingEnableTitle: 'Open the Note panel near hovered or selected elements.',
      notePanelFloatingDisableTitle: 'Use the docked right Note panel instead.',
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
      resizePreviewHeight: 'Resize preview height',
      resizePreviewWidth: 'Resize preview width',
      resizeNotePanel: 'Resize note panel',
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
      fontSize: 'Note font size',
      fontSizeDecrease: 'Decrease note font size',
      fontSizeReset: 'Reset note font size',
      fontSizeIncrease: 'Increase note font size',
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
    visualEditor: {
      categories: {
        content: {
          label: 'Content',
          description: 'Adjust text, links, attributes, and HTML next to the selected element.',
          placeholder: 'Text and HTML editing controls appear in this section.',
        },
        layout: {
          label: 'Layout',
          description: 'Apply display, flex/grid, and alignment values to the selected element.',
          placeholder: 'Display, flex, grid, and alignment controls appear in this section.',
        },
        spacing: {
          label: 'Spacing',
          description: 'Adjust padding, margin, and gap values near the canvas.',
          placeholder: 'Padding, margin, row gap, and column gap controls appear in this section.',
        },
        size: {
          label: 'Size',
          description: 'Edit width, height, min/max sizes, and object sizing directly.',
          placeholder: 'Width, height, min/max, and object-fit controls appear in this section.',
        },
        style: {
          label: 'Style',
          description: 'Adjust typography, colors, backgrounds, opacity, and shadows.',
          placeholder: 'Typography, color, background, opacity, and shadow controls appear in this section.',
        },
        border: {
          label: 'Border',
          description: 'Apply border, radius, and outline values to the selected element.',
          placeholder: 'Border width/style/color, radius, and outline controls appear in this section.',
        },
      },
      quickActions: {
        toolbarLabel: 'Visual editor quick actions',
        dragMoveTitle: 'Drag to move',
        structure: {
          duplicate: { label: 'Duplicate', title: 'Duplicate' },
          'move-up': { label: '↑', title: 'Move before the previous sibling' },
          'move-down': { label: '↓', title: 'Move after the next sibling' },
          delete: { label: 'Delete', title: 'Delete' },
        },
      },
      panel: {
        editPanelLabelSuffix: 'editing panel',
        categoriesLabel: 'Visual editing categories',
        close: 'Close panel',
        readyStatus: 'Ready',
        waitingStatus: 'Waiting',
        controlsWaitingPlaceholder: 'Controls become available after the selected element snapshot is ready.',
        reasonLabel: 'Reason',
        codeLabel: 'code',
        selectedElementFallback: 'Selected element',
        hiddenPromptLabel: 'Hidden visual edit prompts',
        pendingLabel: 'Applying visual edits',
        failedLabel: 'Failed visual edits',
        latestCodeLabel: 'latest code',
        countSuffix: '',
        copyOnlySuffix: 'Included only when copied.',
        state: {
          empty: {
            title: 'Select an element',
            message: 'Hover an element on the canvas, then click a quick-action button to open visual editing controls.',
          },
          loading: {
            title: 'Loading selected element details',
            message: 'Reading DOM, style, and attribute details from the preview iframe.',
          },
          ready: {
            title: 'Selected element is ready',
            message: 'Visual editing controls can be applied to this element.',
          },
          error: {
            title: 'Could not load selected element details',
            message: 'Error prompt details are hidden. Hover the same element again or retry the quick action.',
          },
          stale: {
            title: 'Reselect this element',
            message: 'The preview DOM changed and the selected element can no longer be resolved exactly. Hover it again and retry the quick action.',
          },
          deleted: {
            title: 'Selected element was deleted',
            message: 'The selected element was deleted from the preview DOM. Hover another element to continue visual editing.',
          },
          waiting: {
            title: 'Selected element details are not ready yet',
            message: 'The element is selected, but no snapshot is available yet. Click the quick action again or hover the element again.',
          },
        },
      },
      staleReasons: {
        'bridge-reset': 'preview reconnected',
        cleared: 'selection cleared',
        disconnected: 'DOM disconnected',
        hidden: 'hidden',
        'protected-target': 'protected target',
        'stale-target': 'stale target',
        'snapshot-error': 'snapshot error',
        'mutation-error': 'mutation error',
        deleted: 'deleted',
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
      notePanel: '노트 패널',
      notePanelFloatingToggle: '노트 플로팅',
      notePanelFloatingEnableTitle: '노트 패널을 hover 또는 선택한 요소 근처에 띄웁니다.',
      notePanelFloatingDisableTitle: '오른쪽 고정 노트 패널을 사용합니다.',
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
      resizePreviewHeight: '미리보기 높이 조절',
      resizePreviewWidth: '미리보기 너비 조절',
      resizeNotePanel: '노트 패널 너비 조절',
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
      fontSize: '노트 글자 크기',
      fontSizeDecrease: '노트 글자 크기 줄이기',
      fontSizeReset: '노트 글자 크기 초기화',
      fontSizeIncrease: '노트 글자 크기 키우기',
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
    visualEditor: {
      categories: {
        content: {
          label: '콘텐츠',
          description: '텍스트, 링크, 속성, HTML을 선택 요소 바로 옆에서 조정합니다.',
          placeholder: '텍스트와 HTML 편집 컨트롤이 이 섹션에 표시됩니다.',
        },
        layout: {
          label: '레이아웃',
          description: 'display, flex/grid, 정렬 값을 현재 선택 요소에 적용합니다.',
          placeholder: 'display, flex, grid, 정렬 컨트롤이 이 섹션에 표시됩니다.',
        },
        spacing: {
          label: '간격',
          description: 'padding, margin, gap 값을 캔버스 근처에서 조정합니다.',
          placeholder: 'padding, margin, row/column gap 컨트롤이 이 섹션에 표시됩니다.',
        },
        size: {
          label: '크기',
          description: 'width, height, min/max 크기 값을 바로 수정합니다.',
          placeholder: 'width, height, min/max, object-fit 컨트롤이 이 섹션에 표시됩니다.',
        },
        style: {
          label: '스타일',
          description: '텍스트 스타일, 색상, 배경, 불투명도, 그림자를 조정합니다.',
          placeholder: 'typography, color, background, opacity, shadow 컨트롤이 이 섹션에 표시됩니다.',
        },
        border: {
          label: '선',
          description: 'border, radius, outline 계열 값을 선택 요소에 적용합니다.',
          placeholder: 'border width/style/color, radius, outline 컨트롤이 이 섹션에 표시됩니다.',
        },
      },
      quickActions: {
        toolbarLabel: '비주얼 편집 quick-action',
        dragMoveTitle: '드래그해서 이동',
        structure: {
          duplicate: { label: '복제', title: '복제' },
          'move-up': { label: '↑', title: '이전 형제 앞으로 이동' },
          'move-down': { label: '↓', title: '다음 형제 뒤로 이동' },
          delete: { label: '삭제', title: '삭제' },
        },
      },
      panel: {
        editPanelLabelSuffix: '편집 패널',
        categoriesLabel: '비주얼 편집 카테고리',
        close: '패널 닫기',
        readyStatus: '준비됨',
        waitingStatus: '대기 중',
        controlsWaitingPlaceholder: '선택 요소 snapshot이 준비되면 이 섹션의 컨트롤을 사용할 수 있습니다.',
        reasonLabel: '사유',
        codeLabel: 'code',
        selectedElementFallback: '선택 요소',
        hiddenPromptLabel: '숨겨진 visual edit 프롬프트',
        pendingLabel: '적용 중인 visual edit',
        failedLabel: '실패한 visual edit',
        latestCodeLabel: 'latest code',
        countSuffix: '개',
        copyOnlySuffix: '복사할 때만 포함됩니다.',
        state: {
          empty: {
            title: '요소를 선택하세요',
            message: '캔버스에서 요소를 hover한 뒤 quick-action 버튼을 누르면 visual editing 컨트롤이 여기에 표시됩니다.',
          },
          loading: {
            title: '선택 요소 정보를 불러오는 중입니다',
            message: 'preview iframe에서 현재 요소의 DOM, 스타일, 속성 정보를 읽고 있습니다.',
          },
          ready: {
            title: '선택 요소 준비 완료',
            message: '이 요소에 visual editing 컨트롤을 적용할 수 있습니다.',
          },
          error: {
            title: '선택 요소 정보를 불러오지 못했습니다',
            message: '오류 세부 prompt는 화면에 표시하지 않습니다. 같은 요소를 다시 hover하거나 quick-action을 다시 눌러 주세요.',
          },
          stale: {
            title: '선택 요소를 다시 찾아야 합니다',
            message: 'preview DOM 변경으로 선택 요소를 더 이상 정확히 찾을 수 없습니다. 같은 요소를 다시 hover한 뒤 quick-action을 다시 눌러 주세요.',
          },
          deleted: {
            title: '선택 요소가 삭제되었습니다',
            message: '선택한 요소가 preview DOM에서 삭제되었습니다. 다른 요소를 다시 hover하거나 선택해서 visual editing을 계속해 주세요.',
          },
          waiting: {
            title: '선택 요소 정보가 아직 준비되지 않았습니다',
            message: '요소는 선택되었지만 snapshot이 아직 없습니다. quick-action을 다시 누르거나 요소를 다시 hover해 주세요.',
          },
        },
      },
      staleReasons: {
        'bridge-reset': 'preview 재연결',
        cleared: '선택 해제',
        disconnected: 'DOM 연결 끊김',
        hidden: '숨김',
        'protected-target': '보호 요소',
        'stale-target': '오래된 대상',
        'snapshot-error': '스냅샷 오류',
        'mutation-error': '변경 오류',
        deleted: '삭제됨',
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
