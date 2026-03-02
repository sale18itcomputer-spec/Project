'use client';

import React from 'react';

interface ViewToggleProps<T extends string> {
    views: { id: T; label: string; icon: React.ReactNode }[];
    activeView: T;
    onViewChange: (viewId: T) => void;
}

function ViewToggle<T extends string>({ views, activeView, onViewChange }: ViewToggleProps<T>) {
    return (
        <div className="bg-muted p-1 rounded-lg flex items-center gap-1 border border-border">
            {views.map(view => {
                const isActive = activeView === view.id;
                return (
                    <button
                        key={view.id}
                        onClick={() => onViewChange(view.id)}
                        className={`flex items-center gap-2 px-3 py-1.5 text-sm font-semibold rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:ring-offset-1 ${isActive
                            ? 'bg-background shadow-sm text-brand-500'
                            : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'
                            }`}
                        aria-pressed={isActive}
                    >
                        {React.isValidElement(view.icon)
                            ? React.cloneElement(view.icon as React.ReactElement<any>, { className: 'w-4 h-4' })
                            : view.icon}
                        <span className="hidden sm:inline">{view.label}</span>
                    </button>
                );
            })}
        </div>
    );
}

export default ViewToggle;

