'use client';

import React, { useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useB2B } from '@/contexts/B2BContext';
import { useAuth } from '@/contexts/AuthContext';
import { getRouteShortLabel } from '@/lib/routes';
import {
    LayoutDashboard, Filter, Building, FileText, Truck, Receipt, MoreHorizontal,
} from 'lucide-react';

/**
 * Bottom tab bar. Labels come from lib/routes.ts so they can't drift from the
 * sidebar and header again.
 *
 * The bar shows four destinations plus a "More" tab. Previously it showed five
 * hard-wired routes out of the app's thirty-two modules, and — because it
 * matched the active route with `pathname === item.path` — nothing was
 * highlighted on any of the other twenty-seven, or on any detail route. A
 * phone user had no indication of where they were and no way into the rest of
 * the app except the hamburger, which is at the opposite corner of the screen.
 */
const allNavItems = [
    { path: '/dashboard', icon: LayoutDashboard, showInB2B: true },
    { path: '/projects', icon: Filter, showInB2B: true },
    { path: '/companies', icon: Building, showInB2B: true },
    { path: '/quotations', icon: FileText, showInB2B: true },
];

const financeNavItems = [
    { path: '/invoices', icon: FileText, showInB2B: true },
    { path: '/delivery-orders', icon: Truck, showInB2B: true },
    { path: '/receipts', icon: Receipt, showInB2B: true },
    { path: '/collection', icon: LayoutDashboard, showInB2B: true },
];

const MobileBottomNav: React.FC = () => {
    const pathname = usePathname();
    const router = useRouter();
    const { isB2B } = useB2B();
    const { currentUser } = useAuth();
    const isFinance = currentUser?.Role === 'Finance';

    const navItems = useMemo(() => {
        if (isFinance) return financeNavItems;
        return allNavItems.filter(item => !isB2B || item.showInB2B);
    }, [isB2B, isFinance]);

    // Prefix match so a detail route (/quotations/QT-001) keeps its tab lit.
    const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/');
    const anyTabActive = navItems.some(item => isActive(item.path));

    return (
        <nav className="mobile-bottom-nav lg:hidden" aria-label="Primary">
            {navItems.map(item => {
                const active = isActive(item.path);
                const Icon = item.icon;
                const label = getRouteShortLabel(item.path);
                return (
                    <button
                        key={item.path}
                        onClick={() => router.push(item.path)}
                        className={`mobile-nav-item ${active ? 'active' : ''}`}
                        aria-current={active ? 'page' : undefined}
                    >
                        <span className={`mobile-nav-pill ${active ? 'active' : ''}`}>
                            <Icon size={20} strokeWidth={active ? 2.5 : 1.8} aria-hidden="true" />
                        </span>
                        <span className="mobile-nav-item-label">{label}</span>
                    </button>
                );
            })}

            {/* Opens the full navigation drawer. AppShell listens for this. */}
            <button
                onClick={() => window.dispatchEvent(new CustomEvent('open-sidebar'))}
                className={`mobile-nav-item ${!anyTabActive ? 'active' : ''}`}
                aria-label="More destinations"
            >
                <span className={`mobile-nav-pill ${!anyTabActive ? 'active' : ''}`}>
                    <MoreHorizontal size={20} strokeWidth={!anyTabActive ? 2.5 : 1.8} aria-hidden="true" />
                </span>
                <span className="mobile-nav-item-label">
                    {anyTabActive ? 'More' : getRouteShortLabel(pathname, 'More')}
                </span>
            </button>
        </nav>
    );
};

export default MobileBottomNav;
