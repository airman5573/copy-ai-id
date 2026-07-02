import { useEffect, useState } from 'react';

/**
 * Local draft state for a controlled input that commits on blur/Enter and
 * reverts on Escape. The draft resyncs whenever the committed value (or the
 * optional reset key, e.g. the CSS property name) changes.
 */
export function useDraftValue(
  committed: string,
  resetKey?: unknown,
): [string, (value: string) => void] {
  const [draft, setDraft] = useState(committed);

  useEffect(() => {
    setDraft(committed);
  }, [committed, resetKey]);

  return [draft, setDraft];
}
