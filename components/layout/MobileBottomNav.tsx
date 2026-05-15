'use client';

import React, { useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useB2B } from '@/contexts/B2BContext';
import { useAuth } from '@/contexts/AuthContext';
import { LayoutDashboard, Filter, Building, Users, FileText, Truck, Receipt } from 'lucide-react';

const allNavItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard, showInB2B: true, financeOnly: false },
    { path: '/projects', label: 'Pipelines', icon: Filter, showInB2B: true, financeOnly: false },
    { path: '/companies', label: 'Companies', icon: Building, showInB2B: true, financeOnly: false },
    { path: '/contacts', label: 'Contacts', icon: Users, showInB2B: false, financeOnly: false },
    { path: '/quotations', label: 'Quotes', icon: FileText, showInB2B: true, financeOnly: false },
];

const financeNavItems = [
    { path: '/invoices', label: 'Invoices', icon: FileText },
    { path: '/delivery-orders', label: 'Delivery', icon: Truck },
    { path: '/receipts', label: 'Receipts', icon: Receipt },
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

    return (
        <nav className="mobile-bottom-nav lg:hidden">
            {navItems.map(item => {
                const isActive = pathname === item.path;
                const Icon = item.icon;
                return (
                    <button
                        key={item.path}
                        onClick={() => router.push(item.path)}
                        className={`mobile-nav-item ${isActive ? 'active' : ''}`}
                        aria-current={isActive ? 'page' : undefined}
                    >
                        {/* Pill / highlight behind icon when active */}
                        <span className={`mobile-nav-pill ${isActive ? 'active' : ''}`}>
                            <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
                        </span>
                        <span className="mobile-nav-item-label">{item.label}</span>
                    </button>
                );
            })}
        </nav>
    );
};

export default MobileBottomNav;
