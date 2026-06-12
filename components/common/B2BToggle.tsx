'use client';

import React from 'react';
import { useB2B } from "../../contexts/B2BContext";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../providers/AppProviders";
import { Building2, Users2, Sun, Moon, Sparkles } from 'lucide-react';

const B2BToggle: React.FC = () => {
    const { mode, toggleMode, isB2B } = useB2B();
    const { theme, toggle: toggleTheme } = useTheme();
    const { currentUser: _currentUser } = useAuth();

    // Only show toggle for admin users
    // if (_currentUser?.Role !== 'Admin') {
    //    return null;
    // }

    return (
        <div className="flex items-center gap-3">
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

            {/* Theme Toggle */}
            <button
                onClick={toggleTheme}
                className="flex items-center justify-center w-9 h-9 rounded-lg bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-200 shadow-sm"
                title={`Switch to ${theme === 'light' ? 'Dark' : theme === 'dark' ? 'Claude' : 'Light'} Mode`}
            >
                {theme === 'light' ? (
                    <Moon size={18} className="animate-in zoom-in duration-300" />
                ) : theme === 'dark' ? (
                    <Sparkles size={18} className="animate-in zoom-in duration-300" />
                ) : (
                    <Sun size={18} className="animate-in zoom-in duration-300" />
                )}
            </button>

            {/* Mode indicator badge */}
            <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/30 border border-border">
                <div className={`w-1.5 h-1.5 rounded-full ${isB2B ? 'bg-blue-500' : 'bg-emerald-500'} shadow-sm`} />
                <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                    {mode} Active
                </span>
            </div>
        </div>
    );
};

export default B2BToggle;

