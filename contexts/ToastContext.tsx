'use client';

import { toast } from 'sonner';
import { useCallback } from 'react';

type ToastType = 'success' | 'error' | 'info';

/**
 * Custom hook to display toast notifications.
 * This abstracts the underlying toast library for consistent use across the app.
 * @returns An object containing the `addToast` function.
 */
export const useToast = () => {
  const addToast = useCallback((message: string, type: ToastType) => {
    switch (type) {
      case 'success':
        toast.success(message);
        break;
      case 'error':
        toast.error(message, {
          duration: 5000, // Show errors for a longer duration for better visibility.
        });
        break;
      case 'info':
      default:
        toast.info(message);
        break;
    }
  }, []);

  return { addToast };
};

