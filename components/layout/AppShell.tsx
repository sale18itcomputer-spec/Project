'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import Header from './Header';
import MobileBottomNav from './MobileBottomNav';
import { useAuth } from '@/contexts/AuthContext';
import { useWindowSize } from '@/hooks/useWindowSize';
import BrandedLoader from '@/components/common/DashboardSkeleton';
import { UNLOCK_STORAGE_KEY, AUTOLOCK_STORAGE_KEY } from '@/utils/security';
import { buildAllowedPaths, getDefaultRoute } from '@/utils/permissions';

/**
 * @deprecated Use buildAllowedPaths(user) from utils/permissions instead.
 * Kept temporarily for any imports that still reference this export.
 */
export const FINANCE_ALLOWED_PATHS = ['/invoices', '/delivery-orders', '/receipts', '/collection'];

const SIDEBAR_WIDTH_STORAGE_KEY = 'limperial-sidebar-width';
const SIDEBAR_COLLAPSED_WIDTH = 80;
const SIDEBAR_INITIAL_WIDTH = 220;
const SIDEBAR_MIN_WIDTH = 200;
const SIDEBAR_MAX_WIDTH = 500;

const CONSTRAINED_ROUTES = [
    '/projects', '/companies', '/contacts', '/contact-logs',
    '/site-surveys', '/meetings', '/pricelist', '/b2b-pricelist',
    '/quotations', '/sale-orders', '/invoices', '/delivery-orders',
    '/receipts', '/collection', '/users', '/vendors', '/vendor-pricelist',
    '/purchase-orders', '/weekly-report', '/inventory', '/inquiries',
    '/service-tickets', '/pdi-records', '/serial-numbers', '/spare-parts',
    '/',
];

