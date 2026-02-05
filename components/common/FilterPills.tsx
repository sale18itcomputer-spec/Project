import React from 'react';
import { useFilter, FilterState } from "../../contexts/FilterContext";
import { X } from 'lucide-react';

// FIX: Added 'currency' to satisfy the Record<keyof FilterState, string> type.
const FILTER_LABELS: Record<keyof FilterState, string> = {
  status: 'Status',
  responsibleBy: 'Assignee',
  companyName: 'Company',
  brand1: 'Brand',
  startDate: 'Start Date',
  endDate: 'End Date',
  month: 'Month',
  year: 'Year',
  currency: 'Currency',
};

const FilterPills: React.FC = () => {
  const { filters, removeFilter, clearFilters } = useFilter();
  // FIX: Exclude the 'currency' filter from being shown as a removable pill.
  const activeFilters = Object.entries(filters).filter(([key, value]) => key !== 'currency' && (Array.isArray(value) ? value.length > 0 : !!value));


  if (activeFilters.length === 0) {
    return null;
  }
  
  const getDisplayValue = (key: keyof FilterState, value: any) => {
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    return value;
  }

  return (
    <div className="flex items-center flex-wrap gap-2 mb-6 p-4 bg-brand-50 border border-brand-200 rounded-lg">
      <span className="text-sm font-semibold text-gray-700 mr-2">Active Filters:</span>
      {activeFilters.map(([key, value]) => (
        <span key={key} className="inline-flex items-center py-1 pl-3 pr-2 bg-brand-100 text-brand-800 rounded-full text-sm font-medium">
          <strong>{FILTER_LABELS[key as keyof FilterState]}:</strong>&nbsp;{getDisplayValue(key as keyof FilterState, value)}
          <button
            onClick={() => removeFilter(key as keyof FilterState)}
            className="ml-2 flex-shrink-0 bg-brand-200 hover:bg-brand-300 text-brand-700 rounded-full p-0.5"
            aria-label={`Remove ${value} filter`}
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <button onClick={clearFilters} className="text-sm font-semibold text-brand-600 hover:underline ml-auto">
        Clear All
      </button>
    </div>
  );
};

export default FilterPills;