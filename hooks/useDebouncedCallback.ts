import { useRef, useEffect, useMemo } from 'react';

export function useDebouncedCallback<A extends any[]>(
  callback: (...args: A) => void,
  wait: number
) {
  // FIX: Initialize useRef with null to provide an initial value.
  const argsRef = useRef<A | null>(null);
  // FIX: Initialize useRef with null to provide an initial value.
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  function cleanup() {
    if (timeout.current) {
      clearTimeout(timeout.current);
    }
  }

  useEffect(() => cleanup, []);

  const debouncedCallback = useMemo(() => {
    const fun = (...args: A) => {
      argsRef.current = args;
      cleanup();
      timeout.current = setTimeout(() => {
        if (argsRef.current) {
          callback(...argsRef.current);
        }
      }, wait);
    };
    return fun;
  }, [callback, wait]);
  
  return debouncedCallback;
}
