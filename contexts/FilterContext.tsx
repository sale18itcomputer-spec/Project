import React, { createContext, useState, useContext, ReactNode, useCallback } from 'react';

export interface FilterState {
  status?: string[];
  responsibleBy?: string[];
  companyName?: string[];
  brand1?: string[];
  startDate?: string;
  endDate?: string;
  month?: string[];
  year?: string[];
}

type FilterKey = keyof FilterState;
type FilterValue = string | string[];

interface FilterContextType {
  filters: FilterState;
  setFilter: (key: FilterKey, value: FilterValue) => void;
  removeFilter: (key: FilterKey) => void;
  clearFilters: () => void;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export const FilterProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [filters, setFilters] = useState<FilterState>({});

  const removeFilter = useCallback((key: FilterKey) => {
    setFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[key];
      return newFilters;
    });
  }, []);

  const setFilter = useCallback((key: FilterKey, value: FilterValue) => {
    if (value === '' || (Array.isArray(value) && value.length === 0)) {
        removeFilter(key);
    } else {
        setFilters(prev => ({ ...prev, [key]: value }));
    }
  }, [removeFilter]);


  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);

  return (
    <FilterContext.Provider value={{ filters, setFilter, removeFilter, clearFilters }}>
      {children}
    </FilterContext.Provider>
  );
};

export const useFilter = () => {
  const context = useContext(FilterContext);
  if (context === undefined) {
    throw new Error('useFilter must be used within a FilterProvider');
  }
  return context;
};
