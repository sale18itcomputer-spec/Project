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

export const FINANCE_ALLOWED_PATHS = ['/invoices', '/delivery-orders', '/receipts'];

const SIDEBAR_WIDTH_STORAGE_KEY = 'limperial-sidebar-width';
const SIDEBAR_COLLAPSED_WIDTH = 80;
const SIDEBAR_INITIAL_WIDTH = 220;
const SIDEBAR_MIN_WIDTH = 200;
const SIDEBAR_MAX_WIDTH = 500;

const CONSTRAINED_ROUTES = [
    '/projects', '/companies', '/contacts', '/contact-logs',
    '/site-surveys', '/meetings', '/pricelist', '/b2b-pricelist',
    '/quotations', '/sale-orders', '/invoices', '/delivery-orders',
    '/receipts', '/users', '/vendors', '/vendor-pricelist',
    '/purchase-orders', '/weekly-report',
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

    // Auth redirect
    useEffect(() => {
        if (isAuthLoading) return;
        if (!isAuthenticated) router.replace('/login');
    }, [isAuthenticated, isAuthLoading, router]);

    // Local Passcode Lock logic
    useEffect(() => {
        if (isAuthLoading || !isAuthenticated) return;
        
        // Skip lock check if on unlock or login routes
        if (pathname.startsWith('/unlock') || pathname === '/login') return;

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
    }, [isAuthLoading, isAuthenticated, pathname, router]);

    // Auto-lock monitor (moved from PasscodeLock)
    useEffect(() => {
        if (isAuthLoading || !isAuthenticated || pathname.startsWith('/unlock')) return;

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
    }, [isAuthLoading, isAuthenticated, pathname, router]);

    // Finance role guard
    useEffect(() => {
        if (isAuthLoading || !isAuthenticated) return;
        if (currentUser?.Role === 'Finance') {
            const allowed = FINANCE_ALLOWED_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'));
            if (!allowed) router.replace('/invoices');
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
    const handleNavigate = (path: string) => { router.push(path); closeSidebar(); };

    if (isMobile) {
        return (
            <div className="relative min-h-screen bg-background">
                <Header onMenuClick={() => setSidebarOpen(!isSidebarOpen)} isSidebarOpen={isSidebarOpen} isMobile={true} />
                {isSidebarOpen && (
                    <div onClick={closeSidebar} className="fixed inset-0 bg-black/60 z-[90] lg:hidden" aria-hidden="true" />
                )}
                <Sidebar
                    isSidebarOpen={isSidebarOpen} width={280} isResizing={false} isCollapsed={false}
                    onToggleCollapse={() => {}} onNavigate={handleNavigate}
                    onResizeMouseDown={() => {}} onResizeDoubleClick={() => {}}
                />
                <main className="mobile-content">
                    <div className="animate-slide-up">{children}</div>
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
                    <div className={`${isConstrained ? 'h-full' : ''} animate-slide-up`}>
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
