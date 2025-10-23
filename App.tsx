import React, { useState, lazy, Suspense, useCallback, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import { DataProvider } from './contexts/DataContext';
import { NavigationProvider, useNavigation, NavigationState } from './contexts/NavigationContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './components/LoginPage';
import { Quotation } from './types';
import { Toaster } from './components/ui/sonner';
import { ConnectivityProvider } from './contexts/ConnectivityContext';
import BrandedLoader from './components/DashboardSkeleton';
import ContentSkeleton from './components/ContentSkeleton';
import Footer from './components/Footer';

// Lazy load components for code splitting and faster initial loads
const Dashboard = lazy(() => import('./components/Dashboard'));
const PipelineDashboard = lazy(() => import('./components/PipelineDashboard'));
const CompanyDashboard = lazy(() => import('./components/CompanyDashboard'));
const ContactDashboard = lazy(() => import('./components/ContactDashboard'));
const ContactLogsDashboard = lazy(() => import('./components/ContactLogsDashboard'));
const SiteSurveyDashboard = lazy(() => import('./components/SiteSurveyDashboard'));
const MeetingDashboard = lazy(() => import('./components/MeetingDashboard'));
const QuotationDashboard = lazy(() => import('./components/QuotationDashboard'));
const SaleOrderDashboard = lazy(() => import('./components/SaleOrderDashboard'));
const PricelistDashboard = lazy(() => import('./components/PricelistDashboard'));

const SIDEBAR_WIDTH_STORAGE_KEY = 'limperial-sidebar-width';

const AuthenticatedLayout: React.FC = () => {
  const SIDEBAR_COLLAPSED_WIDTH = 80;
  const SIDEBAR_INITIAL_WIDTH = 240;
  const SIDEBAR_MIN_WIDTH = 200;
  const SIDEBAR_MAX_WIDTH = 500;

  const [isSidebarOpen, setSidebarOpen] = useState(false); // For mobile drawer
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false); // For desktop collapse
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    try {
        const savedWidth = localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);
        if (savedWidth) {
            const parsedWidth = parseInt(savedWidth, 10);
            return Math.max(SIDEBAR_MIN_WIDTH, Math.min(parsedWidth, SIDEBAR_MAX_WIDTH));
        }
    } catch (error) {
        console.error('Failed to parse sidebar width from localStorage', error);
    }
    return SIDEBAR_INITIAL_WIDTH;
  });
  const [isResizing, setIsResizing] = useState(false);
  const { navigation, handleNavigation } = useNavigation();

  const sidebarWidthRef = useRef(sidebarWidth);
  sidebarWidthRef.current = sidebarWidth;

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isResizing) {
      const newWidth = e.clientX;
      const clampedWidth = Math.max(SIDEBAR_MIN_WIDTH, Math.min(newWidth, SIDEBAR_MAX_WIDTH));
      setSidebarWidth(clampedWidth);
      if (isSidebarCollapsed) {
        setSidebarCollapsed(false);
      }
    }
  }, [isResizing, isSidebarCollapsed]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
    try {
        localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(sidebarWidthRef.current));
    } catch (error) {
        console.error('Failed to save sidebar width to localStorage', error);
    }
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


  const closeSidebar = () => setSidebarOpen(false);
  
  const handleToggleCollapse = () => setSidebarCollapsed(prev => !prev);

  const handleNavWithSidebar = (nav: NavigationState) => {
    handleNavigation(nav);
    closeSidebar();
  };

  const renderContent = () => {
    switch (navigation.view) {
      case 'projects':
        return <PipelineDashboard initialFilter={navigation.filter} />;
      case 'companies':
        return <CompanyDashboard initialFilter={navigation.filter} />;
      case 'contacts':
        return <ContactDashboard initialFilter={navigation.filter} />;
      case 'contact-logs':
        return <ContactLogsDashboard initialFilter={navigation.filter} />;
      case 'site-surveys':
        return <SiteSurveyDashboard initialFilter={navigation.filter} />;
      case 'meetings':
        return <MeetingDashboard initialFilter={navigation.filter} />;
      case 'quotations':
        return <QuotationDashboard />;
      case 'sale-orders':
        return <SaleOrderDashboard quotationForSO={navigation.payload as Quotation | undefined} />;
      case 'pricelist':
        return <PricelistDashboard />;
      case 'dashboard':
      default:
        return <Dashboard />;
    }
  };

  const customLayoutViews = [
    'projects', 
    'companies', 
    'contacts', 
    'contact-logs', 
    'site-surveys', 
    'meetings',
    'pricelist',
  ];

  const useDefaultLayout = !customLayoutViews.includes(navigation.view);
  const needsConstrainedHeight = customLayoutViews.includes(navigation.view);

  const effectiveSidebarWidth = isSidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : sidebarWidth;

  return (
    <div className="relative h-screen flex bg-muted/40" style={{ '--sidebar-width': `${effectiveSidebarWidth}px` } as React.CSSProperties}>
      {isSidebarOpen && (
        <div
          onClick={closeSidebar}
          className="fixed inset-0 bg-black/60 z-20 lg:hidden"
          aria-hidden="true"
        ></div>
      )}

      <Sidebar
        isSidebarOpen={isSidebarOpen}
        width={effectiveSidebarWidth}
        isResizing={isResizing}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleCollapse}
        onNavigate={handleNavWithSidebar}
        onResizeMouseDown={handleMouseDown}
        onResizeDoubleClick={handleToggleCollapse}
      />

      <div className={`flex-1 flex flex-col transition-[margin] duration-300 ease-in-out lg:ml-[var(--sidebar-width)]`}>
        <Header
          onMenuClick={() => setSidebarOpen(!isSidebarOpen)}
          isSidebarOpen={isSidebarOpen}
        />
        <main className={`flex-1 ${needsConstrainedHeight ? 'overflow-hidden' : 'overflow-auto'} ${useDefaultLayout ? 'p-4 md:p-6 lg:p-8' : ''}`}>
          <Suspense fallback={<ContentSkeleton />}>
            <div key={`${navigation.view}-${navigation.filter}-${navigation.payload?.['Quote No.'] ?? ''}`} className={`${needsConstrainedHeight ? 'h-full' : ''}`}>
              {renderContent()}
            </div>
          </Suspense>
        </main>
        <Footer />
      </div>
    </div>
  );
};

const AppContent: React.FC = () => {
  const { isAuthenticated, isAuthLoading } = useAuth();

  if (isAuthLoading) {
    return <BrandedLoader />;
  }

  return isAuthenticated ? <AuthenticatedLayout /> : <LoginPage />;
};


const App: React.FC = () => {
  return (
    <DataProvider>
      <AuthProvider>
        <NavigationProvider>
          <NotificationProvider>
            <ConnectivityProvider>
              <AppContent />
              <Toaster />
            </ConnectivityProvider>
          </NotificationProvider>
        </NavigationProvider>
      </AuthProvider>
    </DataProvider>
  );
};

export default App;