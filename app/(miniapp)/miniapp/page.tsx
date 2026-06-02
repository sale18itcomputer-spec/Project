'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    FileText, ShoppingCart, Receipt, Package,
    Truck, ClipboardList, TrendingUp, ChevronRight, BarChart2,
} from 'lucide-react';
import { useMiniAppAuth } from '@/contexts/MiniAppAuthContext';
import { useData } from '@/contexts/MiniAppDataContext';
import GlobalSearch from '@/components/miniapp/GlobalSearch';
import { haptic } from '@/lib/miniapp/telegramShare';

const DOC_TYPES = [
    {
        id: 'quotations',
        label: 'Quotations',
        description: 'Create & manage quotes',
        icon: FileText,
        color: '#38bdf8',        // sky
        href: '/miniapp/sales/quotations',
        fetchKey: 'Quotations',
        countKey: 'quotations',
    },
    {
        id: 'sale-orders',
        label: 'Sale Orders',
        description: 'Track confirmed orders',
        icon: ShoppingCart,
        color: '#34d399',        // emerald
        href: '/miniapp/sales/sale-orders',
        fetchKey: 'Sale Orders',
        countKey: 'saleOrders',
    },
    {
        id: 'invoices',
        label: 'Invoices',
        description: 'View & send invoices',
        icon: Receipt,
        color: '#a78bfa',        // violet
        href: '/miniapp/sales/invoices',
        fetchKey: 'Invoices',
        countKey: 'invoices',
    },
    {
        id: 'delivery-orders',
        label: 'Delivery Orders',
        description: 'Manage deliveries',
        icon: Truck,
        color: '#fb923c',        // orange
        href: '/miniapp/sales/delivery-orders',
        fetchKey: 'Delivery Orders',
        countKey: 'deliveryOrders',
    },
    {
        id: 'receipts',
        label: 'Receipts',
        description: 'Payment receipts',
        icon: ClipboardList,
        color: '#f472b6',        // pink
        href: '/miniapp/sales/receipts',
        fetchKey: 'Receipts',
        countKey: 'receipts',
    },
    {
        id: 'purchase-orders',
        label: 'Purchase Orders',
        description: 'Vendor purchase orders',
        icon: Package,
        color: '#fbbf24',        // amber
        href: '/miniapp/sales/purchase-orders',
        fetchKey: 'Purchase Orders',
        countKey: 'purchaseOrders',
    },
    {
        id: 'performance',
        label: 'My Performance',
        description: 'Personal stats & charts',
        icon: TrendingUp,
        color: '#2dd4bf',        // teal
        href: '/miniapp/sales/performance',
        fetchKey: null,
        countKey: null,
    },
    {
        id: 'weekly-report',
        label: 'Weekly Report',
        description: 'This week\'s activity',
        icon: BarChart2,
        color: '#818cf8',        // indigo
        href: '/miniapp/sales/weekly-report',
        fetchKey: null,
        countKey: null,
    },
] as const;

