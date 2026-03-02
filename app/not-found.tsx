'use client';

import Link from 'next/link';
import { Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4">
            <div className="text-center max-w-md">
                <div className="w-24 h-24 mx-auto mb-6 bg-brand-50 rounded-full flex items-center justify-center">
                    <span className="text-4xl font-black text-brand-600">404</span>
                </div>
                <h1 className="text-2xl font-bold text-foreground mb-2">Page not found</h1>
                <p className="text-muted-foreground mb-8">
                    The page you're looking for doesn't exist or has been moved.
                </p>
                <div className="flex items-center justify-center gap-3">
                    <button
                        onClick={() => window.history.back()}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Go back
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
        </div>
    );
}
