import { useState, useEffect } from 'react';

// Hook to get window size
export function useWindowSize() {
  const [windowSize, setWindowSize] = useState<{width: number; height: number;}>({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    function handleResize() {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }
    
    window.addEventListener("resize", handleResize);
    
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return windowSize;
}