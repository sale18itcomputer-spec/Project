'use client';

import React, { useMemo, useState, memo, useCallback } from 'react';
import { useB2BData } from "../../../hooks/useB2BData";
import { useNavigation } from "../../../contexts/NavigationContext";
import { useAuth } from "../../../contexts/AuthContext";
import { parseDate } from "../../../utils/time";
import { PendingWorkItem as BasePendingWorkItem } from "../../../types";
import {
    FileText, ShoppingCart, Briefcase, FileCode, Calendar,
    ClipboardList, Clock, AlertCircle, ChevronRight,
    Search, X, ChevronDown, ChevronUp, Download,
    SlidersHorizontal, RefreshCw, ArrowUpDown, FilterX,
} from 'lucide-react';
import { cn } from "../../../lib/utils";

interface PendingWorkItem extends Omit<BasePendingWorkItem, 'icon'> {
    iconType: 'FileText' | 'ShoppingCart' | 'Briefcase' | 'FileCode' | 'Calendar';
}

const MS_PER_DAY = 1000 * 3600 * 24;
const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
type FilterType = 'all' | 'overdue' | 'today' | 'upcoming';
type SortType   = 'priority' | 'dueDate' | 'title' | 'type';
type ItemType   = PendingWorkItem['iconType'];

const ICON_MAP: Record<ItemType, React.ReactNode> = {
    FileText:     <FileText     className="h-3.5 w-3.5" />,
    ShoppingCart: <ShoppingCart className="h-3.5 w-3.5" />,
    Briefcase:    <Briefcase    className="h-3.5 w-3.5" />,
    FileCode:     <FileCode     className="h-3.5 w-3.5" />,
    Calendar:     <Calendar     className="h-3.5 w-3.5" />,
};

const TYPE_LABELS: Record<ItemType, string> = {
    FileText:     'Quotation',
    ShoppingCart: 'Order',
    Briefcase:    'Project',
    FileCode:     'Invoice',
    Calendar:     'Meeting',
};

