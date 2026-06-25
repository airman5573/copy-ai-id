# Quick-Toolbar Hover Fix Implementation Plan

## Problem Summary

When hovering over an element in the visual editor, a quick-toolbar appears above or below the element. However, when moving the mouse from the original element to the quick-toolbar (across the 8px gap defined by `QUICK_ACTION_BAR_GAP`), the original element's hover state is lost. This triggers `handleMouseOut` which hides the toolbar before the user can interact with it.

### Root Cause Analysis

The issue is a **race condition** between two event handlers:

1. **`handleMouseOut` in `highlight.ts`** (lines 73-85):
   - Fires when the mouse leaves the highlighted element
   - Checks `isQuickActionToolbarEvent(event)` but this only checks if `event.target` or `event.relatedTarget` IS the toolbar
   - When crossing the 8px gap, `event.relatedTarget` may be `null` or another element
   - Calls `setHighlightedElement(null, post, 'preview')` which triggers `requestQuickActionToolbarHide()`

2. **`handleToolbarPointerEnter` in `quick-action-toolbar.ts`** (lines 594-597):
   - Sets `isToolbarHovered = true` to prevent hiding
   - But this fires AFTER the mouse has already entered the toolbar
   - By this time, `hideQuickActionToolbar()` has already been called

### The Problematic Sequence

1. User hovers element → `handleMouseOver` → `showQuickActionToolbar`
2. User moves mouse toward toolbar → crosses 8px gap
3. `handleMouseOut` fires on element with `relatedTarget === null`
4. `isQuickActionToolbarEvent` returns `false`
5. `setHighlightedElement(null, ...)` is called
6. `requestQuickActionToolbarHide()` is triggered
7. `hasActiveToolbarInteraction()` returns `false` (toolbar not entered yet)
8. `hideQuickActionToolbar()` is called
9. Toolbar disappears before user can click it
10. (Optional) `handleToolbarPointerEnter` fires but toolbar is already hidden

## Recommended Solution: Delay-Based Approach with Timeout

After evaluating multiple approaches (see "Alternative Solutions" below), the **Delay-Based Approach with Timeout** is recommended because:

- **Low implementation complexity** - Minimal code changes
- **Standard pattern** - Used by many UI frameworks (dropdowns, tooltips, etc.)
- **No DOM manipulation** - Works with existing structure
- **Proven reliability** - Well-understood edge cases

### How It Works

When the mouse leaves either the highlighted element OR the toolbar, instead of immediately hiding:
1. Start a short timeout (e.g., 150ms)
2. If the mouse re-enters either the element OR toolbar during this window, cancel the timeout
3. Only hide the toolbar if the timeout completes without interruption

## Implementation Steps

### Step 1: Add Delay State to `quick-action-toolbar.ts`

Add new state variables at the module level (around line 86):

```typescript
let hideTimeoutId: number | null = null;
const HIDE_DELAY_MS = 150;
```

### Step 2: Modify `requestQuickActionToolbarHide` Function

Replace the existing function (lines 122-129) with a delayed version:

```typescript
export function requestQuickActionToolbarHide(): void {
  if (hasActiveToolbarInteraction()) {
    pendingHide = true;
    return;
  }
  
  // Clear any existing timeout
  if (hideTimeoutId !== null) {
    window.clearTimeout(hideTimeoutId);
  }
  
  // Set new timeout
  hideTimeoutId = window.setTimeout(() => {
    hideTimeoutId = null;
    if (!hasActiveToolbarInteraction()) {
      hideQuickActionToolbar();
    }
  }, HIDE_DELAY_MS);
}
```

### Step 3: Add Function to Cancel Hide

Add a new function to cancel the pending hide:

```typescript
function cancelQuickActionToolbarHide(): void {
  if (hideTimeoutId !== null) {
    window.clearTimeout(hideTimeoutId);
    hideTimeoutId = null;
  }
  pendingHide = false;
}
```

### Step 4: Update `handleToolbarPointerEnter`

