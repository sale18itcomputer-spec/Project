import React, { createContext, useState, useEffect, useContext, ReactNode, useRef } from 'react';
import { useToast } from './ToastContext';

interface ConnectivityContextType {
  isOnline: boolean;
}

const ConnectivityContext = createContext<ConnectivityContextType>({ isOnline: true });

export const ConnectivityProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const { addToast } = useToast();
  const wasOffline = useRef(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline.current) {
        addToast("You are back online!", 'success');
        wasOffline.current = false;
      }
    };
    const handleOffline = () => {
      setIsOnline(false);
      addToast("You are offline. Showing cached data.", 'info');
      wasOffline.current = true;
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [addToast]);

  return (
    <ConnectivityContext.Provider value={{ isOnline }}>
      {children}
    </ConnectivityContext.Provider>
  );
};

export const useConnectivity = () => {
  return useContext(ConnectivityContext);
};
