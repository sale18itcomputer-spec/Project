'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import Header from './Header';
import Footer from './Footer';
import MobileBottomNav from './MobileBottomNav';
import { useAuth } from '@/contexts/AuthContext';
import { useWindowSize } from '@/hooks/useWindowSize';
import BrandedLoader from '@/components/common/DashboardSkeleton';
import PasscodeLock from '@/components/common/PasscodeLock';

const SIDEBAR_WIDTH_STORAGE_KEY = 'limperial-sidebar-width';
const SIDEBAR_COLLAPSED_WIDTH = 80;
const SIDEBAR_INITIAL_WIDTH = 220;
const SIDEBAR_MIN_WIDTH = 200;
const SIDEBAR_MAX_WIDTH = 500;

// Routes that use a full-height constrained layout (no padding, overflow hidden)
const CONSTRAINED_ROUTES = [
    '/projects', '/companies', '/contacts', '/contact-logs',
    '/site-surveys', '/meetings', '/pricelist', '/b2b-pricelist',
    '/quotations', '/sale-orders', '/invoice-do', '/users',
    '/vendors', '/vendor-pricelist', '/purchase-orders',
    '/', // Dashboard uses its own internal scroll
];

export default function AppShell({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, isAuthLoading } = useAuth();
    const { width } = useWindowSize();
    const pathname = usePathname();
    const router = useRouter();

    const isMobile = width < 1024;

    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [sidebarWidth, setSidebarWidth] = useState(() => {
        if (typeof window === 'undefined') return SIDEBAR_INITIAL_WIDTH;
        try {
            const savedWidth = localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);
            if (savedWidth) {
                const parsed = parseInt(savedWidth, 10);
                return Math.max(SIDEBAR_MIN_WIDTH, Math.min(parsed, SIDEBAR_MAX_WIDTH));
            }
        } catch { /* ignore */ }
        return SIDEBAR_INITIAL_WIDTH;
    });
    const [isResizing, setIsResizing] = useState(false);

    const sidebarWidthRef = useRef(sidebarWidth);
    sidebarWidthRef.current = sidebarWidth;

    // Auth redirect
    useEffect(() => {
        if (isAuthLoading) return;
        if (!isAuthenticated) {
            router.replace('/login');
        }
    }, [isAuthenticated, isAuthLoading, router]);

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsResizing(true);
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (isResizing) {
            const newWidth = e.clientX;
            const clamped = Math.max(SIDEBAR_MIN_WIDTH, Math.min(newWidth, SIDEBAR_MAX_WIDTH));
            setSidebarWidth(clamped);
            if (isSidebarCollapsed) setSidebarCollapsed(false);
        }
    }, [isResizing, isSidebarCollapsed]);

    const handleMouseUp = useCallback(() => {
        setIsResizing(false);
        try {
            localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(sidebarWidthRef.current));
        } catch { /* ignore */ }
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
        if (isResizing) {
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        } else {
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
        return () => {
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, [isResizing]);

    // Show loader while auth is resolving
    if (isAuthLoading) {
        return <BrandedLoader />;
    }

    // Not authenticated — don't show shell while redirecting
    if (!isAuthenticated) {
        return <>{children}</>;
    }

    const effectiveSidebarWidth = isSidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : sidebarWidth;
    const isConstrained = CONSTRAINED_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'));
    const useDefaultPadding = !isConstrained;

    const handleToggleCollapse = () => setSidebarCollapsed(prev => !prev);
    const closeSidebar = () => setSidebarOpen(false);

    const handleNavigate = (path: string) => {
        router.push(path);
        closeSidebar();
    };

    if (isMobile) {
        return (
            <PasscodeLock>
                <div className="relative min-h-screen bg-background">
                    <Header
                        onMenuClick={() => setSidebarOpen(!isSidebarOpen)}
                        isSidebarOpen={isSidebarOpen}
                        isMobile={true}
                    />
                    {isSidebarOpen && (
                        <div
                            onClick={closeSidebar}
                            className="fixed inset-0 bg-black/60 z-[90] lg:hidden"
                            aria-hidden="true"
                        />
                    )}
                    <Sidebar
                        isSidebarOpen={isSidebarOpen}
                        width={280}
                        isResizing={false}
                        isCollapsed={false}
                        onToggleCollapse={() => { }}
                        onNavigate={handleNavigate}
                        onResizeMouseDown={() => { }}
                        onResizeDoubleClick={() => { }}
                    />
                    <main className="mobile-content">
                        <div className="animate-slide-up">
                            {children}
                        </div>
                    </main>
                    <MobileBottomNav />
                </div>
            </PasscodeLock>
        );
    }

    // Desktop
    return (
        <PasscodeLock>
            <div
                className="relative h-dvh max-h-dvh flex bg-background overflow-hidden"
                style={{ '--sidebar-width': `${effectiveSidebarWidth}px` } as React.CSSProperties}
            >
                <Sidebar
                    isSidebarOpen={isSidebarOpen}
                    width={effectiveSidebarWidth}
                    isResizing={isResizing}
                    isCollapsed={isSidebarCollapsed}
                    onToggleCollapse={handleToggleCollapse}
                    onNavigate={handleNavigate}
                    onResizeMouseDown={handleMouseDown}
                    onResizeDoubleClick={handleToggleCollapse}
                />
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden transition-[margin] duration-300 ease-in-out ml-[var(--sidebar-width)]">
                    <Header
                        onMenuClick={() => { }}
                        isSidebarOpen={false}
                        isMobile={false}
                    />
                    <main className={`flex-1 min-h-0 ${isConstrained ? 'overflow-hidden' : 'overflow-y-auto overflow-x-hidden'} ${useDefaultPadding ? 'p-3 md:p-4 lg:p-5' : ''}`}>
                        <div className={`${isConstrained ? 'h-full' : ''} animate-slide-up`}>
                            {children}
                        </div>
                    </main>
                    {!isConstrained && <Footer />}
                </div>
            </div>
        </PasscodeLock>
    );
}
