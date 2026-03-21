'use client';

import React, { useMemo } from 'react';
import Spinner from "../../common/Spinner";
import EmptyState from "../../common/EmptyState";
import { ClipboardList } from 'lucide-react';

export interface AgendaItem<T> {
    id: string;
    date: Date | null;
    title: string;
    data: T;
}

interface AgendaViewProps<T> {
    items: AgendaItem<T>[];
    renderCardContent: (item: T) => React.ReactNode;
    onItemClick: (item: T) => void;
    loading: boolean;
}

const getRelativeDateGroup = (date: Date): string => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const itemDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (itemDate.getTime() === today.getTime()) return 'Today';
    if (itemDate.getTime() === tomorrow.getTime()) return 'Tomorrow';
    if (itemDate < today) return 'Past';

    return 'Upcoming';
};

const formatDateForHeader = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function AgendaView<T>({ items, renderCardContent, onItemClick, loading }: AgendaViewProps<T>) {

    const groupedItems = useMemo(() => {
        const sorted = items
            .filter(item => item.date)
            .sort((a, b) => a.date!.getTime() - b.date!.getTime());

        const groups: { [key: string]: AgendaItem<T>[] } = {
            Today: [],
            Tomorrow: [],
            Upcoming: [],
            Past: []
        };

        const dateMap: { [key: string]: AgendaItem<T>[] } = {};

        sorted.forEach(item => {
            const groupKey = getRelativeDateGroup(item.date!);
            if (groupKey === 'Upcoming' || groupKey === 'Past') {
                const dateString = item.date!.toISOString().split('T')[0];
                if (!dateMap[dateString]) dateMap[dateString] = [];
                dateMap[dateString].push(item);
            } else {
                groups[groupKey].push(item);
            }
        });

        // Convert dateMap to sorted arrays for Upcoming and Past
        const upcomingEntries = Object.entries(dateMap).filter(([dateStr]) => new Date(dateStr) > new Date()).sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());
        const pastEntries = Object.entries(dateMap).filter(([dateStr]) => new Date(dateStr) < new Date()).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());

        return {
            Today: groups.Today,
            Tomorrow: groups.Tomorrow,
            Upcoming: upcomingEntries.flatMap(([, items]) => items),
            Past: pastEntries.flatMap(([, items]) => items),
        };
    }, [items]);

    const totalItems = items.length;

    if (loading) {
        return <div className="p-8"><Spinner size="lg" /></div>;
    }

    if (totalItems === 0) {
        return (
            <div className="flex-1 flex items-center justify-center bg-muted/30 p-8">
                <EmptyState illustration={<ClipboardList className="w-20 h-20 text-muted-foreground/30" />}>
                    <h3 className="mt-2 text-lg font-semibold text-foreground">No Items to Display</h3>
                    <p className="mt-1 text-sm text-muted-foreground">There are currently no items in the agenda.</p>
                </EmptyState>
            </div>
        );
    }

    const DateSection: React.FC<{ title: string; items: AgendaItem<T>[] }> = ({ title, items }) => {
        if (items.length === 0) return null;
        let lastDateHeader: string | null = null;

        return (
            <div className="mb-8">
                <h2 className="text-xl font-bold text-foreground mb-4 px-8 sticky top-0 bg-background/80 backdrop-blur-sm py-3 -mx-8 z-10 border-b border-t border-border">{title}</h2>
                <div className="space-y-4">
                    {items.map(item => {
                        const currentDateHeader = formatDateForHeader(item.date!);
                        const showDateHeader = currentDateHeader !== lastDateHeader && (title === 'Upcoming' || title === 'Past');
                        lastDateHeader = currentDateHeader;
                        return (
                            <React.Fragment key={item.id}>
                                {showDateHeader && <h3 className="text-base font-semibold text-muted-foreground pt-4 pb-2 border-b border-border">{currentDateHeader}</h3>}
                                <button
                                    onClick={() => onItemClick(item.data)}
                                    className="w-full text-left bg-card p-5 rounded-xl border border-border shadow-sm hover:shadow-lg hover:border-brand-300 transition-all duration-200 transform hover:-translate-y-px border-l-4 border-l-brand-500"
                                >
                                    <h4 className="font-bold text-foreground text-lg">{item.title}</h4>
                                    {renderCardContent(item.data)}
                                </button>
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <DateSection title="Today" items={groupedItems.Today} />
            <DateSection title="Tomorrow" items={groupedItems.Tomorrow} />
            <DateSection title="Upcoming" items={groupedItems.Upcoming} />
            <DateSection title="Past" items={groupedItems.Past} />
        </div>
    );
}

export default AgendaView;
