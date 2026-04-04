'use client';

import React from 'react';
import { useFilter } from '../../contexts/FilterContext';
import { X, Calendar } from 'lucide-react';
import { cn } from '../../lib/utils';

export const DateRangePicker: React.FC = () => {
    const { filters, setFilter, removeFilter } = useFilter();

    const handleClear = () => {
        removeFilter('startDate');
        removeFilter('endDate');
    };

    const isActive = filters.startDate || filters.endDate;

    return (
        <div className="flex items-center gap-2 bg-muted/30 p-1.5 rounded-lg border border-border/50">
            <div className="flex items-center gap-1.5 px-2 text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Range</span>
            </div>
            
            <div className="flex items-center gap-1">
                <input
                    type="date"
                    value={filters.startDate || ''}
                    onChange={(e) => setFilter('startDate', e.target.value)}
                    className={cn(
                        "bg-background border border-border rounded-md px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary transition-all",
                        filters.startDate ? "text-foreground font-medium" : "text-muted-foreground"
                    )}
                />
                <span className="text-muted-foreground text-[10px] font-bold">TO</span>
                <input
                    type="date"
                    value={filters.endDate || ''}
                    onChange={(e) => setFilter('endDate', e.target.value)}
                    className={cn(
                        "bg-background border border-border rounded-md px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary transition-all",
                        filters.endDate ? "text-foreground font-medium" : "text-muted-foreground"
                    )}
                />
            </div>

            {isActive && (
                <button
                    onClick={handleClear}
                    className="p-1 hover:bg-destructive/10 hover:text-destructive rounded-md transition-colors text-muted-foreground"
                    title="Clear date range"
                >
                    <X className="w-4 h-4" />
                </button>
            )}
        </div>
    );
};
