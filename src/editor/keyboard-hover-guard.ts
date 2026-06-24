interface MousePosition {
  clientX: number;
  clientY: number;
  screenX: number;
  screenY: number;
}

let keyboardNavigationHoverSuppressed = false;
let lastMousePosition: MousePosition | null = null;
let suppressionStartPosition: MousePosition | null = null;

export function installKeyboardNavigationHoverGuard(): () => void {
  const handleMouseMove = (event: MouseEvent): void => {
    const position = mousePositionForEvent(event);

    if (keyboardNavigationHoverSuppressed && hasMouseMovedFromSuppressionStart(event, position)) {
      keyboardNavigationHoverSuppressed = false;
      suppressionStartPosition = null;
    } else if (keyboardNavigationHoverSuppressed && !suppressionStartPosition) {
      suppressionStartPosition = position;
    }

    lastMousePosition = position;
  };

  window.addEventListener('mousemove', handleMouseMove, { capture: true, passive: true });

  return () => {
    window.removeEventListener('mousemove', handleMouseMove, true);
    keyboardNavigationHoverSuppressed = false;
    lastMousePosition = null;
    suppressionStartPosition = null;
  };
}

export function suppressHoverUntilMouseMove(): void {
  keyboardNavigationHoverSuppressed = true;
  suppressionStartPosition = lastMousePosition;
}

export function isKeyboardNavigationHoverSuppressed(): boolean {
  return keyboardNavigationHoverSuppressed;
}

function hasMouseMovedFromSuppressionStart(event: MouseEvent, position: MousePosition): boolean {
  if (!suppressionStartPosition) {
    return event.movementX !== 0 || event.movementY !== 0;
  }

  return position.clientX !== suppressionStartPosition.clientX
    || position.clientY !== suppressionStartPosition.clientY
    || position.screenX !== suppressionStartPosition.screenX
    || position.screenY !== suppressionStartPosition.screenY;
}

function mousePositionForEvent(event: MouseEvent): MousePosition {
  return {
    clientX: event.clientX,
    clientY: event.clientY,
    screenX: event.screenX,
    screenY: event.screenY,
  };
}
