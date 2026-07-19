import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';

import { resolveEditorEventElement } from '../../editor-shadow-root';
import {
  announceVisualDropdownOpen,
  listenForOtherVisualDropdowns,
  listenForVisualDropdownCloseAll,
} from '../visual/dropdownCoordinator';
import {
  registerOpenQuickToolbarPopover,
  unregisterQuickToolbarPopover,
} from './popoverRegistry';

export interface ToolbarPopoverProps {
  label: string;
  buttonContent: ReactNode;
  dataAiId: string;
  disabled?: boolean;
  active?: boolean;
  panelWidthPx?: number;
  children: ReactNode | ((close: () => void) => ReactNode);
}

// Toolbar button + anchored panel. Only one popover/dropdown is open at a
// time (dropdownCoordinator); Escape closes the popover before the global
// cascade unpins the toolbar (popoverRegistry + shortcut-actions.ts).
export function ToolbarPopover({
  label,
  buttonContent,
  dataAiId,
  disabled = false,
  active = false,
  panelWidthPx = 232,
  children,
}: ToolbarPopoverProps): ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const popoverId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => listenForOtherVisualDropdowns(popoverId, () => setIsOpen(false)), [popoverId]);
  useEffect(() => listenForVisualDropdownCloseAll(() => setIsOpen(false)), []);

  useEffect(() => {
    if (!isOpen) {
      unregisterQuickToolbarPopover(popoverId);
      return undefined;
    }

    registerOpenQuickToolbarPopover(popoverId, () => setIsOpen(false));

    const handlePointerDown = (event: PointerEvent): void => {
      const element = resolveEditorEventElement(event);
      if (rootRef.current && !(element && rootRef.current.contains(element))) {
        setIsOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      unregisterQuickToolbarPopover(popoverId);
    };
  }, [isOpen, popoverId]);

  const close = (): void => setIsOpen(false);
  const toggle = (): void => {
    setIsOpen((current) => {
      if (current) {
        return false;
      }

      announceVisualDropdownOpen(popoverId);
      return true;
    });
  };

  return (
    <div className="relative" ref={rootRef} data-ai-id={`${dataAiId}-wrapper`}>
      <button
        type="button"
        className={`flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 disabled:cursor-not-allowed disabled:opacity-50 ${
          isOpen || active
            ? 'border-blue-400/70 bg-blue-600/40 text-white'
            : 'border-gray-600 bg-gray-900 text-gray-200 hover:bg-gray-800 hover:text-white'
        }`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={label}
        disabled={disabled}
        onClick={toggle}
        data-ai-id={`${dataAiId}-button`}
      >
        {buttonContent}
      </button>
      {isOpen ? (
        <div
          className="absolute left-0 top-full z-30 mt-1.5 rounded-lg border border-blue-500/40 bg-gray-950 p-2.5 shadow-xl shadow-black/50"
          style={{ width: `${panelWidthPx}px` }}
          role="dialog"
          aria-label={label}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              setIsOpen(false);
            }
          }}
          data-ai-id={`${dataAiId}-panel`}
        >
          {typeof children === 'function' ? children(close) : children}
        </div>
      ) : null}
    </div>
  );
}
