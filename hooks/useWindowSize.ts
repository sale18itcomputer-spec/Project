'use client';

import { useState, useEffect } from 'react';

type Size = { width: number; height: number };

// SSR-safe hook — starts with 0×0 on server, updates on client mount
export function useWindowSize(): Size {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });

  useEffect(() => {
    const update = () =>
      setSize({ width: window.innerWidth, height: window.innerHeight });

    update(); // immediate read on mount
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return size;
}