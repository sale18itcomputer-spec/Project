import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useFilter, FilterState } from '../contexts/FilterContext';
import { Filter, Calendar, Tag, User, Building, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { formatToInputDate, parseDate } from '../utils/time';

interface DashboardFilterBarProps {
    statuses: string[];
    assignees: string[];
    companies: string[];
    brands: string[];
    months: string[];
    years: number[];
    onMenuVisibilityChange?: (isVisible: boolean) => void;
}

interface MultiSelectFilterProps {
    filterKey: keyof FilterState;
    label: string;
    icon: React.ReactNode;
    options: (string | {label: string, value: string})[];
    isOpen: boolean;
    onToggle: () => void;
    onClose: () => void;
}

const MultiSelectFilter: React.FC<MultiSelectFilterProps> = ({ filterKey, label, icon, options, isOpen, onToggle, onClose }) => {
    const { filters, setFilter } = useFilter();
    const [localSelection, setLocalSelection] = useState<string[]>([]);
    const [search, setSearch] = useState('');

    useEffect(() => {
        if (isOpen) {
            setLocalSelection((filters[filterKey] as string[] | undefined) || []);
        } else {
            setSearch(''); // Reset search on close
        }
    }, [isOpen, filters, filterKey]);
    
    const normalizedOptions = useMemo(() => {
        return options.map(opt => typeof opt === 'string' ? { label: opt, value: opt } : opt);
    }, [options]);

    const handleToggleOption = (optionValue: string) => {
        setLocalSelection(prev => 
            prev.includes(optionValue) ? prev.filter(item => item !== optionValue) : [...prev, optionValue]
        );
    };

    const handleApply = () => {
        setFilter(filterKey, localSelection);
        onClose();
    };

    const handleClear = () => {
        setLocalSelection([]);
        setFilter(filterKey, []);
        onClose();
    };

    const filteredOptions = useMemo(() => {
        if (!search) return normalizedOptions;
        return normalizedOptions.filter(opt => opt.label.toLowerCase().includes(search.toLowerCase()));
    }, [normalizedOptions, search]);

    const handleSelectAll = () => setLocalSelection(filteredOptions.map(opt => opt.value));
    const handleDeselectAll = () => setLocalSelection([]);

    const selectedCount = (filters[filterKey] as string[] | undefined)?.length || 0;
    const isActive = selectedCount > 0;

    const buttonClasses = `flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer border ${
        isActive
            ? 'bg-brand-50 text-brand-800 border-brand-200 hover:bg-brand-100'
            : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
    }`;
    
    return (
        <div className="relative flex-shrink-0">
            <button onClick={onToggle} className={buttonClasses}>
                {icon}
                <span className={`${isActive ? 'font-semibold' : ''} max-w-[150px] truncate`}>
                    {label} {selectedCount > 0 && `(${selectedCount})`}
                </span>
            </button>

            {isOpen && (
                <div className="absolute top-full mt-2 w-72 bg-white rounded-lg shadow-lg border border-slate-200 z-20 flex flex-col animate-contentFadeIn" style={{animationDuration: '0.15s'}}>
                   <div className="p-2 border-b border-slate-200">
                       <input
                         type="search"
                         placeholder={`Search ${label}...`}
                         value={search}
                         onChange={(e) => setSearch(e.target.value)}
                         className="w-full text-sm px-2 py-1.5 bg-slate-100 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500"
                       />
                   </div>
                   <div className="px-3 py-2 flex justify-between border-b border-slate-200">
                       <button onClick={handleSelectAll} className="text-xs font-semibold text-brand-600 hover:underline">Select all</button>
                       <button onClick={handleDeselectAll} className="text-xs font-semibold text-brand-600 hover:underline">Deselect all</button>
                   </div>
                   <ul className="max-h-60 overflow-y-auto vertical-scroll p-1">
                       {filteredOptions.map(opt => (
                         <li key={opt.value}>
                           <label className="flex items-center gap-3 w-full text-left px-3 py-1.5 text-sm rounded-md hover:bg-slate-50 transition-colors cursor-pointer">
                               <input
                                 type="checkbox"
                                 checked={localSelection.includes(opt.value)}
                                 onChange={() => handleToggleOption(opt.value)}
                                 className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                               />
                               <span className="text-slate-800 truncate">{opt.label}</span>
                           </label>
                         </li>
                       ))}
                   </ul>
                   <div className="p-2 border-t border-slate-200 flex justify-end gap-2 bg-slate-50 rounded-b-lg">
                       <button onClick={handleClear} className="bg-white hover:bg-slate-100 text-slate-700 font-semibold py-1.5 px-3 rounded-md border border-slate-300 transition text-sm">Clear</button>
                       <button onClick={handleApply} className="bg-brand-600 hover:bg-brand-700 text-white font-semibold py-1.5 px-3 rounded-md transition shadow-sm text-sm">Apply</button>
                   </div>
                </div>
            )}
        </div>
    );
};


const DashboardFilterBar: React.FC<DashboardFilterBarProps> = ({ statuses, assignees, companies, brands, months, years, onMenuVisibilityChange }) => {
    const { filters, clearFilters } = useFilter();
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

    const DateRangeFilterButton = () => {
        const { filters, setFilter } = useFilter();
        const [localRange, setLocalRange] = useState<[Date | null, Date | null]>([null, null]);
        const [visibleDate, setVisibleDate] = useState(new Date());
        const [hoveredDate, setHoveredDate] = useState<Date | null>(null);
        
        const isDateRangeOpen = openMenu === 'dateRange';

        useEffect(() => {
            if (isDateRangeOpen) {
                const start = filters.startDate ? parseDate(filters.startDate) : null;
                const end = filters.endDate ? parseDate(filters.endDate) : null;
                setLocalRange([start, end]);
                setVisibleDate(start || new Date());
            }
        }, [isDateRangeOpen]);

        const handleApply = () => {
            const [start, end] = localRange;
            setFilter('startDate', start ? formatToInputDate(start.toISOString()) : '');
            setFilter('endDate', end ? formatToInputDate(end.toISOString()) : '');
            closeMenu();
        };

        const handleCancel = () => closeMenu();

        const handleMonthNav = (direction: number) => {
            setVisibleDate(prev => new Date(prev.getFullYear(), prev.getMonth() + direction, 1));
        };
        
        const getCalendarDays = (date: Date) => {
            const year = date.getFullYear();
            const month = date.getMonth();
            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);
            const daysInMonth = lastDay.getDate();
            const startDayOfWeek = firstDay.getDay();

            const days = Array(startDayOfWeek).fill(null);
            for (let i = 1; i <= daysInMonth; i++) {
                days.push(new Date(year, month, i));
            }
            return days;
        };

        const handleDateClick = (day: Date) => {
            const [start, end] = localRange;
            if (!start || end) { // No start date, or range is complete. Start a new range.
                setLocalRange([day, null]);
            } else { // Start date is set, but no end date. Set the end date.
                if (day < start) { // If end date is before start date, reset.
                    setLocalRange([day, null]);
                } else {
                    setLocalRange([start, day]);
                }
            }
        };
        
        const presets = [
            { label: 'Today', days: 0 },
            { label: 'Last 7 Days', days: 6 },
            { label: 'Last 30 Days', days: 29 },
            { label: 'This Month', type: 'this_month' as const },
            { label: 'Last Month', type: 'last_month' as const },
        ];
        
        const handlePresetClick = (preset: (typeof presets)[number]) => {
            const today = new Date();
            today.setHours(0,0,0,0);
            let start: Date;
            let end: Date = new Date(today);

            // FIX: Use the 'in' operator as a type guard to correctly discriminate the union type.
            // This allows safe access to either 'type' or 'days' property based on the object shape.
            if ('type' in preset) {
                if (preset.type === 'this_month') {
                    start = new Date(today.getFullYear(), today.getMonth(), 1);
                    end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                } else { // 'last_month'
                    start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                    end = new Date(today.getFullYear(), today.getMonth(), 0);
                }
            } else {
                start = new Date(today);
                start.setDate(today.getDate() - preset.days);
            }

            setLocalRange([start, end]);
            setVisibleDate(start);
        };


        const MonthCalendar = ({ date }: { date: Date }) => {
            const days = getCalendarDays(date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const getDayClasses = (day: Date | null) => {
                if (!day) return 'bg-transparent';
                const dayTime = day.getTime();
                const [start, end] = localRange;
                let classes = 'w-9 h-9 flex items-center justify-center rounded-full transition-colors duration-100 ';

                const isStart = start && dayTime === start.getTime();
                const isEnd = end && dayTime === end.getTime();
                const isInRange = start && end && dayTime > start.getTime() && dayTime < end.getTime();
                
                let isHoverInRange = false;
                if(start && !end && hoveredDate) {
                    if (hoveredDate > start && day > start && day <= hoveredDate) {
                        isHoverInRange = true;
                    } else if (hoveredDate < start && day < start && day >= hoveredDate) {
                        isHoverInRange = true;
                    }
                }
                
                if (isStart || isEnd) {
                    classes += 'bg-brand-600 text-white font-semibold';
                } else if (isInRange) {
                    classes += 'bg-brand-100 text-brand-800 rounded-none';
                    if (day.getDay() === 0) classes += ' rounded-l-full';
                    if (day.getDay() === 6) classes += ' rounded-r-full';
                } else if (isHoverInRange) {
                     classes += 'bg-brand-50 text-brand-700';
                } else {
                    classes += 'text-slate-700 hover:bg-slate-100';
                }
                
                if(dayTime === today.getTime() && !isStart && !isEnd && !isInRange) {
                    classes += ' ring-2 ring-brand-500/50';
                }

                return classes;
            };

            return (
                <div>
                    <h4 className="font-semibold text-center mb-2">{date.toLocaleString('default', { month: 'long', year: 'numeric' })}</h4>
                    <div className="grid grid-cols-7 gap-y-1 text-center text-xs text-slate-500 font-semibold mb-2">
                        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => <div key={d}>{d}</div>)}
                    </div>
                    <div className="grid grid-cols-7 gap-y-1">
                        {days.map((day, i) => (
                            <div key={i} className={`flex justify-center items-center h-9 ${!day ? '' : (localRange[0] && localRange[1] && day >= localRange[0] && day <= localRange[1]) ? 'bg-brand-100' : ''}`}>
                            {day && (
                                <button onClick={() => handleDateClick(day)} onMouseEnter={() => setHoveredDate(day)} onMouseLeave={() => setHoveredDate(null)} className={getDayClasses(day)}>
                                    {day.getDate()}
                                </button>
                            )}
                            </div>
                        ))}
                    </div>
                </div>
            );
        };
        
        const nextMonthDate = new Date(visibleDate.getFullYear(), visibleDate.getMonth() + 1, 1);
        
        const { startDate, endDate } = filters;
        const isActive = startDate || endDate;

        const formatDateForDisplay = (dateString: string | undefined) => {
            if (!dateString) return '';
            const date = parseDate(dateString);
            if (!date) return '';
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        };
        
        let label = 'Date Range';
        if (startDate && endDate) {
            label = `${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}`;
        } else if (startDate) {
            label = `From ${formatDateForDisplay(startDate)}`;
        } else if (endDate) {
            label = `Until ${formatDateForDisplay(endDate)}`;
        }

        const buttonClasses = `flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer border ${
            isActive
                ? 'bg-brand-50 text-brand-800 border-brand-200 hover:bg-brand-100'
                : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
        }`;


        return (
            <div className="relative flex-shrink-0">
                <button onClick={() => toggleMenu('dateRange')} className={buttonClasses}>
                    <Calendar className="w-4 h-4" />
                    <span className={`${isActive ? 'font-semibold' : ''} max-w-[200px] truncate`}>{label}</span>
                </button>
                {isDateRangeOpen && (
                    <div className="absolute top-full mt-2 min-w-[680px] bg-white rounded-lg shadow-lg border border-slate-200 z-20 animate-contentFadeIn" style={{ animationDuration: '0.15s' }}>
                        <div className="flex">
                            <aside className="w-48 p-4 border-r border-slate-200">
                                <h4 className="font-semibold text-slate-800 text-sm mb-3">Presets</h4>
                                <ul className="space-y-1">
                                    {presets.map(p => (
                                        <li key={p.label}>
                                            <button onClick={() => handlePresetClick(p)} className="w-full text-left text-sm text-slate-700 hover:bg-slate-100 rounded-md p-2 transition-colors">{p.label}</button>
                                        </li>
                                    ))}
                                </ul>
                            </aside>
                            <main className="flex-1 p-4">
                                <div className="flex justify-between items-center px-4 mb-4">
                                    <button onClick={() => handleMonthNav(-1)} className="p-2 rounded-full hover:bg-slate-100"><ChevronLeft className="w-5 h-5"/></button>
                                    <div className="font-semibold">{visibleDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</div>
                                    <div className="font-semibold">{nextMonthDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</div>
                                    <button onClick={() => handleMonthNav(1)} className="p-2 rounded-full hover:bg-slate-100"><ChevronRight className="w-5 h-5"/></button>
                                </div>
                                <div className="flex gap-8 px-4">
                                    <MonthCalendar date={visibleDate} />
                                    <MonthCalendar date={nextMonthDate} />
                                </div>
                            </main>
                        </div>
                        <footer className="p-3 border-t border-slate-200 flex justify-end gap-3 bg-slate-50 rounded-b-lg">
                            <button onClick={handleCancel} className="bg-white hover:bg-slate-100 text-slate-700 font-semibold py-2 px-4 rounded-md border border-slate-300 transition">Cancel</button>
                            <button onClick={handleApply} className="bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2 px-4 rounded-md transition shadow-sm">Apply</button>
                        </footer>
                    </div>
                )}
            </div>
        );
    };

    const filterConfig: Omit<MultiSelectFilterProps, 'isOpen' | 'onToggle' | 'onClose'>[] = [
        { filterKey: 'year', label: 'Year', icon: <Calendar className="w-4 h-4" />, options: years.map(String) },
        { filterKey: 'month', label: 'Month', icon: <Calendar className="w-4 h-4" />, options: months },
        { filterKey: 'status', label: 'Status', icon: <Tag className="w-4 h-4" />, options: statuses },
        { filterKey: 'responsibleBy', label: 'Assignee', icon: <User className="w-4 h-4" />, options: assignees },
        { filterKey: 'companyName', label: 'Company', icon: <Building className="w-4 h-4" />, options: companies },
        { filterKey: 'brand1', label: 'Brand', icon: <Tag className="w-4 h-4" />, options: brands },
    ];

    return (
        <div ref={filterBarRef} className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex items-center gap-2">
            <div className="flex items-center gap-3 pr-3 border-r border-slate-200">
                <Filter className="w-5 h-5 text-brand-700 flex-shrink-0"/>
                <span className="text-sm font-semibold text-slate-800 hidden lg:block">Filters</span>
            </div>
            <div className="flex-1 flex flex-wrap items-center gap-2">
                <DateRangeFilterButton />
                {filterConfig.map(config => (
                    <MultiSelectFilter 
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
                    className="ml-auto flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors"
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