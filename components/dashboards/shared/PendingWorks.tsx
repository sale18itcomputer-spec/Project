'use client';

import React, { useMemo, useState, memo } from 'react';
import { useB2BData } from "../../../hooks/useB2BData";
import { useNavigation } from "../../../contexts/NavigationContext";
import { useAuth } from "../../../contexts/AuthContext";
import { parseDate } from "../../../utils/time";
import { PendingWorkItem as BasePendingWorkItem } from "../../../types";
import {
    FileText,
    ShoppingCart,
    Briefcase,
    FileCode,
    Calendar,
    ClipboardList,
    Clock,
    AlertCircle,
    ChevronRight,
    FilterX
} from 'lucide-react';
import { cn } from "../../../lib/utils";

interface PendingWorkItem extends Omit<BasePendingWorkItem, 'icon'> {
    iconType: 'FileText' | 'ShoppingCart' | 'Briefcase' | 'FileCode' | 'Calendar';
}

// ---------------------------------------------------------------------------
// PendingItemTitle — no DOM measurement, no useEffect, no library dependency.
// Simply truncates with CSS. Visually identical for list items.
// ---------------------------------------------------------------------------
const PendingItemTitle = memo(({ title }: { title: string }) => (
    <h4 className="font-bold text-sm truncate group-hover:text-primary transition-colors leading-tight">
        {title}
    </h4>
));
PendingItemTitle.displayName = 'PendingItemTitle';

const MS_PER_DAY = 1000 * 3600 * 24;
const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

type FilterType = 'all' | 'overdue' | 'today' | 'upcoming';

// ---------------------------------------------------------------------------
// Stable icon map — avoids a switch statement on every render
// ---------------------------------------------------------------------------
const ICON_MAP: Record<PendingWorkItem['iconType'], React.ReactNode> = {
    FileText:     <FileText    className="h-4 w-4" />,
    ShoppingCart: <ShoppingCart className="h-4 w-4" />,
    Briefcase:    <Briefcase   className="h-4 w-4" />,
    FileCode:     <FileCode    className="h-4 w-4" />,
    Calendar:     <Calendar    className="h-4 w-4" />,
};

// ---------------------------------------------------------------------------
// Style helpers — defined once outside the component
// ---------------------------------------------------------------------------
function getPriorityStyles(priority: string): string {
    switch (priority) {
        case 'critical': return 'border-red-500/50 bg-red-500/5 text-red-600 dark:text-red-400';
        case 'high':     return 'border-orange-500/50 bg-orange-500/5 text-orange-600 dark:text-orange-400';
        case 'medium':   return 'border-blue-500/50 bg-blue-500/5 text-blue-600 dark:text-blue-400';
        case 'low':      return 'border-slate-500/50 bg-slate-500/5 text-slate-600 dark:text-slate-400';
        default:         return 'border-border bg-muted/50 text-muted-foreground';
    }
}

function getIndicatorColor(priority: string): string {
    switch (priority) {
        case 'critical': return 'bg-red-500';
        case 'high':     return 'bg-orange-500';
        case 'medium':   return 'bg-blue-500';
        default:         return 'bg-slate-400';
    }
}

