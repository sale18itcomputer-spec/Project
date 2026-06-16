'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Spinner from '@/components/common/Spinner';

interface Props {
    children: React.ReactNode;
}

export default function StandaloneShell({ children }: Props) {
    const { currentUser, isAuthLoading } = useAuth();

    if (isAuthLoading) {
        return (
            <div className="h-screen flex items-center justify-center bg-background">
                <Spinner size="lg" />
            </div>
        );
    }

    if (!currentUser) {
        return (
            <div className="h-screen flex flex-col items-center justify-center bg-background gap-4">
                <p className="text-muted-foreground text-sm">Session expired. Please log in again.</p>
                <a href="/" className="text-brand-500 hover:underline text-sm font-medium">Go to login</a>
            </div>
        );
    }

    return <>{children}</>;
}
