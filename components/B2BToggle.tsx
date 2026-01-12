import React from 'react';
import { useB2B } from '../contexts/B2BContext';
import { useAuth } from '../contexts/AuthContext';
import { Building2, Users2 } from 'lucide-react';

const B2BToggle: React.FC = () => {
    const { mode, toggleMode, isB2B } = useB2B();
    const { currentUser } = useAuth();

    // Only show toggle for admin users
    if (currentUser?.Role !== 'Admin') {
        return null;
    }

    return (
        <div className="flex items-center gap-2">
            <button
                onClick={toggleMode}
                className="relative inline-flex items-center h-9 rounded-lg bg-muted p-1 transition-colors hover:bg-muted/80"
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

            {/* Mode indicator badge */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/50 border border-border">
                <div className={`w-2 h-2 rounded-full ${isB2B ? 'bg-blue-500' : 'bg-green-500'} animate-pulse`} />
                <span className="text-xs font-medium text-muted-foreground">
                    {mode} Mode
                </span>
            </div>
        </div>
    );
};

export default B2BToggle;
