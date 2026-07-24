const SHIFT_KEY = 'Shift';
const SPACE_CODE = 'Space';
const Z_CODE = 'KeyZ';

interface ShiftZSpaceToggleControllerOptions {
  toggleEnabled(nextEnabled: boolean): Promise<void>;
}

export interface ShiftZSpaceToggleController {
  syncEnabled(enabled: boolean): void;
  attach(): void;
  destroy(): void;
}

export function createShiftZSpaceToggleController(
  options: ShiftZSpaceToggleControllerOptions,
): ShiftZSpaceToggleController {
  const runtimeState = {
    currentEnabled: false,
    togglePressLatched: false,
    toggleWriteInFlight: false,
    consumeSpaceKeyUp: false,
    consumeZKeyUp: false,
    zKeyPressed: false,
    listenersAttached: false,
  };

  function isShiftZPrefix(event: KeyboardEvent): boolean {
    return event.code === Z_CODE
      && event.shiftKey
      && !event.metaKey
      && !event.ctrlKey
      && !event.altKey;
  }

  function isShiftZSpaceKeydown(event: KeyboardEvent): boolean {
    return event.code === SPACE_CODE
      && event.shiftKey
      && runtimeState.zKeyPressed
      && !event.metaKey
      && !event.ctrlKey
      && !event.altKey;
  }

  function shouldIgnoreToggleHotkey(event: KeyboardEvent): boolean {
    if (!isShiftZSpaceKeydown(event)) {
      return true;
    }

    if (event.repeat || runtimeState.togglePressLatched || runtimeState.toggleWriteInFlight) {
      return true;
    }

    return false;
  }

  function releaseToggleLatch(): void {
    runtimeState.togglePressLatched = false;
  }

  function resetPressedKeys(): void {
    runtimeState.zKeyPressed = false;
    runtimeState.consumeSpaceKeyUp = false;
    runtimeState.consumeZKeyUp = false;
    releaseToggleLatch();
  }

  function consumeKeyboardEvent(event: KeyboardEvent): void {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }

  function isExtensionContextInvalidatedError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return message.includes('Extension context invalidated');
  }

  function detachListeners(): void {
    if (!runtimeState.listenersAttached) {
      return;
    }

    document.removeEventListener('keydown', handleToggleHotkeyKeyDown, true);
    document.removeEventListener('keyup', handleToggleHotkeyKeyUp, true);
    window.removeEventListener('blur', resetPressedKeys);
    runtimeState.listenersAttached = false;
  }

  async function toggleEnabledFromHotkey(): Promise<void> {
    runtimeState.toggleWriteInFlight = true;

    try {
      await options.toggleEnabled(!runtimeState.currentEnabled);
    } catch (error) {
      runtimeState.toggleWriteInFlight = false;

      if (isExtensionContextInvalidatedError(error)) {
        detachListeners();
        return;
      }

      console.error('[Copy AI ID] Failed to toggle enabled state from Shift+Z+Space hotkey.', error);
    }
  }

  function handleToggleHotkeyKeyDown(event: KeyboardEvent): void {
    if (event.code === Z_CODE) {
      if (isShiftZPrefix(event)) {
        // Reserve the prefix immediately. Waiting until Space is pressed is
        // too late: with a Korean IME the physical Z key inserts "ㅋ" into
        // the currently focused editor before the full chord is recognized.
        runtimeState.zKeyPressed = true;
        runtimeState.consumeZKeyUp = true;
        consumeKeyboardEvent(event);
      } else if (!event.repeat) {
        runtimeState.zKeyPressed = false;
      }
    }

    if (shouldIgnoreToggleHotkey(event)) {
      if (isShiftZSpaceKeydown(event)) {
        consumeKeyboardEvent(event);
      }
      return;
    }

    consumeKeyboardEvent(event);
    runtimeState.togglePressLatched = true;
    runtimeState.consumeSpaceKeyUp = true;
    void toggleEnabledFromHotkey();
  }

  function handleToggleHotkeyKeyUp(event: KeyboardEvent): void {
    if (event.key !== SHIFT_KEY && event.code !== Z_CODE && event.code !== SPACE_CODE) {
      return;
    }

    if (
      runtimeState.togglePressLatched
      || runtimeState.consumeSpaceKeyUp
      || (event.code === Z_CODE && runtimeState.consumeZKeyUp)
    ) {
      consumeKeyboardEvent(event);
    }

    if (event.code === SPACE_CODE) {
      runtimeState.consumeSpaceKeyUp = false;
    }

    if (event.code === Z_CODE) {
      runtimeState.zKeyPressed = false;
      runtimeState.consumeZKeyUp = false;
    }

    releaseToggleLatch();
  }

  return {
    syncEnabled(enabled: boolean) {
      runtimeState.currentEnabled = enabled;
      runtimeState.toggleWriteInFlight = false;
    },
    attach() {
      if (runtimeState.listenersAttached) {
        return;
      }

      document.addEventListener('keydown', handleToggleHotkeyKeyDown, true);
      document.addEventListener('keyup', handleToggleHotkeyKeyUp, true);
      window.addEventListener('blur', resetPressedKeys);
      runtimeState.listenersAttached = true;
    },
    destroy() {
      detachListeners();
    },
  };
}