Modify the existing function (lines 594-597) to cancel the hide:

```typescript
function handleToolbarPointerEnter(): void {
  isToolbarHovered = true;
  cancelQuickActionToolbarHide();  // Changed from pendingHide = false
}
```

### Step 5: Update `handleToolbarFocusIn`

Modify the existing function (lines 604-607):

```typescript
function handleToolbarFocusIn(): void {
  isToolbarFocusWithin = true;
  cancelQuickActionToolbarHide();  // Changed from pendingHide = false
}
```

### Step 6: Update `hideQuickActionToolbar`

Modify the existing function (lines 131-144) to clean up timeout:

```typescript
export function hideQuickActionToolbar(): void {
  // Add this at the beginning
  if (hideTimeoutId !== null) {
    window.clearTimeout(hideTimeoutId);
    hideTimeoutId = null;
  }
  
  pendingHide = false;
  renderState = null;
  dragState = null;
  setToolbarDragging(false);
  cancelPlacementRefresh();
  uninstallViewportListeners();

  if (toolbarRoot) {
    toolbarRoot.style.display = 'none';
    toolbarRoot.style.visibility = 'hidden';
    toolbarRoot.removeAttribute('data-visual-target-updated-at');
  }
}
```

### Step 7: Update `destroyQuickActionToolbar`

Modify the existing function (lines 146-156):

```typescript
export function destroyQuickActionToolbar(): void {
  // Add timeout cleanup
  if (hideTimeoutId !== null) {
    window.clearTimeout(hideTimeoutId);
    hideTimeoutId = null;
  }
  
  hideQuickActionToolbar();
  resizeObserver?.disconnect();
  resizeObserver = null;
  toolbarRoot?.remove();
  toolbarRoot = null;
  styleElement?.remove();
  styleElement = null;
  isToolbarHovered = false;
  isToolbarFocusWithin = false;
}
```

### Step 8: Add Element Hover Cancel to `highlight.ts`

In `highlight.ts`, modify the `handleMouseOver` function (lines 61-71) to cancel the toolbar hide when re-entering the element:

```typescript
const handleMouseOver = (event: MouseEvent): void => {
  if (isHoverHighlightSuppressed()) {
    return;
  }

  if (isQuickActionToolbarEvent(event)) {
    return;
  }

  const element = resolvePreviewHighlightElement(event);
  
  // If re-entering the same element, cancel toolbar hide
  if (element && element === getHighlightedElement()) {
    // Import and call: cancelQuickActionToolbarHide from quick-action-toolbar
    // This requires adding a new export to quick-action-toolbar.ts
  }
  
  setHighlightedElement(element, post, 'preview');
};
```

### Step 9: Export `cancelQuickActionToolbarHide`

In `quick-action-toolbar.ts`, export the cancel function:

```typescript
export function cancelQuickActionToolbarHide(): void {
  if (hideTimeoutId !== null) {
    window.clearTimeout(hideTimeoutId);
    hideTimeoutId = null;
  }
  pendingHide = false;
}
```

### Step 10: Import and Use in `highlight.ts`

Add the import at the top of `highlight.ts`:

```typescript
import {
  isQuickActionToolbarElement,
  requestQuickActionToolbarHide,
  showQuickActionToolbar,
  cancelQuickActionToolbarHide,  // Add this
} from './quick-action-toolbar';
```

Then update `handleMouseOver`:

```typescript
const handleMouseOver = (event: MouseEvent): void => {
  if (isHoverHighlightSuppressed()) {
    return;
  }

  if (isQuickActionToolbarEvent(event)) {
    return;
  }

  const element = resolvePreviewHighlightElement(event);
  
  // Cancel toolbar hide if re-entering the highlighted element
  if (element && element === getHighlightedElement()) {
    cancelQuickActionToolbarHide();
  }
  
  setHighlightedElement(element, post, 'preview');
};
```

## Files to Modify

