import React from 'react';

export default function StandaloneLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="h-screen w-screen bg-background overflow-hidden">
            {children}
        </div>
    );
}
