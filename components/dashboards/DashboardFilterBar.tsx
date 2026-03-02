'use client';

import React, { useState, useEffect, useRef, useMemo, ComponentProps } from 'react';
import { useFilter, FilterState } from "../../contexts/FilterContext";
import { Filter, Calendar, Tag, User, Building, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { formatToInputDate, parseDate } from "../../utils/time";
import MultiSelectFilter from "../common/MultiSelectFilter";

interface DashboardFilterBarProps {
    statuses: string[];
    assignees: string[];
    companies: string[];
    brands: string[];
    months: string[];
    years: number[];
    onMenuVisibilityChange?: (isVisible: boolean) => void;
}

// Context-aware wrapper for the generic MultiSelectFilter
const ContextAwareMultiSelectFilter: React.FC<Omit<ComponentProps<typeof MultiSelectFilter>, 'selectedValues' | 'onApply'> & { filterKey: keyof FilterState }> = ({ filterKey, ...props }) => {
    const { filters, setFilter } = useFilter();
    const selectedValues = (filters[filterKey] as string[] | undefined) || [];

    const handleApply = (newSelection: string[]) => {
        setFilter(filterKey, newSelection);
    };

    return <MultiSelectFilter {...props} selectedValues={selectedValues} onApply={handleApply} />;
};

const CurrencyToggle: React.FC = () => {
    const { filters, setFilter } = useFilter();
    const activeCurrency = filters.currency || 'USD';

    return (
        <div className="bg-muted p-1 rounded-full flex gap-1 flex-shrink-0">
            <button onClick={() => setFilter('currency', 'USD')} className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${activeCurrency === 'USD' ? 'bg-background shadow-sm text-brand-700' : 'text-muted-foreground hover:bg-slate-200 dark:hover:bg-slate-800'}`}>USD</button>
            <button onClick={() => setFilter('currency', 'KHR')} className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${activeCurrency === 'KHR' ? 'bg-background shadow-sm text-brand-700' : 'text-muted-foreground hover:bg-slate-200 dark:hover:bg-slate-800'}`}>KHR</button>
        </div>
    );
};


