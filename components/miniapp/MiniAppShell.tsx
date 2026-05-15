'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

interface MiniAppShellProps {
    title: string;
    backHref?: string;
    children: React.ReactNode;
}

export default function MiniAppShell({ title, backHref, children }: MiniAppShellProps) {
    const router = useRouter();

    const handleBack = () => {
        const tg = (window as any).Telegram?.WebApp;
        if (backHref) {
            router.push(backHref);
        } else {
            router.back();
        }
    };

    return (
        <div className="min-h-screen bg-background flex flex-col">
            {/* Mini App top nav */}
            <header className="flex-shrink-0 bg-card border-b border-border px-3 py-3 flex items-center gap-3 sticky top-0 z-50">
                {backHref && (
                    <button
                        onClick={handleBack}
                        className="p-1.5 rounded-lg hover:bg-muted transition text-muted-foreground"
                    >
                        <ChevronLeft size={20} />
                    </button>
                )}
                <h1 className="text-base font-bold text-foreground flex-1 truncate">{title}</h1>
            </header>

            {/* Dashboard content — fills remaining height */}
            <div className="flex-1 min-h-0 overflow-hidden">
                {children}
            </div>
        </div>
    );
}
