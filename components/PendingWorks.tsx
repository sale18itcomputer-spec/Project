import React, { useState } from 'react';
import { PendingWorkItem } from '../types';
import { useNavigation } from '../contexts/NavigationContext';
import { Calendar } from 'lucide-react';

const TabButton: React.FC<{
    label: string;
    count: number;
    isActive: boolean;
    onClick: () => void;
}> = ({ label, count, isActive, onClick }) => {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-full transition-colors ${isActive
                ? 'bg-brand-600 text-white shadow-md'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
        >
            {label}
            <span className={`px-2 py-0.5 rounded-full text-xs ${isActive ? 'bg-background text-brand-600' : 'bg-muted text-foreground'
                }`}>
                {count}
            </span>
        </button>
    );
};

const WorkItem: React.FC<{ item: PendingWorkItem }> = ({ item }) => {
    const { handleNavigation } = useNavigation();

    const timeDisplay = (item: PendingWorkItem): string => {
        if (item.time) {
            const timeParts = item.time.split(':');
            if (timeParts.length >= 2) {
                const hour = parseInt(timeParts[0]);
                const minute = timeParts[1];
                const ampmMatch = item.time.match(/([AP]M)/i);
                const ampm = ampmMatch ? ampmMatch[0].toUpperCase() : (hour < 12 ? 'AM' : 'PM');
                const hour12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
                return `${hour12}:${minute} ${ampm}`;
            }
            return item.time;
        }
        const now = new Date();
        const itemDate = new Date(item.date);
        itemDate.setHours(0, 0, 0, 0);
        now.setHours(0, 0, 0, 0);
        const diffDays = Math.round((itemDate.getTime() - now.getTime()) / (1000 * 3600 * 24));

        if (diffDays === 0) return 'Due Today';
        if (diffDays === 1) return 'Tomorrow';
        return `in ${diffDays} days`;
    };

    return (
        <li className="py-3">
            <button
                onClick={() => handleNavigation(item.link)}
                className="w-full text-left flex items-center gap-4 group"
            >
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                    {item.icon}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate group-hover:text-brand-600 transition-colors">{item.title}</p>
                    <p className="text-sm text-muted-foreground truncate">{item.subtitle}</p>
                </div>
                <div className="text-xs text-right text-muted-foreground font-medium whitespace-nowrap">
                    {timeDisplay(item)}
                </div>
            </button>
        </li>
    );
};

const PendingWorks: React.FC<{ todayItems: PendingWorkItem[], upcomingItems: PendingWorkItem[] }> = ({ todayItems, upcomingItems }) => {
    const [activeTab, setActiveTab] = useState('today');
    const itemsToShow = activeTab === 'today' ? todayItems : upcomingItems;

    return (
        <div className="bg-card p-6 rounded-xl border border-border shadow-sm h-full flex flex-col">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <Calendar className="w-6 h-6 text-brand-600" />
                My Pending Works
            </h2>
            <div className="flex items-center gap-2 mb-4">
                <TabButton label="Today" count={todayItems.length} isActive={activeTab === 'today'} onClick={() => setActiveTab('today')} />
                <TabButton label="Upcoming" count={upcomingItems.length} isActive={activeTab === 'upcoming'} onClick={() => setActiveTab('upcoming')} />
            </div>
            <div className="flex-1 overflow-y-auto -mx-3 px-1 flex items-center justify-center">
                {itemsToShow.length > 0 ? (
                    <ul className="divide-y divide-border w-full">
                        {itemsToShow.map(item => <WorkItem key={item.id} item={item} />)}
                    </ul>
                ) : (
                    <div className="flex flex-col items-center justify-center text-center py-8">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-16 h-16 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="mt-4 text-base font-semibold text-foreground">All caught up!</p>
                        <p className="mt-1 text-sm text-muted-foreground">No pending items for this period.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PendingWorks;