const DashboardFilterBar: React.FC<DashboardFilterBarProps> = ({ statuses, assignees, companies, brands, months, years, onMenuVisibilityChange }) => {
    const { filters, setFilter, clearFilters } = useFilter();
    const [openMenu, setOpenMenu] = useState<string | null>(null);
    const filterBarRef = useRef<HTMLDivElement>(null);
    const hasActiveFilters = Object.values(filters).some(val => Array.isArray(val) ? val.length > 0 : !!val);

    useEffect(() => {
        onMenuVisibilityChange?.(openMenu !== null);
    }, [openMenu, onMenuVisibilityChange]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (filterBarRef.current && !filterBarRef.current.contains(event.target as Node)) {
                setOpenMenu(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleMenu = (key: string) => {
        setOpenMenu(prev => (prev === key ? null : key));
    };

    const closeMenu = () => {
        setOpenMenu(null);
    };

    interface DateRangePickerProps {
        filters: FilterState;
        setFilter: (key: keyof FilterState, value: string) => void;
        isOpen: boolean;
        onToggle: (key: string) => void;
        onClose: () => void;
    }

    const DateRangePicker: React.FC<DateRangePickerProps> = ({ filters, setFilter, isOpen, onToggle, onClose }) => {
        const [localRange, setLocalRange] = useState<[Date | null, Date | null]>([null, null]);
        const [visibleDate, setVisibleDate] = useState(new Date());
        const [hoveredDate, setHoveredDate] = useState<Date | null>(null);

        useEffect(() => {
            if (isOpen) {
                const parseToLocal = (str?: string) => {
                    if (!str) return null;
                    const date = parseDate(str);
                    if (!date) return null;
                    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
                };

                const start = parseToLocal(filters.startDate);
                const end = parseToLocal(filters.endDate);
                setLocalRange([start, end]);
                setVisibleDate(start || new Date());
            }
        }, [isOpen, filters.startDate, filters.endDate]);

        const handleApply = () => {
            const [start, end] = localRange;

            const formatDate = (date: Date | null) => {
                if (!date) return '';
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            };

            setFilter('startDate', formatDate(start));
            setFilter('endDate', formatDate(end));
            onClose();
        };

        const handleMonthNav = (direction: number) => {
            setVisibleDate(prev => new Date(prev.getFullYear(), prev.getMonth() + direction, 1));
        };

        const handleDateClick = (day: Date) => {
            const [start, end] = localRange;
            if (!start || end) {
                setLocalRange([day, null]);
            } else {
                if (day < start) {
                    setLocalRange([day, null]);
                } else {
                    setLocalRange([start, day]);
                }
            }
        };

        const handlePresetClick = (preset: { label: string; days?: number; type?: 'this_month' | 'last_month' }) => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            let start: Date;
            let end: Date = new Date(today);

            if (preset.type === 'this_month') {
                start = new Date(today.getFullYear(), today.getMonth(), 1);
                end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            } else if (preset.type === 'last_month') {
                start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                end = new Date(today.getFullYear(), today.getMonth(), 0);
            } else {
                start = new Date(today);
                start.setDate(today.getDate() - (preset.days || 0));
            }

            const formatDate = (date: Date) => {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            };

            setFilter('startDate', formatDate(start));
            setFilter('endDate', formatDate(end));
            onClose();
        };

        const MonthCalendar = ({ date }: { date: Date }) => {
            const year = date.getFullYear();
            const month = date.getMonth();
            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);
            const daysInMonth = lastDay.getDate();
            const startDayOfWeek = firstDay.getDay();

            const days = [];
            for (let i = 0; i < startDayOfWeek; i++) days.push(null);
            for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            return (
                <div className="flex-1">
                    <h4 className="font-bold text-foreground text-center mb-4">{date.toLocaleString('default', { month: 'long', year: 'numeric' })}</h4>
                    <div className="grid grid-cols-7 gap-y-1">
                        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                            <div key={d} className="text-center text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2">{d}</div>
                        ))}
                        {days.map((day, i) => {
                            const dayTime = day?.getTime();
                            const [start, end] = localRange;
                            const isStart = start && dayTime === start.getTime();
                            const isEnd = end && dayTime === end.getTime();
                            const isInRange = start && end && dayTime! > start.getTime() && dayTime! < end.getTime();
                            const isHoverInRange = start && !end && hoveredDate && (
                                (hoveredDate > start && day! > start && day! <= hoveredDate) ||
                                (hoveredDate < start && day! < start && day! >= hoveredDate)
                            );

                            return (
                                <div
                                    key={i}
                                    className={`relative h-10 flex items-center justify-center cursor-pointer group ${!day ? 'invisible' : ''} ${isInRange ? 'bg-brand-500/10' : ''} ${isHoverInRange ? 'bg-muted' : ''} ${isStart && end ? 'rounded-l-full bg-brand-500/10' : ''} ${isEnd ? 'rounded-r-full bg-brand-500/10' : ''}`}
                                    onClick={() => day && handleDateClick(day)}
                                    onMouseEnter={() => day && setHoveredDate(day)}
                                    onMouseLeave={() => setHoveredDate(null)}
                                >
                                    {day && (
                                        <div className={`w-8 h-8 flex items-center justify-center rounded-full text-sm transition-all duration-200 ${(isStart || isEnd) ? 'bg-brand-600 text-white font-bold scale-110 shadow-md ring-2 ring-brand-600 ring-offset-2 ring-offset-background' : dayTime === today.getTime() ? 'text-brand-600 font-bold ring-1 ring-brand-600 ring-offset-1 ring-offset-background' : 'text-foreground group-hover:bg-muted group-hover:text-brand-700 dark:group-hover:text-brand-400'}`}>
                                            {day.getDate()}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        };

        const nextMonthDate = new Date(visibleDate.getFullYear(), visibleDate.getMonth() + 1, 1);
        const { startDate, endDate } = filters;
        const isActive = !!(startDate || endDate);

        const formatDateForDisplay = (dateString?: string) => {
            if (!dateString) return '';
            const date = parseDate(dateString);
            return date ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
        };

        let label = 'Date Range';
        if (startDate && endDate) label = `${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}`;
        else if (startDate) label = `From ${formatDateForDisplay(startDate)}`;
        else if (endDate) label = `Until ${formatDateForDisplay(endDate)}`;

        return (
            <div className="relative flex-shrink-0">
                <button
                    onClick={(e) => { e.stopPropagation(); onToggle('dateRange'); }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-300 border ${isActive ? 'bg-brand-50 text-brand-800 border-brand-200 dark:bg-brand-900/20 dark:text-brand-400 dark:border-brand-800 shadow-sm ring-1 ring-brand-200' : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'}`}
                >
                    <Calendar className={`w-4 h-4 ${isActive ? 'text-brand-600' : 'text-muted-foreground'}`} />
                    <span className={`${isActive ? 'font-bold' : ''}`}>{label}</span>
                    {isActive && <button onClick={(e) => { e.stopPropagation(); setFilter('startDate', ''); setFilter('endDate', ''); }} className="ml-1 hover:text-red-500 transition-colors"><X className="w-3.5 h-3.5" /></button>}
                </button>

                {isOpen && (
                    <div
                        className="absolute top-full left-0 mt-3 p-0 bg-card rounded-2xl shadow-2xl border border-border z-[100] animate-in fade-in zoom-in duration-200 overflow-hidden flex"
                        style={{ width: '720px' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <aside className="w-44 bg-muted/30 p-6 border-r border-border">
                            <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4">Quick Select</h4>
                            <div className="space-y-1">
                                {[
                                    { label: 'Today', days: 0 },
                                    { label: 'Last 7 Days', days: 6 },
                                    { label: 'Last 30 Days', days: 29 },
                                    { label: 'This Month', type: 'this_month' as const },
                                    { label: 'Last Month', type: 'last_month' as const },
                                ].map(p => (
                                    <button
                                        key={p.label}
                                        onClick={() => handlePresetClick(p)}
                                        className="w-full text-left text-sm font-medium text-muted-foreground hover:text-brand-700 dark:hover:text-brand-400 hover:bg-brand-50/50 dark:hover:bg-brand-900/10 p-2.5 rounded-xl transition-all duration-200"
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        </aside>

                        <div className="flex-1 flex flex-col min-w-0">
                            <div className="p-8 flex-1">
                                <div className="flex justify-between items-center mb-8 px-2">
                                    <button onClick={() => handleMonthNav(-1)} className="p-2 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground"><ChevronLeft className="w-5 h-5" /></button>
                                    <div className="flex gap-40 font-bold text-foreground">
                                        {/* These are placeholder titles to help centering, but MonthCalendar renders its own */}
                                    </div>
                                    <button onClick={() => handleMonthNav(1)} className="p-2 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground"><ChevronRight className="w-5 h-5" /></button>
                                </div>
                                <div className="flex gap-12">
                                    <MonthCalendar date={visibleDate} />
                                    <MonthCalendar date={nextMonthDate} />
                                </div>
                            </div>
                            <footer className="px-8 py-5 border-t border-border bg-muted/30 flex justify-between items-center">
                                <div className="text-xs text-muted-foreground font-medium">
                                    {localRange[0] && !localRange[1] && <span>Selecting end date...</span>}
                                    {localRange[0] && localRange[1] && <span>Range selected</span>}
                                </div>
                                <div className="flex gap-3">
                                    <button onClick={onClose} className="px-5 py-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                                    <button
                                        onClick={handleApply}
                                        disabled={!localRange[0]}
                                        className="px-6 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl shadow-lg shadow-brand-200 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                                    >
                                        Apply Range
                                    </button>
                                </div>
                            </footer>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const filterConfig: Omit<ComponentProps<typeof ContextAwareMultiSelectFilter>, 'isOpen' | 'onToggle' | 'onClose'>[] = [
        { filterKey: 'year', label: 'Year', icon: <Calendar className="w-4 h-4" />, options: years.map(String) },
        { filterKey: 'month', label: 'Month', icon: <Calendar className="w-4 h-4" />, options: months },
        { filterKey: 'status', label: 'Status', icon: <Tag className="w-4 h-4" />, options: statuses },
        { filterKey: 'responsibleBy', label: 'Assignee', icon: <User className="w-4 h-4" />, options: assignees },
        { filterKey: 'companyName', label: 'Company', icon: <Building className="w-4 h-4" />, options: companies },
        { filterKey: 'brand1', label: 'Brand', icon: <Tag className="w-4 h-4" />, options: brands },
    ];

    return (
        <div ref={filterBarRef} className="bg-card p-3 rounded-xl border border-border shadow-sm flex items-center gap-2">
            <div className="flex items-center gap-3 pr-3 border-r border-border">
                <Filter className="w-5 h-5 text-brand-700 flex-shrink-0" />
                <span className="text-sm font-semibold text-foreground hidden lg:block">Filters</span>
            </div>
            <div className="flex-1 flex flex-wrap items-center gap-2">
                <CurrencyToggle />
                <DateRangePicker
                    filters={filters}
                    setFilter={setFilter}
                    isOpen={openMenu === 'dateRange'}
                    onToggle={toggleMenu}
                    onClose={closeMenu}
                />
                {filterConfig.map(config => (
                    <ContextAwareMultiSelectFilter
                        key={config.filterKey}
                        {...config}
                        isOpen={openMenu === config.filterKey}
                        onToggle={() => toggleMenu(config.filterKey)}
                        onClose={closeMenu}
                    />
                ))}
            </div>
            {hasActiveFilters && (
                <button
                    onClick={clearFilters}
                    className="ml-auto flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors"
                    aria-label="Clear all filters"
                    title="Clear all filters"
                >
                    <X className="w-4 h-4" />
                </button>
            )}
        </div>
    );
};

export default DashboardFilterBar;