// ---------------------------------------------------------------------------
// PendingItem — memoized so it only re-renders if the item object changes
// ---------------------------------------------------------------------------
const PendingItem = memo(({ item, onClick }: { item: PendingWorkItem; onClick: (item: PendingWorkItem) => void }) => (
    <button
        onClick={() => onClick(item)}
        className="w-full text-left p-4 hover:bg-muted/30 transition-all flex items-start gap-4 group relative border-b last:border-b-0"
    >
        <div className={cn(
            "absolute left-0 top-0 bottom-0 w-1 transition-all duration-300 opacity-0 group-hover:opacity-100",
            getIndicatorColor(item.priority)
        )} />

        <div className={cn(
            "mt-0.5 p-2.5 rounded-xl border-2 transition-all duration-300 shadow-sm flex-shrink-0",
            getPriorityStyles(item.priority),
            "group-hover:scale-110 group-hover:shadow-md"
        )}>
            {ICON_MAP[item.iconType]}
        </div>

        <div className="flex-grow min-w-0 py-0.5">
            <div className="flex justify-between items-start gap-2 mb-1">
                <PendingItemTitle title={item.title} />
                {item.daysUntil < 0 ? (
                    <span className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase tracking-wider flex items-center gap-1 bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded flex-shrink-0">
                        <AlertCircle className="h-3 w-3" />Overdue
                    </span>
                ) : item.daysUntil === 0 ? (
                    <span className="text-[10px] font-black text-orange-600 dark:text-orange-400 uppercase tracking-wider bg-orange-100 dark:bg-orange-900/30 px-1.5 py-0.5 rounded flex-shrink-0">
                        Today
                    </span>
                ) : (
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest bg-muted px-1.5 py-0.5 rounded flex-shrink-0">
                        {item.daysUntil}d
                    </span>
                )}
            </div>

            <p className="text-xs text-muted-foreground/80 truncate font-medium mb-2">{item.subtitle}</p>

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 font-bold text-primary border border-primary/20">
                        {item.status}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1.5">
                        <Calendar className="h-3 w-3 opacity-60" />
                        {item.dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {item.time && <><span className="text-muted-foreground/40">•</span><span className="text-primary/70">{item.time}</span></>}
                    </span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0" />
            </div>
        </div>
    </button>
));
PendingItem.displayName = 'PendingItem';

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
const PendingWorks: React.FC = () => {
    const { quotations, saleOrders, projects, invoices, meetings } = useB2BData();
    const { handleNavigation } = useNavigation();
    const { currentUser } = useAuth();

    const [activeFilter, setActiveFilter] = useState<FilterType>('all');

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
                const status = (p.Status || '').toLowerCase();
                if (!status.includes('close') && canView(p['Responsible By'])) {
                    const dueDate = parseDate(p['Due Date']) || today;
                    const diff    = Math.ceil((dueDate.getTime() - todayTime) / MS_PER_DAY);
                    items.push({ id: p['Pipeline No'], type: 'pipeline', title: `Project ${p['Pipeline No']}`, subtitle: p['Company Name'], dueDate, date: p['Created Date'], time: '', status: p.Status, priority: diff < 0 ? 'critical' : diff <= 5 ? 'high' : 'medium', daysUntil: diff, iconType: 'Briefcase', link: 'projects' });
                }
            }
        }

        if (invoices) {
            for (const inv of invoices) {
                if ((inv.Status === 'Draft' || inv.Status === 'Processing') && canView(inv['Created By'])) {
                    items.push({ id: inv['Inv No'], type: 'invoice', title: `Invoice ${inv['Inv No']}`, subtitle: inv['Company Name'], dueDate: today, date: inv['Inv Date'], time: '', status: inv.Status, priority: inv.Status === 'Processing' ? 'high' : 'low', daysUntil: 0, iconType: 'FileCode', link: 'invoice-do' });
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

        return items.sort((a, b) => {
            const pa = PRIORITY_ORDER[a.priority] ?? 4;
            const pb = PRIORITY_ORDER[b.priority] ?? 4;
            return pa !== pb ? pa - pb : a.dueDate.getTime() - b.dueDate.getTime();
        });
    }, [quotations, saleOrders, projects, invoices, meetings, currentUser]);

    const groupedItems = useMemo(() => {
        const groups = { overdue: [] as PendingWorkItem[], today: [] as PendingWorkItem[], upcoming: [] as PendingWorkItem[] };
        for (const item of pendingItems) {
            if      (item.daysUntil < 0) groups.overdue.push(item);
            else if (item.daysUntil === 0) groups.today.push(item);
            else                           groups.upcoming.push(item);
        }
        return groups;
    }, [pendingItems]);

    const handleItemClick = (item: PendingWorkItem) => {
        switch (item.type) {
            case 'quotation': handleNavigation({ view: 'quotations', action: 'view', id: item.id }); break;
            case 'saleOrder': handleNavigation({ view: 'sale-orders', payload: { action: 'view', data: { 'SO No': item.id } } }); break;
            case 'pipeline':  handleNavigation({ view: 'projects',    filter: item.id }); break;
            case 'invoice':   handleNavigation({ view: 'invoice-do',  payload: { action: 'view', data: { 'Inv No': item.id } } }); break;
            case 'meeting':   handleNavigation({ view: 'meetings',    filter: item.id }); break;
            default:          handleNavigation({ view: item.link as any });
        }
    };

    const hasAnyItems = pendingItems.length > 0;
    const toggleFilter = (f: FilterType) => setActiveFilter(prev => prev === f ? 'all' : f);

    const renderGroup = (group: PendingWorkItem[], label: string, labelClass: string, bgClass: string, headerBgClass: string, icon: React.ReactNode) => {
        if (group.length === 0) return null;
        return (
            <div className={bgClass}>
                <div className={`sticky top-0 z-10 px-4 py-2 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border-y backdrop-blur-md ${headerBgClass} ${labelClass}`}>
                    {icon}{label}
                </div>
                {group.map(item => <PendingItem key={`${item.type}-${item.id}`} item={item} onClick={handleItemClick} />)}
            </div>
        );
    };

    return (
        <div className="bg-card rounded-xl border shadow-sm flex flex-col overflow-hidden h-full">
            <div className="p-6 pb-4 flex-shrink-0 border-b border-border/50 bg-card/50 backdrop-blur-sm relative z-10">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-inner">
                            <Clock className="h-5 w-5 text-primary animate-pulse" />
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Workflow Status</h4>
                            <h3 className="text-lg font-extrabold text-foreground flex items-center gap-2">
                                Pending Works
                                {hasAnyItems && (
                                    <span className="px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                                        {pendingItems.length}
                                    </span>
                                )}
                            </h3>
                        </div>
                    </div>
                    {activeFilter !== 'all' && (
                        <button onClick={() => setActiveFilter('all')} className="text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted px-2 py-1 rounded-md transition-all font-semibold">
                            <FilterX className="h-3 w-3" /> Clear
                        </button>
                    )}
                </div>

                {hasAnyItems && (
                    <div className="flex gap-4 pt-3 border-t border-dashed border-muted-foreground/10">
                        {([
                            { key: 'overdue',  label: 'Overdue',  count: groupedItems.overdue.length,  activeClass: 'bg-red-500/10',    textClass: 'text-red-600 dark:text-red-400',       countClass: groupedItems.overdue.length  > 0 ? 'text-red-500'    : 'text-muted-foreground' },
                            { key: 'today',    label: 'Today',    count: groupedItems.today.length,    activeClass: 'bg-orange-500/10', textClass: 'text-orange-600 dark:text-orange-400', countClass: groupedItems.today.length    > 0 ? 'text-orange-500' : 'text-muted-foreground' },
                            { key: 'upcoming', label: 'Upcoming', count: groupedItems.upcoming.length, activeClass: 'bg-blue-500/10',   textClass: 'text-blue-600 dark:text-blue-400',    countClass: 'text-blue-500' },
                        ] as const).map(({ key, label, count, activeClass, textClass, countClass }) => (
                            <button key={key} onClick={() => toggleFilter(key)}
                                className={cn('flex flex-col items-start px-2 py-1 rounded-md transition-colors text-left group', activeFilter === key ? activeClass : 'hover:bg-muted/50', key === 'overdue' && '-ml-2')}>
                                <span className={cn('text-[10px] font-bold uppercase transition-colors', activeFilter === key ? textClass : 'text-muted-foreground opacity-60 group-hover:opacity-100')}>{label}</span>
                                <span className={cn('text-xs font-black transition-colors', countClass)}>{count}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex-grow overflow-y-auto custom-scrollbar bg-background/30">
                {hasAnyItems ? (
                    <div className="flex flex-col">
                        {(activeFilter === 'all' || activeFilter === 'overdue') && renderGroup(groupedItems.overdue, 'Overdue Items', 'text-red-600 dark:text-red-400', 'bg-red-50/30 dark:bg-red-950/10', 'bg-red-50/90 dark:bg-red-950/90', <AlertCircle className="h-3 w-3" />)}
                        {(activeFilter === 'all' || activeFilter === 'today')   && renderGroup(groupedItems.today,   'Due Today',    'text-orange-600 dark:text-orange-400', 'bg-orange-50/30 dark:bg-orange-950/10', 'bg-orange-50/90 dark:bg-orange-950/90', <Clock className="h-3 w-3" />)}
                        {(activeFilter === 'all' || activeFilter === 'upcoming') && renderGroup(groupedItems.upcoming,'Upcoming Tasks','text-blue-600 dark:text-blue-400', '', 'bg-blue-50/90 dark:bg-blue-950/90', <Calendar className="h-3 w-3" />)}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 px-6 text-center h-full">
                        <div className="relative mb-6">
                            <div className="h-24 w-24 rounded-full bg-primary/5 flex items-center justify-center animate-pulse">
                                <ClipboardList className="h-12 w-12 text-primary/20" />
                            </div>
                            <div className="absolute -right-2 -bottom-2 h-10 w-10 rounded-full bg-background border-4 border-background shadow-lg flex items-center justify-center">
                                <Clock className="h-5 w-5 text-primary" />
                            </div>
                        </div>
                        <h3 className="text-lg font-bold text-foreground mb-1">All caught up!</h3>
                        <p className="text-sm text-muted-foreground max-w-[200px] font-medium leading-relaxed">
                            No pending items found. Good job managing your workflow.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PendingWorks;