1. `/Users/yoon/Desktop/labs/copy-ai-id/src/content/editor-bridge/quick-action-toolbar.ts`
   - Add `hideTimeoutId` and `HIDE_DELAY_MS` variables
   - Modify `requestQuickActionToolbarHide()`
   - Add `cancelQuickActionToolbarHide()` function
   - Update `handleToolbarPointerEnter()`
   - Update `handleToolbarFocusIn()`
   - Update `hideQuickActionToolbar()`
   - Update `destroyQuickActionToolbar()`
   - Export `cancelQuickActionToolbarHide`

2. `/Users/yoon/Desktop/labs/copy-ai-id/src/content/editor-bridge/highlight.ts`
   - Import `cancelQuickActionToolbarHide`
   - Update `handleMouseOver` to call cancel when re-entering element

## Alternative Solutions (Briefly Considered)

### 1. Invisible Connector Element
Create an invisible element spanning the gap. **Not chosen** because it requires complex dynamic sizing and may interfere with underlying content.

### 2. Pointer Events Capture/Coordination
Use `setPointerCapture` and vector analysis to predict intent. **Not chosen** because of high complexity and many edge cases.

### 3. Geometry-Based Collision Detection
Expand hit zones and use `elementFromPoint()`. **Not chosen** because of performance overhead from continuous polling.

### 4. Shared Hover State Management
Centralized state across iframe boundary. **Not chosen** because it adds architectural complexity for this specific issue.

## Edge Cases to Handle

### 1. Toolbar at Edge of Viewport
When the toolbar is positioned at the viewport edge, the 150ms delay still applies correctly since it's time-based, not geometry-based.

### 2. Very Small Elements
For elements smaller than the toolbar, the mouse may leave the element before the toolbar appears. The delay handles this naturally.

### 3. Keyboard Navigation
The `handleToolbarFocusIn` modification ensures keyboard users don't experience unexpected hiding.

### 4. Drag Operations
The existing `dragState` check in `hasActiveToolbarInteraction()` already prevents hiding during drag operations.

### 5. Rapid Mouse Movement
Fast mouse movements across the gap are covered by the 150ms window - as long as the movement completes within this time, the toolbar stays visible.

### 6. Multiple Elements in Quick Succession
When moving between different elements quickly, each new hover cancels the previous hide timeout and starts fresh.

## Testing Checklist

- [ ] Hover over an element - toolbar appears
- [ ] Move mouse slowly from element to toolbar - toolbar stays visible
- [ ] Move mouse quickly from element to toolbar - toolbar stays visible
- [ ] Move mouse away from both element and toolbar - toolbar hides after ~150ms
- [ ] Click a button on the toolbar - it works
- [ ] Use keyboard to navigate to toolbar - toolbar stays visible
- [ ] Move mouse to another element - old toolbar hides, new toolbar appears
- [ ] Test with toolbar positioned above element
- [ ] Test with toolbar positioned below element
- [ ] Test with element at viewport edge
- [ ] Test with very small elements
- [ ] Test drag operations - toolbar doesn't hide during drag
- [ ] Test rapid movements between multiple elements

## Performance Considerations

The 150ms timeout is very lightweight:
- No continuous polling or `requestAnimationFrame` loops
- No geometry calculations on every mouse move
- Only one `setTimeout`/`clearTimeout` operation per hover transition
- Memory overhead is minimal (single number variable)

The 150ms duration was chosen because:
- It's long enough to cover the gap crossing at typical mouse speeds
- It's short enough that users don't perceive lag when moving away intentionally
- It matches common UI patterns (dropdowns, tooltips often use 100-200ms)

## Rollback Plan

If issues arise, the changes are easily reversible:
1. All new code is additive or contained within existing functions
2. No changes to data structures or external interfaces
3. Simply revert the two modified files to restore previous behavior

## Future Enhancements (Out of Scope)

- Make the delay duration configurable via settings
- Add visual feedback during the delay window (e.g., fade animation)
- Consider user's mouse speed to dynamically adjust delay
- A/B test different delay values for optimal UX
