'use client';

import { useEffect } from 'react';
import { RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('[GlobalError]', error);
    }, [error]);

    return (
        <html lang="en">
            <body className="min-h-screen flex items-center justify-center bg-background px-4">
                <div className="text-center max-w-md">
                    <div className="w-24 h-24 mx-auto mb-6 bg-rose-50 rounded-full flex items-center justify-center">
                        <span className="text-3xl">⚠️</span>
                    </div>
                    <h1 className="text-2xl font-bold text-foreground mb-2">Something went wrong</h1>
                    <p className="text-muted-foreground mb-2 text-sm">
                        An unexpected error occurred. Our team has been notified.
                    </p>
                    {error.digest && (
                        <p className="text-xs text-muted-foreground/60 font-mono mb-6">Error ID: {error.digest}</p>
                    )}
                    <div className="flex items-center justify-center gap-3 mt-6">
                        <button
                            onClick={reset}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Try again
                        </button>
                        <Link
                            href="/"
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors"
                        >
                            <Home className="w-4 h-4" />
                            Dashboard
                        </Link>
                    </div>
                </div>
            </body>
        </html>
    );
}