// Accent colors per type — used for the left border & icon bg
const TYPE_ACCENT: Record<ItemType, { border: string; iconBg: string; iconText: string; badge: string }> = {
    FileText:     { border: 'border-l-violet-400', iconBg: 'bg-violet-50 dark:bg-violet-950/60',  iconText: 'text-violet-600 dark:text-violet-300', badge: 'bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300' },
    ShoppingCart: { border: 'border-l-blue-400',   iconBg: 'bg-blue-50 dark:bg-blue-950/60',      iconText: 'text-blue-600 dark:text-blue-300',     badge: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'     },
    Briefcase:    { border: 'border-l-amber-400',  iconBg: 'bg-amber-50 dark:bg-amber-950/60',    iconText: 'text-amber-600 dark:text-amber-300',   badge: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' },
    FileCode:     { border: 'border-l-emerald-400',iconBg: 'bg-emerald-50 dark:bg-emerald-950/60',iconText: 'text-emerald-600 dark:text-emerald-300',badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' },
    Calendar:     { border: 'border-l-rose-400',   iconBg: 'bg-rose-50 dark:bg-rose-950/60',      iconText: 'text-rose-600 dark:text-rose-300',     badge: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'     },
};

// ── Single item row ──────────────────────────────────────────────────────────
const PendingItem = memo(({ item, onClick }: { item: PendingWorkItem; onClick: (i: PendingWorkItem) => void }) => {
    const accent = TYPE_ACCENT[item.iconType];
    const isOverdue  = item.daysUntil < 0;
    const isToday    = item.daysUntil === 0;

    const dueDateStr = item.dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    return (
        <button
            onClick={() => onClick(item)}
            className={cn(
                'group w-full text-left flex items-center gap-3 px-4 py-3',
                'border-b border-border/40 last:border-b-0',
                'border-l-2 transition-all duration-150',
                'hover:bg-muted/40',
                accent.border,
            )}
        >
            {/* Icon */}
            <div className={cn(
                'h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform duration-150 group-hover:scale-105',
                accent.iconBg, accent.iconText,
            )}>
                {ICON_MAP[item.iconType]}
            </div>

            {/* Main content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-foreground truncate leading-tight group-hover:text-primary transition-colors">
                        {item.title}
                    </span>
                    {/* Type badge */}
                    <span className={cn('hidden sm:inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded-md flex-shrink-0', accent.badge)}>
                        {TYPE_LABELS[item.iconType]}
                    </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="truncate">{item.subtitle}</span>
                    <span className="text-border flex-shrink-0">·</span>
                    <span className="flex items-center gap-1 flex-shrink-0">
                        <Calendar className="h-3 w-3 opacity-50" />
                        {dueDateStr}
                        {item.time && <span className="text-primary/60 ml-0.5">{item.time}</span>}
                    </span>
                </div>
            </div>

            {/* Status / urgency badge */}
            <div className="flex items-center gap-2 flex-shrink-0">
                {isOverdue ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300">
                        <AlertCircle className="h-3 w-3" /> Overdue
                    </span>
                ) : isToday ? (
                    <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300">
                        Today
                    </span>
                ) : (
                    <span className="text-[10px] font-semibold px-2 py-1 rounded-md bg-muted text-muted-foreground">
                        {item.daysUntil}d
                    </span>
                )}
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-muted-foreground transition-all translate-x-1 group-hover:translate-x-0" />
            </div>
        </button>
    );
});
PendingItem.displayName = 'PendingItem';

// ── Collapsible group header ─────────────────────────────────────────────────
const GroupHeader = memo(({ label, count, collapsed, onToggle, variant }: {
    label: string; count: number; collapsed: boolean; onToggle: () => void;
    variant: 'overdue' | 'today' | 'upcoming';
}) => {
    const styles = {
        overdue:  { text: 'text-red-600 dark:text-red-400',    countBg: 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300',    icon: <AlertCircle className="h-3.5 w-3.5" /> },
        today:    { text: 'text-orange-600 dark:text-orange-400', countBg: 'bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300', icon: <Clock className="h-3.5 w-3.5" /> },
        upcoming: { text: 'text-blue-600 dark:text-blue-400',   countBg: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300',   icon: <Calendar className="h-3.5 w-3.5" /> },
    }[variant];

    return (
        <button
            onClick={onToggle}
            className="w-full sticky top-0 z-10 flex items-center gap-2 px-4 py-2 bg-muted/60 backdrop-blur-sm border-b border-border/50 hover:bg-muted/80 transition-colors"
        >
            <span className={cn('flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider', styles.text)}>
                {styles.icon}
                {label}
            </span>
            <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full', styles.countBg)}>
                {count}
            </span>
            <span className="flex-1" />
            {collapsed
                ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                : <ChevronUp   className="h-3.5 w-3.5 text-muted-foreground" />}
        </button>
    );
});
GroupHeader.displayName = 'GroupHeader';

// ── Main component ───────────────────────────────────────────────────────────
const PendingWorks: React.FC = () => {
    const { quotations, saleOrders, projects, invoices, meetings } = useB2BData();
    const { handleNavigation } = useNavigation();
    const { currentUser } = useAuth();

    const [activeFilter,    setActiveFilter]    = useState<FilterType>('all');
    const [searchQuery,     setSearchQuery]     = useState('');
    const [sortBy,          setSortBy]          = useState<SortType>('priority');
    const [sortAsc,         setSortAsc]         = useState(true);
    const [typeFilters,     setTypeFilters]     = useState<Set<ItemType>>(new Set());
    const [showFilters,     setShowFilters]     = useState(false);
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

    // ── Build items ──────────────────────────────────────────────────────────
    const pendingItems = useMemo(() => {
        const items: PendingWorkItem[] = [];
        const now       = new Date();
        const todayTime = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const today     = new Date(todayTime);

        const isAdmin  = currentUser?.Role === 'Admin';
        const userName = currentUser?.Name;
        const canView  = (ownerName?: string) => isAdmin || ownerName === userName;

        if (quotations) {
            for (const q of quotations) {
                if (q.Status === 'Open' && canView(q['Prepared By'] || q['Created By'])) {
                    const dueDate = parseDate(q['Validity Date']) || today;
                    const diff    = Math.ceil((dueDate.getTime() - todayTime) / MS_PER_DAY);
                    items.push({ id: q['Quote No'], type: 'quotation', title: `Quotation ${q['Quote No']}`, subtitle: q['Company Name'], dueDate, date: q['Quote Date'], time: '', status: q.Status, priority: diff < 0 ? 'critical' : diff <= 3 ? 'high' : 'medium', daysUntil: diff, iconType: 'FileText', link: 'quotations' });
                }
            }
        }
        if (saleOrders) {
            for (const so of saleOrders) {
                if (so.Status === 'Pending' && canView(so['Prepared By'] || so['Created By'])) {
                    const dueDate = parseDate(so['Delivery Date']) || today;
                    const diff    = Math.ceil((dueDate.getTime() - todayTime) / MS_PER_DAY);
                    items.push({ id: so['SO No'], type: 'saleOrder', title: `Order ${so['SO No']}`, subtitle: so['Company Name'], dueDate, date: so['SO Date'], time: '', status: so.Status, priority: diff < 0 ? 'critical' : diff <= 2 ? 'high' : 'medium', daysUntil: diff, iconType: 'ShoppingCart', link: 'sale-orders' });
                }
            }
        }
        if (projects) {
            for (const p of projects) {
                if (!['Closure (Win)', 'Closure (Lose)'].includes(p.Status) && canView(p['Responsible By'])) {
                    const dueDate = parseDate(p['Due Date']) || today;
                    const diff    = Math.ceil((dueDate.getTime() - todayTime) / MS_PER_DAY);
                    items.push({ id: p['Pipeline No'], type: 'pipeline', title: `Project ${p['Pipeline No']}`, subtitle: p['Company Name'], dueDate, date: p['Created Date'], time: '', status: p.Status, priority: diff < 0 ? 'critical' : diff <= 5 ? 'high' : 'medium', daysUntil: diff, iconType: 'Briefcase', link: 'projects' });
                }
            }
        }
        if (invoices) {
            for (const inv of invoices) {
                if ((inv.Status === 'Draft' || inv.Status === 'Processing') && canView(inv['Created By'])) {
                    items.push({ id: inv['Inv No'], type: 'invoice', title: `Invoice ${inv['Inv No']}`, subtitle: inv['Company Name'], dueDate: today, date: inv['Inv Date'], time: '', status: inv.Status, priority: inv.Status === 'Processing' ? 'high' : 'low', daysUntil: 0, iconType: 'FileCode', link: 'invoices' });
                }
            }
        }
        if (meetings) {
            for (let i = 0; i < meetings.length; i++) {
                const m = meetings[i];
                if (m.Status === 'Open' && canView(m['Responsible By'])) {
                    const mDate = parseDate(m['Meeting Date']) || today;
                    if (mDate >= today) {
                        const diff = Math.ceil((mDate.getTime() - todayTime) / MS_PER_DAY);
                        items.push({ id: m['Meeting ID'] || `meeting-${i}`, type: 'meeting', title: `Meeting: ${m['Company Name']}`, subtitle: m.Participants, dueDate: mDate, date: m['Meeting Date'], time: m['Start Time'], status: m.Status, priority: diff === 0 ? 'critical' : diff === 1 ? 'high' : 'medium', daysUntil: diff, iconType: 'Calendar', link: 'meetings' });
                    }
                }
            }
        }
        return items;
    }, [quotations, saleOrders, projects, invoices, meetings, currentUser]);

    // ── Filter + sort ────────────────────────────────────────────────────────
    const filteredItems = useMemo(() => {
        let list = [...pendingItems];
        if (activeFilter !== 'all') {
            list = list.filter(i =>
                activeFilter === 'overdue'  ? i.daysUntil < 0  :
                activeFilter === 'today'    ? i.daysUntil === 0 :
                i.daysUntil > 0
            );
        }
        if (typeFilters.size > 0) list = list.filter(i => typeFilters.has(i.iconType));
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter(i =>
                i.title.toLowerCase().includes(q) ||
                i.subtitle.toLowerCase().includes(q) ||
                i.status.toLowerCase().includes(q)
            );
        }
        list.sort((a, b) => {
            let cmp = 0;
            if      (sortBy === 'priority') cmp = (PRIORITY_ORDER[a.priority] ?? 4) - (PRIORITY_ORDER[b.priority] ?? 4);
            else if (sortBy === 'dueDate')  cmp = a.dueDate.getTime() - b.dueDate.getTime();
            else if (sortBy === 'title')    cmp = a.title.localeCompare(b.title);
            else if (sortBy === 'type')     cmp = a.iconType.localeCompare(b.iconType);
            return sortAsc ? cmp : -cmp;
        });
        return list;
    }, [pendingItems, activeFilter, typeFilters, searchQuery, sortBy, sortAsc]);

    const groupedItems = useMemo(() => ({
        overdue:  filteredItems.filter(i => i.daysUntil < 0),
        today:    filteredItems.filter(i => i.daysUntil === 0),
        upcoming: filteredItems.filter(i => i.daysUntil > 0),
    }), [filteredItems]);

    const typeCounts = useMemo(() => {
        const counts: Partial<Record<ItemType, number>> = {};
        for (const i of pendingItems) counts[i.iconType] = (counts[i.iconType] ?? 0) + 1;
        return counts;
    }, [pendingItems]);

    // ── Handlers ─────────────────────────────────────────────────────────────
    const handleItemClick = useCallback((item: PendingWorkItem) => {
        switch (item.type) {
            case 'quotation': handleNavigation({ view: 'quotations', action: 'view', id: item.id }); break;
            case 'saleOrder': handleNavigation({ view: 'sale-orders', payload: { action: 'view', data: { 'SO No': item.id } } }); break;
            case 'pipeline':  handleNavigation({ view: 'projects',    filter: item.id }); break;
            case 'invoice':   handleNavigation({ view: 'invoices',  payload: { action: 'view', data: { 'Inv No': item.id } } }); break;
            case 'meeting':   handleNavigation({ view: 'meetings',    filter: item.id }); break;
            default:          handleNavigation({ view: item.link as any });
        }
    }, [handleNavigation]);

    const toggleType = useCallback((t: ItemType) => {
        setTypeFilters(prev => { const next = new Set(prev); next.has(t) ? next.delete(t) : next.add(t); return next; });
    }, []);

    const toggleSort = useCallback((s: SortType) => {
        setSortBy(prev => { if (prev === s) { setSortAsc(a => !a); return prev; } setSortAsc(true); return s; });
    }, []);

    const toggleGroup = useCallback((key: string) => {
        setCollapsedGroups(prev => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next; });
    }, []);

    const handleReset = useCallback(() => {
        setActiveFilter('all'); setSearchQuery(''); setSortBy('priority');
        setSortAsc(true); setTypeFilters(new Set()); setCollapsedGroups(new Set());
    }, []);

    const handleExport = useCallback(() => {
        const rows = [
            ['Title', 'Company', 'Type', 'Status', 'Due Date', 'Priority', 'Days Until'],
            ...filteredItems.map(i => [
                i.title, i.subtitle, TYPE_LABELS[i.iconType], i.status,
                i.dueDate.toLocaleDateString(), i.priority, String(i.daysUntil),
            ]),
        ];
        const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
        a.download = 'pending-works.csv';
        a.click();
    }, [filteredItems]);

    const hasAnyItems = pendingItems.length > 0;
    const isFiltered  = !!(searchQuery || typeFilters.size > 0 || activeFilter !== 'all');

    const SORT_OPTIONS: { key: SortType; label: string }[] = [
        { key: 'priority', label: 'Priority' },
        { key: 'dueDate',  label: 'Due Date' },
        { key: 'title',    label: 'Name'     },
        { key: 'type',     label: 'Type'     },
    ];

    const renderGroup = (key: 'overdue' | 'today' | 'upcoming', group: PendingWorkItem[], label: string) => {
        if (group.length === 0) return null;
        const collapsed = collapsedGroups.has(key);
        return (
            <div key={key}>
                <GroupHeader
                    label={label} count={group.length}
                    collapsed={collapsed} onToggle={() => toggleGroup(key)}
                    variant={key}
                />
                {!collapsed && group.map(item =>
                    <PendingItem key={`${item.type}-${item.id}`} item={item} onClick={handleItemClick} />
                )}
            </div>
        );
    };

    return (
        <div className="bg-card rounded-xl border border-border shadow-sm flex flex-col overflow-hidden h-full">

            {/* ── Header ── */}
            <div className="flex-shrink-0 border-b border-border bg-card">

                {/* Title row */}
                <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Clock className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider leading-none mb-0.5">Workflow Status</p>
                            <h3 className="text-sm font-bold text-foreground flex items-center gap-2 leading-none">
                                Pending Works
                                {hasAnyItems && (
                                    <span className="px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold leading-none">
                                        {pendingItems.length}
                                    </span>
                                )}
                            </h3>
                        </div>
                    </div>

                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setShowFilters(v => !v)}
                            className={cn(
                                'h-7 w-7 flex items-center justify-center rounded-lg border text-xs transition-all',
                                showFilters
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'text-muted-foreground border-border hover:bg-muted'
                            )}
                            title="Filters & Sort"
                        >
                            <SlidersHorizontal className="h-3.5 w-3.5" />
                        </button>
                        <button
                            onClick={handleExport}
                            className="h-7 w-7 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted transition-all"
                            title="Export CSV"
                        >
                            <Download className="h-3.5 w-3.5" />
                        </button>
                        {isFiltered && (
                            <button
                                onClick={handleReset}
                                className="h-7 w-7 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted transition-all"
                                title="Reset filters"
                            >
                                <RefreshCw className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Summary tabs */}
                {hasAnyItems && (
                    <div className="flex border-t border-border/50">
                        {([
                            { key: 'overdue',  label: 'Overdue',  count: groupedItems.overdue.length,  active: 'border-b-red-500 text-red-600 dark:text-red-400',       count_cls: 'text-red-500'    },
                            { key: 'today',    label: 'Today',    count: groupedItems.today.length,    active: 'border-b-orange-500 text-orange-600 dark:text-orange-400', count_cls: 'text-orange-500' },
                            { key: 'upcoming', label: 'Upcoming', count: groupedItems.upcoming.length, active: 'border-b-blue-500 text-blue-600 dark:text-blue-400',    count_cls: 'text-blue-500'   },
                        ] as const).map(({ key, label, count, active, count_cls }) => (
                            <button
                                key={key}
                                onClick={() => setActiveFilter(prev => prev === key ? 'all' : key as FilterType)}
                                className={cn(
                                    'flex-1 flex flex-col items-center py-2 text-center border-b-2 transition-all text-xs',
                                    activeFilter === key
                                        ? cn('bg-muted/40', active)
                                        : 'border-b-transparent text-muted-foreground hover:bg-muted/30 hover:text-foreground'
                                )}
                            >
                                <span className={cn('text-base font-black leading-tight', activeFilter === key ? count_cls : '')}>{count}</span>
                                <span className="text-[10px] font-medium uppercase tracking-wide leading-tight">{label}</span>
                            </button>
                        ))}
                    </div>
                )}

                {/* Filter panel */}
                {showFilters && (
                    <div className="px-4 py-3 border-t border-border/50 space-y-3 bg-muted/20">
                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
                            <input
                                type="text"
                                placeholder="Search title, company, status…"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-8 pr-8 py-1.5 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                            />
                            {searchQuery && (
                                <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                    <X className="h-3 w-3" />
                                </button>
                            )}
                        </div>

                        {/* Sort */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mr-1">
                                <ArrowUpDown className="h-3 w-3" /> Sort
                            </span>
                            {SORT_OPTIONS.map(({ key, label }) => (
                                <button
                                    key={key}
                                    onClick={() => toggleSort(key)}
                                    className={cn(
                                        'text-[10px] px-2 py-1 rounded-md border font-semibold transition-all flex items-center gap-1',
                                        sortBy === key
                                            ? 'bg-primary text-primary-foreground border-primary'
                                            : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                                    )}
                                >
                                    {label}
                                    {sortBy === key && <span className="text-[8px]">{sortAsc ? '↑' : '↓'}</span>}
                                </button>
                            ))}
                        </div>

                        {/* Type chips */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mr-1">
                                <FilterX className="h-3 w-3" /> Type
                            </span>
                            {(Object.keys(TYPE_LABELS) as ItemType[]).map(t => {
                                const cnt = typeCounts[t] ?? 0;
                                if (cnt === 0) return null;
                                const active = typeFilters.has(t);
                                return (
                                    <button
                                        key={t}
                                        onClick={() => toggleType(t)}
                                        className={cn(
                                            'text-[10px] px-2 py-1 rounded-full border font-semibold transition-all flex items-center gap-1',
                                            active
                                                ? cn(TYPE_ACCENT[t].badge, 'ring-1 ring-current border-transparent')
                                                : 'border-border text-muted-foreground hover:bg-muted'
                                        )}
                                    >
                                        {TYPE_LABELS[t]} <span className="opacity-60">{cnt}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* ── List ── */}
            <div className="flex-grow overflow-y-auto custom-scrollbar">
                {filteredItems.length > 0 ? (
                    <div>
                        {(activeFilter === 'all' || activeFilter === 'overdue')  && renderGroup('overdue',  groupedItems.overdue,  'Overdue Items')}
                        {(activeFilter === 'all' || activeFilter === 'today')    && renderGroup('today',    groupedItems.today,    'Due Today')}
                        {(activeFilter === 'all' || activeFilter === 'upcoming') && renderGroup('upcoming', groupedItems.upcoming, 'Upcoming')}
                    </div>
                ) : hasAnyItems ? (
                    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                        <Search className="h-8 w-8 text-muted-foreground/20 mb-3" />
                        <p className="text-sm font-semibold text-foreground">No results</p>
                        <p className="text-xs text-muted-foreground mt-1">Try adjusting your search or filters.</p>
                        <button onClick={handleReset} className="mt-3 text-xs text-primary font-semibold hover:underline flex items-center gap-1">
                            <RefreshCw className="h-3 w-3" /> Reset
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full py-20 px-6 text-center">
                        <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                            <ClipboardList className="h-8 w-8 text-muted-foreground/30" />
                        </div>
                        <p className="text-sm font-bold text-foreground mb-1">All caught up!</p>
                        <p className="text-xs text-muted-foreground max-w-[180px] leading-relaxed">
                            No pending items. Good job managing your workflow.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PendingWorks;
