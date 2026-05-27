'use client';

/**
 * MiniAppNavigationProvider
 *
 * Provides a NavigationContext that maps view names to /miniapp/* paths
 * instead of the dashboard's root paths (/quotations, /companies, etc).
 *
 * This is mounted inside MiniAppProviders so that shared dashboard components
 * (QuotationDashboard etc.) that call useNavigation() / handleNavigation()
 * stay within the miniapp route tree — no accidental pushes to /quotations
 * that would hit the middleware and redirect to /login.
 */

import React, { useCallback, ReactNode } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { NavigationContext, NavigationState } from '@/contexts/NavigationContext';

// Miniapp view → path mapping (mirrors VIEW_TO_PATH but under /miniapp/sales/)
const MINI_VIEW_TO_PATH: Record<string, string> = {
    'dashboard':        '/miniapp',
    'quotations':       '/miniapp/sales/quotations',
    'sale-orders':      '/miniapp/sales/sale-orders',
    'invoices':         '/miniapp/sales/invoices',
    'delivery-orders':  '/miniapp/sales/delivery-orders',
    'receipts':         '/miniapp/sales/receipts',
    'purchase-orders':  '/miniapp/sales/purchase-orders',
    'weekly-report':    '/miniapp/sales/weekly-report',
    'performance':       '/miniapp/sales/performance',
    // Fallback for any other views — go back to miniapp home
    'companies':        '/miniapp',
    'contacts':         '/miniapp',
    'projects':         '/miniapp',
    'contact-logs':     '/miniapp',
    'site-surveys':     '/miniapp',
    'meetings':         '/miniapp',
    'pricelist':        '/miniapp',
    'b2b-pricelist':    '/miniapp',
    'users':            '/miniapp',
    'vendors':          '/miniapp',
    'vendor-pricelist': '/miniapp',
    'invoice-do':       '/miniapp/sales/invoices',
};

const MINI_PATH_TO_VIEW: Record<string, string> = Object.fromEntries(
    Object.entries(MINI_VIEW_TO_PATH).map(([k, v]) => [v, k])
);

const NAV_PAYLOAD_KEY = 'limperial_nav_payload';

export default function MiniAppNavigationProvider({ children }: { children: ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const currentView = MINI_PATH_TO_VIEW[pathname] || 'quotations';
    const currentFilter = searchParams.get('filter') ?? undefined;
    const currentAction = searchParams.get('action') ?? undefined;
    const currentId = searchParams.get('id') ?? undefined;

    let currentPayload: any = undefined;
    if (searchParams.get('has_payload') === '1') {
        try {
            const raw = sessionStorage.getItem(NAV_PAYLOAD_KEY);
            if (raw) currentPayload = JSON.parse(raw);
        } catch {}
    }

    const navigation: NavigationState = {
        view: currentView,
        filter: currentFilter,
        action: currentAction,
        id: currentId,
        payload: currentPayload,
    };

    const handleNavigation = useCallback((nav: NavigationState) => {
        const path = MINI_VIEW_TO_PATH[nav.view] || '/miniapp';

        const params = new URLSearchParams();
        if (nav.filter) params.set('filter', nav.filter);
        if (nav.action) params.set('action', nav.action);
        if (nav.id) params.set('id', nav.id);

        if (nav.payload !== undefined) {
            try {
                sessionStorage.setItem(NAV_PAYLOAD_KEY, JSON.stringify(nav.payload));
                params.set('has_payload', '1');
            } catch {}
        }

        const qs = params.toString();
        router.push(qs ? `${path}?${qs}` : path);
    }, [router]);

    return (
        <NavigationContext.Provider value={{ navigation, handleNavigation }}>
            {children}
        </NavigationContext.Provider>
    );
}
