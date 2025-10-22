import React, { createContext, useState, useContext, ReactNode } from 'react';

export interface NavigationState {
  view: string;
  filter?: string;
  payload?: any;
}

interface NavigationContextType {
  navigation: NavigationState;
  handleNavigation: (nav: NavigationState) => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const NavigationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [navigation, setNavigation] = useState<NavigationState>({ view: 'dashboard' });

  const handleNavigation = (nav: NavigationState) => {
    setNavigation(nav);
  };

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