'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft, MoreVertical } from 'lucide-react';
import { haptic } from '@/lib/miniapp/telegramShare';
import { useState, useRef, useEffect } from 'react';

interface Action {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    destructive?: boolean;
}

interface MiniAppShellProps {
    title: string;
    backHref?: string;
    /** Slot for a primary action button (top-right) */
    actionButton?: React.ReactNode;
    /** Overflow menu items (shown in a ⋮ dropdown) */
    actions?: Action[];
    children: React.ReactNode;
}

export default function MiniAppShell({
    title,
    backHref,
    actionButton,
    actions = [],
    children,
}: MiniAppShellProps) {
    const router = useRouter();
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const handleBack = () => {
        haptic('light');
        if (backHref) router.push(backHref);
        else router.back();
    };

    // Close menu on outside click
    useEffect(() => {
        if (!menuOpen) return;
        const handler = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [menuOpen]);

    const showOverflow = actions.length > 0 && !actionButton;

    return (
        <div
            className="min-h-screen flex flex-col"
            style={{ background: 'hsl(var(--background))' }}
        >
            {/* ── Top nav bar ──────────────────────────────────────────── */}
            <header
                className="flex-shrink-0 flex items-center gap-1 px-1 sticky top-0 z-50"
                style={{
                    height: '52px',
                    background: 'hsl(var(--card) / 0.92)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    borderBottom: '1px solid hsl(var(--border) / 0.6)',
                }}
            >
                {/* Back */}
                {(backHref !== undefined) && (
                    <button
                        onClick={handleBack}
                        className="flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0 active:opacity-60 transition-opacity"
                        style={{ color: 'hsl(var(--primary))' }}
                        aria-label="Go back"
                    >
                        <ChevronLeft size={22} strokeWidth={2.5} />
                    </button>
                )}

                {/* Title */}
                <h1
                    className="flex-1 text-[15px] font-bold text-foreground truncate"
                    style={{ letterSpacing: '-0.01em' }}
                >
                    {title}
                </h1>

                {/* Primary action button (custom) */}
                {actionButton && (
                    <div className="flex-shrink-0 mr-1">{actionButton}</div>
                )}

                {/* Overflow menu */}
                {showOverflow && (
                    <div className="relative flex-shrink-0 mr-1" ref={menuRef}>
                        <button
                            onClick={() => { haptic('light'); setMenuOpen(p => !p); }}
                            className="flex items-center justify-center w-10 h-10 rounded-xl active:opacity-60 transition-opacity"
                            style={{ color: 'hsl(var(--muted-foreground))' }}
                            aria-label="More options"
                        >
                            <MoreVertical size={20} />
                        </button>

                        {menuOpen && (
                            <div
                                className="absolute right-0 top-full mt-1 rounded-xl overflow-hidden z-50 min-w-[160px]"
                                style={{
                                    background: 'hsl(var(--card))',
                                    border: '1px solid hsl(var(--border) / 0.8)',
                                    boxShadow: '0 8px 24px hsl(var(--foreground) / 0.12)',
                                }}
                            >
                                {actions.map((action, i) => (
                                    <button
                                        key={i}
                                        onClick={() => {
                                            haptic('light');
                                            setMenuOpen(false);
                                            action.onClick();
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-left text-[13px] font-medium active:opacity-60 transition-opacity"
                                        style={{
                                            color: action.destructive
                                                ? 'hsl(var(--destructive))'
                                                : 'hsl(var(--foreground))',
                                            borderTop: i > 0 ? '1px solid hsl(var(--border) / 0.4)' : 'none',
                                        }}
                                    >
                                        {action.icon && (
                                            <span className="flex-shrink-0">{action.icon}</span>
                                        )}
                                        {action.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </header>

            {/* ── Content ───────────────────────────────────────────────── */}
            <div className="flex-1 min-h-0 overflow-hidden">
                {children}
            </div>
        </div>
    );
}
