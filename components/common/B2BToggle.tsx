'use client';

import React from 'react';
import { useB2B } from "../../contexts/B2BContext";
import { Building2, Users2 } from 'lucide-react';
import ThemePicker from './ThemePicker';

const B2BToggle: React.FC = () => {
    const { mode, toggleMode, isB2B, canAccessB2B } = useB2B();

    return (
        <div className="flex items-center gap-3">
            {/* B2C ⇄ B2B switch — only shown when the user is permitted to use
                B2B mode (permission-driven via B2BContext.canAccessB2B). A
                B2C-only user has nothing to switch, so the toggle is hidden. */}
            {canAccessB2B && (
                <div className="flex items-center gap-1">
                    <button
                        onClick={toggleMode}
                        className="relative inline-flex items-center h-9 rounded-lg bg-muted p-1 transition-colors hover:bg-muted/80 shadow-inner"
                        aria-label={`Switch to ${isB2B ? 'B2C' : 'B2B'} mode`}
                    >
                        {/* B2C Option */}
                        <div
                            className={`flex items-center gap-2 px-3 py-1 rounded-md transition-all duration-200 ${!isB2B
                                ? 'bg-primary text-primary-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            <Users2 size={16} />
                            <span className="text-sm font-medium">B2C</span>
                        </div>

                        {/* B2B Option */}
                        <div
                            className={`flex items-center gap-2 px-3 py-1 rounded-md transition-all duration-200 ${isB2B
                                ? 'bg-primary text-primary-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            <Building2 size={16} />
                            <span className="text-sm font-medium">B2B</span>
                        </div>
                    </button>
                </div>
            )}

            {/* Theme & Accent Picker */}
            <ThemePicker />

            {/* Mode indicator badge — only meaningful when the user can be in
                either mode. */}
            {canAccessB2B && (
                <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/30 border border-border">
                    <div className={`w-1.5 h-1.5 rounded-full ${isB2B ? 'bg-blue-500' : 'bg-emerald-500'} shadow-sm`} />
                    <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                        {mode} Active
                    </span>
                </div>
            )}
        </div>
    );
};

export default B2BToggle;

