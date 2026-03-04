'use client';

import React, { createContext, useContext, ReactNode, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

export interface NavigationState {
  view: string;
  filter?: string;
  action?: string;
  id?: string;
  payload?: any;
}

interface NavigationContextType {
  navigation: NavigationState;
  handleNavigation: (nav: NavigationState) => void;
}

export const VIEW_TO_PATH: Record<string, string> = {
  'dashboard': '/',
  'projects': '/projects',
  'companies': '/companies',
  'contacts': '/contacts',
  'contact-logs': '/contact-logs',
  'site-surveys': '/site-surveys',
  'meetings': '/meetings',
  'quotations': '/quotations',
  'sale-orders': '/sale-orders',
  'pricelist': '/pricelist',
  'b2b-pricelist': '/b2b-pricelist',
  'invoice-do': '/invoice-do',
  'users': '/users',
  'vendors': '/vendors',
  'vendor-pricelist': '/vendor-pricelist',
  'purchase-orders': '/purchase-orders',
};

export const PATH_TO_VIEW: Record<string, string> = Object.fromEntries(
  Object.entries(VIEW_TO_PATH).map(([k, v]) => [v, k])
);

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const NavigationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Derive view, filter, and payload from the current URL
  const currentView = PATH_TO_VIEW[pathname] || 'dashboard';
  const currentFilter = searchParams.get('filter') ?? undefined;
  const currentAction = searchParams.get('action') ?? undefined;
  const currentId = searchParams.get('id') ?? undefined;
  const currentPayloadRaw = searchParams.get('payload');
  let currentPayload: any = undefined;
  if (currentPayloadRaw) {
    try { currentPayload = JSON.parse(currentPayloadRaw); } catch { /* ignore */ }
  }

  const navigation: NavigationState = {
    view: currentView,
    filter: currentFilter,
    action: currentAction,
    id: currentId,
    payload: currentPayload,
  };

  const handleNavigation = useCallback((nav: NavigationState) => {
    const path = VIEW_TO_PATH[nav.view] || '/';

    const params = new URLSearchParams();
    if (nav.filter) params.set('filter', nav.filter);
    if (nav.action) params.set('action', nav.action);
    if (nav.id) params.set('id', nav.id);
    if (nav.payload !== undefined) {
      try { params.set('payload', JSON.stringify(nav.payload)); } catch { /* ignore */ }
    }

    const qs = params.toString();
    router.push(qs ? `${path}?${qs}` : path);
  }, [router]);

  return (
    <NavigationContext.Provider value={{ navigation, handleNavigation }}>
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (context === undefined) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
};
