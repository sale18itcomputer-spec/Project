'use client';

import React, { useMemo } from 'react';
import { useB2BData } from "../../hooks/useB2BData";
import { useNavigation } from "../../contexts/NavigationContext";
import { useAuth } from "../../contexts/AuthContext";
import { parseDate } from "../../utils/time";
import { PendingWorkItem } from "../../types";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription
} from "../ui/card";
import {
    FileText,
    ShoppingCart,
    Briefcase,
    FileCode,
    Calendar,
    ClipboardList,
    Clock,
    AlertCircle,
    ChevronRight
} from 'lucide-react';
import { cn } from "../../lib/utils";

const PendingWorks: React.FC = () => {
    const { quotations, saleOrders, projects, invoices, meetings } = useB2BData();
    const { handleNavigation } = useNavigation();
    const { currentUser } = useAuth();

    const pendingItems = useMemo(() => {
        const items: PendingWorkItem[] = [];
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const canView = (ownerName?: string) => {
            if (currentUser?.Role === 'Admin') return true;
            return ownerName === currentUser?.Name;
        };

        // 1. Quotations (Open)
        quotations?.forEach(q => {
            if (q.Status === 'Open' && canView(q['Prepared By'] || q['Created By'])) {
                const dueDate = parseDate(q['Validity Date']) || today;
                const diff = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
                items.push({
                    id: q['Quote No.'],
                    type: 'quotation',
                    title: `Quotation ${q['Quote No.']}`,
                    subtitle: q['Company Name'],
                    dueDate,
                    date: q['Quote Date'],
                    time: '',
                    status: q.Status,
                    priority: diff < 0 ? 'critical' : diff <= 3 ? 'high' : 'medium',
                    daysUntil: diff,
                    icon: <FileText className="h-4 w-4" />,
                    link: 'quotations'
                });
            }
        });

        // 2. Sale Orders (Pending)
        saleOrders?.forEach(so => {
            if (so.Status === 'Pending' && canView(so['Prepared By'] || so['Created By'])) {
                const dueDate = parseDate(so['Delivery Date']) || today;
                const diff = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
                items.push({
                    id: so['SO No.'],
                    type: 'saleOrder',
                    title: `Order ${so['SO No.']}`,
                    subtitle: so['Company Name'],
                    dueDate,
                    date: so['SO Date'],
                    time: '',
                    status: so.Status,
                    priority: diff < 0 ? 'critical' : diff <= 2 ? 'high' : 'medium',
                    daysUntil: diff,
                    icon: <ShoppingCart className="h-4 w-4" />,
                    link: 'sale-orders'
                });
            }
        });

        // 3. Pipelines/Projects (Active)
        projects?.forEach(p => {
            const status = p.Status?.toLowerCase() || '';
            if (!status.includes('close') && canView(p['Responsible By'])) {
                const dueDate = parseDate(p['Due Date']) || today;
                const diff = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
                items.push({
                    id: p['Pipeline No.'],
                    type: 'pipeline',
                    title: `Project ${p['Pipeline No.']}`,
                    subtitle: p['Company Name'],
                    dueDate,
                    date: p['Created Date'],
                    time: '',
                    status: p.Status,
                    priority: diff < 0 ? 'critical' : diff <= 5 ? 'high' : 'medium',
                    daysUntil: diff,
                    icon: <Briefcase className="h-4 w-4" />,
                    link: 'projects'
                });
            }
        });

        // 4. Invoices (Draft/Processing)
        invoices?.forEach(inv => {
            if (['Draft', 'Processing'].includes(inv.Status) && canView(inv['Created By'])) {
                items.push({
                    id: inv['Inv No.'],
                    type: 'invoice',
                    title: `Invoice ${inv['Inv No.']}`,
                    subtitle: inv['Company Name'],
                    dueDate: today,
                    date: inv['Inv Date'],
                    time: '',
                    status: inv.Status,
                    priority: inv.Status === 'Processing' ? 'high' : 'low',
                    daysUntil: 0,
                    icon: <FileCode className="h-4 w-4" />,
                    link: 'invoice-do'
                });
            }
        });

        // 5. Meetings (Upcoming)
        meetings?.forEach(m => {
            if (m.Status === 'Open' && canView(m['Responsible By'])) {
                const mDate = parseDate(m['Meeting Date']) || today;
                if (mDate >= today) {
                    const diff = Math.ceil((mDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
                    items.push({
                        id: m['Meeting ID'] || Math.random().toString(),
                        type: 'meeting',
                        title: `Meeting: ${m['Company Name']}`,
                        subtitle: m.Participants,
                        dueDate: mDate,
                        date: m['Meeting Date'],
                        time: m['Start Time'],
                        status: m.Status,
                        priority: diff === 0 ? 'critical' : diff === 1 ? 'high' : 'medium',
                        daysUntil: diff,
                        icon: <Calendar className="h-4 w-4" />,
                        link: 'meetings'
                    });
                }
            }
        });

        return items.sort((a, b) => {
            const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
            if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
                return priorityOrder[a.priority] - priorityOrder[b.priority];
            }
            return a.dueDate.getTime() - b.dueDate.getTime();
        });
    }, [quotations, saleOrders, projects, invoices, meetings, currentUser]);

    const groupedItems = useMemo(() => {
        return {
            overdue: pendingItems.filter(i => i.daysUntil < 0),
            today: pendingItems.filter(i => i.daysUntil === 0),
            upcoming: pendingItems.filter(i => i.daysUntil > 0)
        };
    }, [pendingItems]);

    const getPriorityStyles = (priority: string) => {
        switch (priority) {
            case 'critical': return 'border-red-500/50 bg-red-500/5 text-red-600 dark:text-red-400';
            case 'high': return 'border-orange-500/50 bg-orange-500/5 text-orange-600 dark:text-orange-400';
            case 'medium': return 'border-blue-500/50 bg-blue-500/5 text-blue-600 dark:text-blue-400';
            case 'low': return 'border-slate-500/50 bg-slate-500/5 text-slate-600 dark:text-slate-400';
            default: return 'border-border bg-muted/50 text-muted-foreground';
        }
    };

    const getIndicatorColor = (priority: string) => {
        switch (priority) {
            case 'critical': return 'bg-red-500';
            case 'high': return 'bg-orange-500';
            case 'medium': return 'bg-blue-500';
            default: return 'bg-slate-400';
        }
    };

    const handleItemClick = (item: PendingWorkItem) => {
        switch (item.type) {
            case 'quotation':
                handleNavigation({
                    view: 'quotations',
                    payload: { action: 'view', data: { 'Quote No.': item.id } }
                });
                break;
            case 'saleOrder':
                handleNavigation({
                    view: 'sale-orders',
                    payload: { action: 'view', data: { 'SO No.': item.id } }
                });
                break;
            case 'pipeline':
                handleNavigation({
                    view: 'projects',
                    filter: item.id
                });
                break;
            case 'invoice':
                handleNavigation({
                    view: 'invoice-do',
                    payload: { action: 'view', data: { 'Inv No.': item.id } }
                });
                break;
            case 'meeting':
                handleNavigation({
                    view: 'meetings',
                    filter: item.id
                });
                break;
            default:
                handleNavigation({ view: item.link as any });
        }
    };

    const renderItem = (item: PendingWorkItem) => (
        <button
            key={`${item.type}-${item.id}`}
            onClick={() => handleItemClick(item)}
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
                {item.icon}
            </div>

            <div className="flex-grow min-w-0 py-0.5">
                <div className="flex justify-between items-start gap-2 mb-1">
                    <h4 className="font-bold text-sm truncate group-hover:text-primary transition-colors leading-tight">
                        {item.title}
                    </h4>
                    {item.daysUntil < 0 ? (
                        <span className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase tracking-wider flex items-center gap-1 bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded">
                            <AlertCircle className="h-3 w-3" />
                            Overdue
                        </span>
                    ) : item.daysUntil === 0 ? (
                        <span className="text-[10px] font-black text-orange-600 dark:text-orange-400 uppercase tracking-wider bg-orange-100 dark:bg-orange-900/30 px-1.5 py-0.5 rounded">
                            Today
                        </span>
                    ) : (
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest bg-muted px-1.5 py-0.5 rounded">
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
                            {item.time && <span className="text-muted-foreground/40">•</span>}
                            {item.time && <span className="text-primary/70">{item.time}</span>}
                        </span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0" />
                </div>
            </div>
        </button>
    );

    const hasAnyItems = pendingItems.length > 0;

    return (
        <Card className="h-full flex flex-col overflow-hidden border-none shadow-xl bg-gradient-to-br from-card to-background/50">
            <CardHeader className="flex-shrink-0 border-b bg-card/50 backdrop-blur-sm p-4 space-y-0">
                <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2.5">
                        <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-inner">
                            <Clock className="h-5 w-5 text-primary animate-pulse" />
                        </div>
                        <div>
                            <CardTitle className="text-lg font-black tracking-tight flex items-center gap-2">
                                Pending Works
                                {hasAnyItems && (
                                    <span className="px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                                        {pendingItems.length}
                                    </span>
                                )}
                            </CardTitle>
                            <CardDescription className="text-xs font-medium">Items that require your attention</CardDescription>
                        </div>
                    </div>
                </div>

                {hasAnyItems && (
                    <div className="flex gap-4 mt-3 pt-2 border-t border-dashed border-muted-foreground/10">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">Overdue</span>
                            <span className={cn("text-xs font-black", groupedItems.overdue.length > 0 ? "text-red-500" : "text-muted-foreground")}>
                                {groupedItems.overdue.length}
                            </span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">Today</span>
                            <span className={cn("text-xs font-black", groupedItems.today.length > 0 ? "text-orange-500" : "text-muted-foreground")}>
                                {groupedItems.today.length}
                            </span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">Upcoming</span>
                            <span className="text-xs font-black text-blue-500">{groupedItems.upcoming.length}</span>
                        </div>
                    </div>
                )}
            </CardHeader>

            <CardContent className="flex-grow overflow-y-auto custom-scrollbar p-0">
                {hasAnyItems ? (
                    <div className="flex flex-col">
                        {groupedItems.overdue.length > 0 && (
                            <div className="bg-red-50/30 dark:bg-red-950/10">
                                <div className="px-4 py-2 text-[10px] font-black text-red-600 dark:text-red-400 uppercase tracking-widest flex items-center gap-2 bg-red-50/50 dark:bg-red-950/20 border-y">
                                    <AlertCircle className="h-3 w-3" />
                                    Overdue Items
                                </div>
                                {groupedItems.overdue.map(renderItem)}
                            </div>
                        )}
                        {groupedItems.today.length > 0 && (
                            <div className="bg-orange-50/30 dark:bg-orange-950/10">
                                <div className="px-4 py-2 text-[10px] font-black text-orange-600 dark:text-orange-400 uppercase tracking-widest flex items-center gap-2 bg-orange-50/50 dark:bg-orange-950/20 border-y">
                                    <Clock className="h-3 w-3" />
                                    Due Today
                                </div>
                                {groupedItems.today.map(renderItem)}
                            </div>
                        )}
                        {groupedItems.upcoming.length > 0 && (
                            <div>
                                <div className="px-4 py-2 text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest flex items-center gap-2 bg-blue-50/50 dark:bg-blue-950/20 border-y">
                                    <Calendar className="h-3 w-3" />
                                    Upcoming Tasks
                                </div>
                                {groupedItems.upcoming.map(renderItem)}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
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
            </CardContent>
        </Card>
    );
};

export default PendingWorks;