export default function AppShell({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, isAuthLoading, currentUser } = useAuth();
    const { width } = useWindowSize();
    const pathname = usePathname();
    const router = useRouter();
    const isMobile = width < 1024;

    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [sidebarWidth, setSidebarWidth] = useState(() => {
        if (typeof window === 'undefined') return SIDEBAR_INITIAL_WIDTH;
        try {
            const saved = localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);
            if (saved) {
                const parsed = parseInt(saved, 10);
                return Math.max(SIDEBAR_MIN_WIDTH, Math.min(parsed, SIDEBAR_MAX_WIDTH));
            }
        } catch { }
        return SIDEBAR_INITIAL_WIDTH;
    });
    const [isResizing, setIsResizing] = useState(false);
    const sidebarWidthRef = useRef(sidebarWidth);
    sidebarWidthRef.current = sidebarWidth;

    // Auth redirect — preserve the intended URL so after login the user
    // lands back on the page they requested, not always on /dashboard.
    useEffect(() => {
        if (isAuthLoading) return;
        if (!isAuthenticated) {
            const redirect = encodeURIComponent(pathname);
            router.replace(`/login?redirect=${redirect}`);
        }
    }, [isAuthenticated, isAuthLoading, router, pathname]);

    // In local development, auto-set the unlock flag so the passcode lock
    // never blocks navigation. Controlled by NEXT_PUBLIC_DEV_BYPASS_LOCK in
    // .env.development — that file is never loaded in production builds.
    const isDevBypass =
        process.env.NODE_ENV === 'development' &&
        process.env.NEXT_PUBLIC_DEV_BYPASS_LOCK === 'true';

    // Local Passcode Lock logic
    useEffect(() => {
        if (isAuthLoading || !isAuthenticated) return;

        // Skip lock check if on unlock or login routes
        if (pathname.startsWith('/unlock') || pathname === '/login') return;

        // Dev bypass: auto-unlock so local development is never blocked
        if (isDevBypass) {
            sessionStorage.setItem(UNLOCK_STORAGE_KEY, 'true');
            return;
        }

        const checkLock = () => {
            const isUnlocked = sessionStorage.getItem(UNLOCK_STORAGE_KEY) === 'true';
            if (!isUnlocked) {
                router.replace('/unlock');
            }
        };

        checkLock();

        // Listen for lock events or focus
        window.addEventListener('focus', checkLock);
        return () => window.removeEventListener('focus', checkLock);
    }, [isAuthLoading, isAuthenticated, pathname, router, isDevBypass]);

    // Auto-lock monitor (moved from PasscodeLock)
    useEffect(() => {
        if (isAuthLoading || !isAuthenticated || pathname.startsWith('/unlock')) return;

        // Dev bypass: skip auto-lock timer so the session never expires locally
        if (isDevBypass) return;

        let lastActivity = Date.now();
        const autoLockMs = parseInt(localStorage.getItem(AUTOLOCK_STORAGE_KEY) || '3600000', 10);

        const handleActivity = () => { lastActivity = Date.now(); };
        const events = ['mousedown', 'keydown', 'touchstart', 'mousemove'];
        events.forEach(e => window.addEventListener(e, handleActivity));

        const interval = setInterval(() => {
            if (Date.now() - lastActivity > autoLockMs) {
                sessionStorage.removeItem(UNLOCK_STORAGE_KEY);
                router.replace('/unlock');
            }
        }, 30000); // Check every 30s

        return () => {
            events.forEach(e => window.removeEventListener(e, handleActivity));
            clearInterval(interval);
        };
    }, [isAuthLoading, isAuthenticated, pathname, router, isDevBypass]);

    // Permission-based route guard — replaces the old Finance-only hardcoded guard.
    // Runs whenever the user, auth state, or pathname changes.
    // Skips special routes (/unlock, /login, /miniapp) that don't need module permissions.
    useEffect(() => {
        if (isAuthLoading || !isAuthenticated || !currentUser) return;

        const skipPrefixes = ['/unlock', '/login', '/miniapp'];
        if (skipPrefixes.some(p => pathname.startsWith(p))) return;

        // Root redirect is handled by the dashboard layout; skip it here
        if (pathname === '/') return;

        const allowedPaths = buildAllowedPaths(currentUser);

        // Check if the current path matches any allowed route (exact or prefix match)
        const isAllowed = allowedPaths.some(
            p => pathname === p || pathname.startsWith(p + '/')
        );

        if (!isAllowed) {
            const fallback = getDefaultRoute(currentUser);
            router.replace(fallback);
        }
    }, [isAuthLoading, isAuthenticated, currentUser, pathname, router]);

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsResizing(true);
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (isResizing) {
            const clamped = Math.max(SIDEBAR_MIN_WIDTH, Math.min(e.clientX, SIDEBAR_MAX_WIDTH));
            setSidebarWidth(clamped);
            if (isSidebarCollapsed) setSidebarCollapsed(false);
        }
    }, [isResizing, isSidebarCollapsed]);

    const handleMouseUp = useCallback(() => {
        setIsResizing(false);
        try { localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(sidebarWidthRef.current)); } catch { }
    }, []);

    useEffect(() => {
        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing, handleMouseMove, handleMouseUp]);

    useEffect(() => {
        document.body.style.cursor = isResizing ? 'col-resize' : '';
        document.body.style.userSelect = isResizing ? 'none' : '';

        const handleManualLock = () => {
            sessionStorage.removeItem(UNLOCK_STORAGE_KEY);
            router.replace('/unlock');
        };
        window.addEventListener('lock-app', handleManualLock);

        return () => { 
            document.body.style.cursor = ''; 
            document.body.style.userSelect = ''; 
            window.removeEventListener('lock-app', handleManualLock);
        };
    }, [isResizing, router]);

    if (isAuthLoading) return <BrandedLoader />;
    if (!isAuthenticated) return <>{children}</>;

    const effectiveSidebarWidth = isSidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : sidebarWidth;
    const isConstrained = CONSTRAINED_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'));
    const handleToggleCollapse = () => setSidebarCollapsed(prev => !prev);
    const closeSidebar = () => setSidebarOpen(false);
    const handleNavigate = (path: string) => { 
        router.push(path); 
        // Close sidebar after push so the navigation isn't delayed by a
        // simultaneous state update competing with router.push
        requestAnimationFrame(() => closeSidebar());
    };

    if (isMobile) {
        return (
            <div className="relative min-h-dvh bg-background">
                <Header onMenuClick={() => setSidebarOpen(!isSidebarOpen)} isSidebarOpen={isSidebarOpen} isMobile={true} />
                {isSidebarOpen && (
                    <div onClick={closeSidebar} className="fixed inset-0 bg-black/50 backdrop-blur-[2px] z-[90] lg:hidden" aria-hidden="true" />
                )}
                <Sidebar
                    isSidebarOpen={isSidebarOpen} width={280} isResizing={false} isCollapsed={false}
                    onToggleCollapse={() => {}} onNavigate={handleNavigate}
                    onResizeMouseDown={() => {}} onResizeDoubleClick={() => {}}
                />
                <main className="mobile-content px-3">
                    <div key={pathname} className="animate-slide-up">{children}</div>
                </main>
                <MobileBottomNav />
            </div>
        );
    }

    return (
        <div
            className="relative h-dvh max-h-dvh flex bg-background overflow-hidden"
            style={{ '--sidebar-width': `${effectiveSidebarWidth}px` } as React.CSSProperties}
        >
            <Sidebar
                isSidebarOpen={isSidebarOpen} width={effectiveSidebarWidth} isResizing={isResizing}
                isCollapsed={isSidebarCollapsed} onToggleCollapse={handleToggleCollapse}
                onNavigate={handleNavigate} onResizeMouseDown={handleMouseDown}
                onResizeDoubleClick={handleToggleCollapse}
            />
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden transition-[margin] duration-300 ease-in-out ml-[var(--sidebar-width)]">
                <Header onMenuClick={() => {}} isSidebarOpen={false} isMobile={false} />
                <main className={`flex-1 min-h-0 ${isConstrained ? 'overflow-hidden' : 'overflow-y-auto overflow-x-hidden'} ${!isConstrained ? 'p-3 md:p-4 lg:p-5' : ''}`}>
                    <div key={pathname} className={`${isConstrained ? 'h-full' : ''} animate-slide-up`}>
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
