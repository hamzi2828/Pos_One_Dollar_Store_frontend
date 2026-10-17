import { useEffect, useState } from 'react';

/**
 * Returns a debounced version of `value`, delayed by `delayMs`.
 * Useful for search inputs so we don't hit the API on every keystroke.
 */
export function useDebounced<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);
  return debounced;
}
