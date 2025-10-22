import React from 'react';

interface ViewToggleProps<T extends string> {
    views: { id: T; label: string; icon: React.ReactNode }[];
    activeView: T;
    onViewChange: (viewId: T) => void;
}

function ViewToggle<T extends string>({ views, activeView, onViewChange }: ViewToggleProps<T>) {
    return (
        <div className="bg-slate-100 p-1 rounded-lg flex items-center gap-1">
            {views.map(view => {
                const isActive = activeView === view.id;
                return (
                    <button
                        key={view.id}
                        onClick={() => onViewChange(view.id)}
                        className={`flex items-center gap-2 px-3 py-1.5 text-sm font-semibold rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:ring-offset-1 ${
                            isActive
                                ? 'bg-white shadow-sm text-brand-700'
                                : 'text-slate-600 hover:bg-white/60'
                        }`}
                        aria-pressed={isActive}
                    >
                        {view.icon}
                        {view.label}
                    </button>
                );
            })}
        </div>
    );
}

export default ViewToggle;