export default function MiniAppHome() {
    const router = useRouter();
    const { authState } = useMiniAppAuth();
    const data = useData();
    const [pressing, setPressing] = useState<string | null>(null);
    const [greeting, setGreeting] = useState('');
    const [visible, setVisible] = useState(false);

    const user = authState.status === 'authenticated' ? authState.user : null;
    const tgUser = authState.status === 'authenticated' ? authState.telegramUser : null;
    const displayName = user?.Name?.split(' ')[0] || tgUser?.first_name || '';
    const avatarLetter = displayName?.[0]?.toUpperCase() || 'L';
    const photoUrl = tgUser?.photo_url;

    useEffect(() => {
        const h = new Date().getHours();
        if (h < 12) setGreeting('Good morning');
        else if (h < 17) setGreeting('Good afternoon');
        else setGreeting('Good evening');
        // Stagger-in animation trigger
        const t = setTimeout(() => setVisible(true), 60);
        return () => clearTimeout(t);
    }, []);

    useEffect(() => {
        DOC_TYPES.forEach(d => { if (d.fetchKey) data.fetchModule(d.fetchKey); });
     
    }, []);

    const getCount = (countKey: string | null): number | null => {
        if (!countKey) return null;
        const arr = (data as any)[countKey];
        return Array.isArray(arr) ? arr.length : null;
    };

    const handlePress = (id: string, href: string) => {
        haptic('light');
        setPressing(id);
        setTimeout(() => router.push(href), 120);
    };

    return (
        <div
            className="min-h-screen flex flex-col"
            style={{ background: 'hsl(var(--background))' }}
        >
            {/* ── Header ───────────────────────────────────────────── */}
            <header
                className="flex-shrink-0 px-4 pt-5 pb-5 relative overflow-hidden"
                style={{
                    background: 'linear-gradient(160deg, hsl(var(--card)) 60%, hsl(var(--card)/0.85) 100%)',
                    borderBottom: '1px solid hsl(var(--border)/0.5)',
                }}
            >
                {/* Decorative glow blob */}
                <div
                    className="absolute -top-8 -right-8 w-40 h-40 rounded-full pointer-events-none"
                    style={{
                        background: 'radial-gradient(circle, hsl(var(--primary)/0.15) 0%, transparent 70%)',
                        filter: 'blur(20px)',
                    }}
                />

                <div className="relative flex items-center justify-between gap-3">
                    {/* Left */}
                    <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-medium text-muted-foreground tracking-wide uppercase mb-0.5">
                            {greeting}
                        </p>
                        <h1
                            className="text-[22px] font-bold text-foreground leading-tight truncate"
                            style={{ letterSpacing: '-0.03em' }}
                        >
                            {displayName ? `${displayName} 👋` : 'Sales Hub'}
                        </h1>
                        {user?.Role && (
                            <span
                                className="inline-flex items-center mt-2 text-[10px] font-semibold px-2.5 py-0.5 rounded-full"
                                style={{
                                    background: 'hsl(var(--primary)/0.12)',
                                    color: 'hsl(var(--primary))',
                                    border: '1px solid hsl(var(--primary)/0.2)',
                                }}
                            >
                                {user.Role}
                            </span>
                        )}
                    </div>

                    {/* Avatar */}
                    <div
                        className="w-12 h-12 rounded-2xl overflow-hidden flex-shrink-0 flex items-center justify-center font-bold text-lg text-white shadow-lg"
                        style={{
                            background: photoUrl ? 'transparent' : 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary)/0.7) 100%)',
                            boxShadow: '0 4px 16px hsl(var(--primary)/0.3)',
                        }}
                    >
                        {photoUrl
                            ? <img src={photoUrl} alt={displayName} className="w-full h-full object-cover" />
                            : <span>{avatarLetter}</span>
                        }
                    </div>
                </div>

                {/* Stats row */}
                <div className="relative mt-4 grid grid-cols-3 gap-2">
                    {[
                        { label: 'Quotes', key: 'quotations' },
                        { label: 'Orders', key: 'saleOrders' },
                        { label: 'Invoices', key: 'invoices' },
                    ].map(({ label, key }) => {
                        const count = getCount(key);
                        return (
                            <div
                                key={key}
                                className="rounded-xl px-3 py-2 text-center"
                                style={{
                                    background: 'hsl(var(--muted)/0.5)',
                                    border: '1px solid hsl(var(--border)/0.4)',
                                }}
                            >
                                <p
                                    className="text-[17px] font-bold text-foreground leading-none"
                                    style={{ letterSpacing: '-0.02em' }}
                                >
                                    {count !== null ? count : '—'}
                                </p>
                                <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">{label}</p>
                            </div>
                        );
                    })}
                </div>
            </header>

            {/* ── Global search ─────────────────────────────────── */}
            <div className="pt-3 pb-1 flex-shrink-0">
                <GlobalSearch />
            </div>

            {/* ── Section label ────────────────────────────────────── */}
            <div className="px-4 pt-2 pb-2 flex-shrink-0">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.12em]">
                    Documents
                </p>
            </div>

            {/* ── Doc list ─────────────────────────────────────────── */}
            <main className="flex-1 px-3 pb-6 overflow-y-auto space-y-[6px]">
                {DOC_TYPES.map(({ id, label, description, icon: Icon, color, href, countKey }, i) => {
                    const isPressed = pressing === id;
                    const count = getCount(countKey);

                    return (
                        <button
                            key={id}
                            onPointerDown={() => setPressing(id)}
                            onPointerUp={() => handlePress(id, href)}
                            onPointerCancel={() => setPressing(null)}
                            onPointerLeave={() => setPressing(null)}
                            className="w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-left"
                            style={{
                                opacity: visible ? 1 : 0,
                                transform: visible
                                    ? (isPressed ? 'scale(0.97)' : 'scale(1)')
                                    : 'translateY(8px)',
                                transition: `opacity 220ms ease ${i * 35}ms, transform ${isPressed ? '80ms' : '220ms'} ease ${isPressed ? '0ms' : i * 35 + 'ms'}`,
                                background: isPressed
                                    ? `linear-gradient(135deg, ${color}18 0%, hsl(var(--card)) 100%)`
                                    : 'hsl(var(--card))',
                                border: `1px solid ${isPressed ? color + '50' : 'hsl(var(--border)/0.6)'}`,
                                boxShadow: isPressed
                                    ? `0 2px 12px ${color}20`
                                    : '0 1px 3px hsl(var(--foreground)/0.04)',
                            }}
                        >
                            {/* Icon pill */}
                            <div
                                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                style={{
                                    background: `${color}18`,
                                    border: `1px solid ${color}30`,
                                }}
                            >
                                <Icon size={18} style={{ color }} strokeWidth={1.8} />
                            </div>

                            {/* Text */}
                            <div className="flex-1 min-w-0">
                                <p
                                    className="text-[13px] font-semibold text-foreground leading-tight"
                                    style={{ letterSpacing: '-0.01em' }}
                                >
                                    {label}
                                </p>
                                <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
                                    {description}
                                </p>
                            </div>

                            {/* Count badge */}
                            {count !== null && (
                                <span
                                    className="flex-shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full min-w-[28px] text-center"
                                    style={{
                                        background: `${color}18`,
                                        color,
                                        border: `1px solid ${color}30`,
                                    }}
                                >
                                    {count}
                                </span>
                            )}

                            {/* Chevron */}
                            <ChevronRight
                                size={14}
                                className="flex-shrink-0 transition-transform duration-100"
                                style={{
                                    color: isPressed ? color : 'hsl(var(--muted-foreground)/0.35)',
                                    transform: isPressed ? 'translateX(2px)' : 'none',
                                }}
                            />
                        </button>
                    );
                })}
            </main>

            {/* ── Footer ───────────────────────────────────────────── */}
            <footer className="flex-shrink-0 px-4 pb-5 pt-1 text-center safe-area-bottom">
                <div className="flex items-center justify-center gap-1.5">
                    <div
                        className="w-4 h-4 rounded-[5px] flex items-center justify-center"
                        style={{ background: 'hsl(var(--primary))' }}
                    >
                        <span className="text-white font-black text-[8px]">L</span>
                    </div>
                    <p className="text-[10px] font-medium" style={{ color: 'hsl(var(--muted-foreground)/0.4)' }}>
                        Limperial Technology
                    </p>
                </div>
            </footer>
        </div>
    );
}
