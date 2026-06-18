'use client';

import React, { useCallback } from 'react';
import ReactDOM from 'react-dom';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Building, Users, FileText, ShoppingCart,
  Filter, MessageSquare, Map, Calendar, Tags, Truck, Package,
  ClipboardList, Calculator, BarChart2, Receipt, ChevronLeft,
  ChevronRight, UserCog, Wallet, Warehouse, BookOpen, PackageCheck, Search,
  Wrench, ClipboardCheck, Hash, Boxes, ShoppingBag, Maximize2,
} from 'lucide-react';
import { useB2B } from '@/contexts/B2BContext';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useData } from '@/contexts/DataContext';
import { useWindowManager } from '../../contexts/WindowManagerContext';

// Mapping from route path → data modules each page needs.
// On hover, both the JS chunk (router.prefetch) and the data (fetchModule)
// start loading before the user clicks — eliminating the serial waterfall.
const PATH_TO_MODULES: Record<string, string[]> = {
  '/dashboard':        ['Quotations', 'Sale Orders'],
  '/':                 ['Quotations', 'Sale Orders'],
  '/companies':        ['Company List'],
  '/contacts':         ['Contact_List'],
  '/contact-logs':     ['Contact_Logs'],
  '/meetings':         ['Meeting_Logs'],
  '/site-surveys':     ['Site_Survey_Logs'],
  '/projects':         ['Pipelines'],
  '/users':            [],
  '/quotations':       ['Quotations'],
  '/sale-orders':      ['Sale Orders', 'Inventory', 'Raw'],
  '/invoices':         ['Invoices'],
  '/delivery-orders':  ['Delivery Orders', 'Invoices'],
  '/receipts':         ['Receipts', 'Invoices', 'Delivery Orders'],
  '/collection':       ['Invoices', 'Receipts'],
  '/weekly-report':    ['Sale Orders', 'Quotations', 'Contact_Logs', 'Site_Survey_Logs', 'Invoices'],
  '/pricelist':        ['Raw'],
  '/b2b-pricelist':    ['Raw'],
  '/vendors':          ['Vendors'],
  '/vendor-pricelist': ['Vendors', 'Vendor Pricelist'],
  '/purchase-orders':  ['Vendors', 'Vendor Pricelist', 'Purchase Orders', 'Raw'],
  '/inventory':        ['Inventory', 'Purchase Orders', 'Vendors'],
  '/inquiries':        ['Product Inquiries'],
  '/service-tickets':  ['Service Tickets'],
  '/pdi-records':      ['PDI Records'],
  '/serial-numbers':   ['Serial Numbers'],
  '/spare-parts':      ['Spare Parts'],
  '/pos':              ['Raw', 'Invoices', 'Receipts'],
};

// Lazy-loaded dashboard panels — chunk only fetched when first window is opened
const LazyOverviewDashboard        = React.lazy(() => import('../dashboards/shared/Dashboard'));
const LazyCompanyDashboard         = React.lazy(() => import('../dashboards/crm/CompanyDashboard'));
const LazyContactDashboard         = React.lazy(() => import('../dashboards/crm/ContactDashboard'));
const LazyContactLogsDashboard     = React.lazy(() => import('../dashboards/crm/ContactLogsDashboard'));
const LazyMeetingDashboard         = React.lazy(() => import('../dashboards/crm/MeetingDashboard'));
const LazyQuotationDashboard       = React.lazy(() => import('../dashboards/sales/QuotationDashboard'));
const LazySaleOrderDashboard       = React.lazy(() => import('../dashboards/sales/SaleOrderDashboard'));
const LazyInvoiceDashboard         = React.lazy(() => import('../dashboards/sales/InvoiceDashboard'));
const LazyDeliveryOrderDashboard   = React.lazy(() => import('../dashboards/sales/DeliveryOrderDashboard'));
const LazyReceiptDashboard         = React.lazy(() => import('../dashboards/sales/ReceiptDashboard'));
const LazyCollectionDashboard      = React.lazy(() => import('../dashboards/sales/CollectionDashboard'));
const LazyWeeklyReportDashboard    = React.lazy(() => import('../dashboards/sales/WeeklyReportDashboard'));
const LazyPurchaseOrderDashboard   = React.lazy(() => import('../dashboards/sales/PurchaseOrderDashboard'));
const LazyInventoryDashboard       = React.lazy(() => import('../dashboards/inventory/InventoryDashboard'));
const LazyPricelistDashboard       = React.lazy(() => import('../dashboards/inventory/PricelistDashboard'));
const LazyB2BPricelistDashboard    = React.lazy(() => import('../dashboards/inventory/B2BPricelistDashboard'));
const LazyVendorPricelistDashboard = React.lazy(() => import('../dashboards/inventory/VendorPricelistDashboard'));
const LazyVendorDashboard          = React.lazy(() => import('../dashboards/inventory/VendorDashboard'));
const LazyConsignmentDashboard     = React.lazy(() => import('../dashboards/inventory/ConsignmentDashboard'));
const LazyInquiryDashboard         = React.lazy(() => import('../dashboards/procurement/InquiryDashboard'));
const LazyServiceTicketDashboard   = React.lazy(() => import('../dashboards/service/ServiceTicketDashboard'));
const LazyPdiDashboard             = React.lazy(() => import('../dashboards/service/PdiDashboard'));
const LazySerialNumberDashboard    = React.lazy(() => import('../dashboards/service/SerialNumberDashboard'));
const LazySparePartDashboard       = React.lazy(() => import('../dashboards/service/SparePartDashboard'));
const LazyPipelineDashboard        = React.lazy(() => import('../dashboards/operations/PipelineDashboard'));
const LazySiteSurveyDashboard      = React.lazy(() => import('../dashboards/operations/SiteSurveyDashboard'));
const LazyAccountingDashboard      = React.lazy(() => import('../dashboards/accounting/AccountingDashboard'));

interface SidebarProps {
  isSidebarOpen: boolean;
  width: number;
  isResizing: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onNavigate: (path: string) => void;
  onResizeMouseDown: (e: React.MouseEvent) => void;
  onResizeDoubleClick: () => void;
}

// ── Nav Item Context Menu (portal) ────────────────────────────────────────────
const NavItemContextMenu: React.FC<{
  x: number;
  y: number;
  onOpenWindow: () => void;
  onClose: () => void;
}> = ({ x, y, onOpenWindow, onClose }) => {
  React.useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (!(e.target as Element).closest('[data-nav-ctx-menu]')) onClose();
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  return ReactDOM.createPortal(
    <div
      data-nav-ctx-menu="true"
      className="fixed z-[300] bg-popover border border-border rounded-md shadow-lg py-1 min-w-[180px]"
      style={{ left: x, top: y }}
    >
      <button
        onClick={() => { onOpenWindow(); onClose(); }}
        className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-accent text-foreground text-left"
      >
        <Maximize2 size={13} className="text-muted-foreground" /> Open in Window
      </button>
    </div>,
    document.body
  );
};

// ── Nav Item ──────────────────────────────────────────────────────────────────
const NavItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
  onPrefetch?: () => void;
  isCollapsed: boolean;
  badge?: string;
  onOpenWindow?: () => void;
}> = ({ icon, label, isActive, onClick, onPrefetch, isCollapsed, badge, onOpenWindow }) => {
  const [ctxMenu, setCtxMenu] = React.useState<{ x: number; y: number } | null>(null);

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!onOpenWindow) return;
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY });
  };

  return (
    <li>
      {ctxMenu && onOpenWindow && (
        <NavItemContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          onOpenWindow={onOpenWindow}
          onClose={() => setCtxMenu(null)}
        />
      )}
      <button
        onClick={onClick}
        onMouseEnter={onPrefetch}
        onContextMenu={handleContextMenu}
        title={isCollapsed ? label : undefined}
        className={`
          group relative flex items-center w-full text-left
          transition-all duration-150
          ${isCollapsed
            ? 'justify-center w-9 h-9 mx-auto rounded-lg'
            : 'px-2.5 py-1.5 rounded-md'
          }
          ${isActive
            ? isCollapsed
              ? 'bg-brand-600/10 text-brand-600 dark:text-brand-400'
              : 'text-brand-600 dark:text-brand-400 bg-brand-600/8'
            : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'
          }
        `}
      >
        {/* Active indicator bar */}
        {isActive && !isCollapsed && (
          <span className="absolute left-0 inset-y-1 w-[3px] rounded-full bg-brand-600 dark:bg-brand-400" />
        )}

        {/* Icon */}
        <span className={`
          shrink-0
          ${isActive
            ? 'text-brand-600 dark:text-brand-400'
            : 'text-muted-foreground/70 group-hover:text-foreground'
          }
        `}>
          {icon}
        </span>

        {/* Label */}
        {!isCollapsed && (
          <div className="ml-2.5 flex items-center justify-between flex-1 min-w-0">
            <span className={`text-[13px] font-medium truncate ${isActive ? 'font-semibold' : ''}`}>
              {label}
            </span>
            {badge && (
              <span className="ml-2 px-1.5 py-px text-[9px] font-bold uppercase tracking-wider rounded bg-brand-600/10 text-brand-600 dark:text-brand-400">
                {badge}
              </span>
            )}
          </div>
        )}

        {/* Collapsed tooltip */}
        {isCollapsed && (
          <span className="
            pointer-events-none absolute left-full ml-2.5 z-50
            px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap
            bg-popover text-popover-foreground border border-border
            shadow-md opacity-0 -translate-x-1
            group-hover:opacity-100 group-hover:translate-x-0
            transition-all duration-150
          ">
            {label}
          </span>
        )}
      </button>
    </li>
  );
};

// ── Section ───────────────────────────────────────────────────────────────────
const Section: React.FC<{
  label: string;
  isCollapsed: boolean;
  children: React.ReactNode;
}> = ({ label, isCollapsed, children }) => (
  <div>
    {isCollapsed
      ? <div className="my-2 border-t border-border/40" />
      : (
        <p className="px-2.5 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/50 select-none">
          {label}
        </p>
      )
    }
    <ul className="space-y-px">
      {children}
    </ul>
  </div>
);

// ── User card ─────────────────────────────────────────────────────────────────
const UserCard: React.FC<{ user: any; isCollapsed: boolean }> = ({ user, isCollapsed }) => {
  const initials = user?.Name
    ? user.Name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  if (isCollapsed) {
    return (
      <div className="flex justify-center" title={`${user?.Name} · ${user?.Role}`}>
        <div className="w-7 h-7 rounded-full bg-brand-600 text-white text-[10px] font-bold flex items-center justify-center">
          {initials}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-md hover:bg-accent/60 transition-colors cursor-default">
      <div className="w-7 h-7 rounded-full bg-brand-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-semibold text-foreground truncate leading-tight">
          {user?.Name || 'Unknown'}
        </p>
        <p className="text-[10px] text-muted-foreground/70 leading-tight mt-px">
          {user?.Role || 'User'}
        </p>
      </div>
    </div>
  );
};

// ── Sidebar ───────────────────────────────────────────────────────────────────
const Sidebar: React.FC<SidebarProps> = ({
  isSidebarOpen, width, isResizing, isCollapsed,
  onToggleCollapse, onNavigate, onResizeMouseDown, onResizeDoubleClick,
}) => {
  const pathname = usePathname();
  const router = useRouter();
  const { isB2B } = useB2B();
  const { currentUser } = useAuth();
  const { canView } = usePermissions();
  const { fetchModule } = useData();
  const { openWindow } = useWindowManager();

  // Optimistic active path — set on click, cleared when pathname catches up.
  // This makes the clicked item highlight immediately instead of waiting for
  // the full Next.js navigation commit (which can take 200-400ms).
  const [pendingPath, setPendingPath] = React.useState<string | null>(null);
  React.useEffect(() => {
    // Once the router has committed to the new path, clear the pending state
    setPendingPath(null);
  }, [pathname]);

  // Helpers
  const isActive = (path: string) => (pendingPath ?? pathname) === path;
  const go = (path: string) => () => {
    setPendingPath(path);
    onNavigate(path);
  };

  // On hover: prefetch the JS chunk (router.prefetch) AND start loading the
  // page's data modules (fetchModule). By the time the user clicks, the chunk
  // is cached and the data is already arriving from IDB / network — making
  // navigation feel near-instant.
  const prefetch = useCallback((path: string) => {
    router.prefetch(path);
    const modules = PATH_TO_MODULES[path];
    if (modules?.length) {
      void (fetchModule as (...args: string[]) => Promise<void>)(...modules);
    }
  }, [router, fetchModule]);

  // Open any dashboard as a floating window with a lazy-loaded component
  const openDashWindow = useCallback((
    title: string,
    LazyComponent: React.LazyExoticComponent<React.ComponentType<any>>,
    width: number = 1280,
    height: number = 780,
  ) => {
    const id = `dash-window-${title.toLowerCase().replace(/\s+/g, '-')}`;
    openWindow({
      id,
      title,
      content: (
        <React.Suspense fallback={
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading…</div>
        }>
          <LazyComponent />
        </React.Suspense>
      ),
      initialWidth: width,
      initialHeight: height,
      noPadding: true,
    });
  }, [openWindow]);

  // Pre-compute which nav items are visible — one call each, evaluated once per render.
  // Using the module keys from PERMISSION_MODULES.
  const show = {
    dashboard:          canView('dashboard'),
    companies:          canView('companies'),
    contacts:           canView('contacts'),
    contact_logs:       canView('contact_logs'),
    users:              canView('users'),
    quotations:         canView('quotations'),
    sale_orders:        canView('sale_orders'),
    invoices:           canView('invoices'),
    delivery_orders:    canView('delivery_orders'),
    receipts:           canView('receipts'),
    collection:         canView('collection'),
    weekly_report:      canView('weekly_report'),
    pricelist:          canView('pricelist'),
    b2b_pricelist:      canView('b2b_pricelist'),
    vendor_pricelist:   canView('vendor_pricelist'),
    vendors:            canView('vendors'),
    purchase_orders:    canView('purchase_orders'),
    inventory:          canView('inventory'),
    product_inquiries:  canView('product_inquiries'),
    consignment:        canView('consignment'),
    service_tickets:    canView('service_tickets'),
    pdi_records:        canView('pdi_records'),
    serial_numbers:     canView('serial_numbers'),
    spare_parts:        canView('spare_parts'),
    pipelines:          canView('pipelines'),
    site_surveys:       canView('site_surveys'),
    meetings:           canView('meetings'),
    pricing_calculator: canView('pricing_calculator'),
    accounting:         canView('accounting'),
    pos:                canView('pos'),
  };

  // Derived section visibility — a section only shows if at least one of its items is visible
  const showOverview     = show.dashboard || show.companies || show.contacts || show.users;
  const showSales        = show.quotations || show.sale_orders || show.invoices ||
                           show.delivery_orders || show.receipts || show.collection ||
                           show.weekly_report || show.pos;
  const showProducts     = show.pricelist || show.b2b_pricelist || show.vendor_pricelist || show.vendors;
  const showProcurement  = show.purchase_orders || show.inventory || show.product_inquiries || show.consignment;
  const showService      = show.service_tickets || show.pdi_records || show.serial_numbers || show.spare_parts;
  const showActivity     = show.pipelines || show.contact_logs || show.site_surveys || show.meetings;
  const showTools        = show.pricing_calculator || show.accounting;

  return (
    <aside
      style={{ width: `${width}px` }}
      className={`
        fixed inset-y-0 left-0 flex h-full z-[100]
        bg-background border-r border-border/50
        transform transition-transform duration-300 ease-in-out lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        ${isResizing ? 'lg:transition-none' : 'lg:transition-[width] lg:duration-300 lg:ease-in-out'}
      `}
    >
      <div className={`flex flex-col h-full w-full ${isCollapsed ? 'px-2 py-4' : 'px-3 py-4'}`}>

        {/* Logo */}
        <div className={`flex shrink-0 mb-5 ${isCollapsed ? 'justify-center' : 'px-1'}`}>
          <button
            onClick={go('/')}
            className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:opacity-75 transition-opacity"
            aria-label="Dashboard"
          >
            {isCollapsed
              ? (
                <div className="w-8 h-8 rounded-lg bg-brand-600 text-white text-xs font-black flex items-center justify-center tracking-tight">
                  L
                </div>
              )
              : <img src="https://i.imgur.com/Hur36Vc.png" alt="Limperial" className="h-7 w-auto" />
            }
          </button>
        </div>

        {/* Nav */}
        <nav className={`
          flex-1 overflow-y-auto overflow-x-hidden
          space-y-0
          [scrollbar-width:none] [&::-webkit-scrollbar]:hidden
        `}>

          {/* Overview */}
          {showOverview && (
            <Section label="Overview" isCollapsed={isCollapsed}>
              {show.dashboard && (
                <NavItem icon={<LayoutDashboard size={16} />} label="Dashboard"
                  isActive={isActive('/dashboard') || isActive('/')}
                  onClick={go('/dashboard')} onPrefetch={() => prefetch('/dashboard')} isCollapsed={isCollapsed}
                  onOpenWindow={() => openDashWindow('Dashboard', LazyOverviewDashboard)} />
              )}
              {show.companies && (
                <NavItem icon={<Building size={16} />} label="Companies"
                  isActive={isActive('/companies')} onClick={go('/companies')} onPrefetch={() => prefetch('/companies')} isCollapsed={isCollapsed}
                  onOpenWindow={() => openDashWindow('Companies', LazyCompanyDashboard)} />
              )}
              {show.contacts && (
                <NavItem icon={<Users size={16} />} label="Contacts"
                  isActive={isActive('/contacts')} onClick={go('/contacts')} onPrefetch={() => prefetch('/contacts')} isCollapsed={isCollapsed}
                  onOpenWindow={() => openDashWindow('Contacts', LazyContactDashboard)} />
              )}
              {show.users && (
                <NavItem icon={<UserCog size={16} />} label="Users"
                  isActive={isActive('/users')} onClick={go('/users')} onPrefetch={() => prefetch('/users')} isCollapsed={isCollapsed} />
              )}
            </Section>
          )}

          {/* Sales */}
          {showSales && (
            <Section label="Sales" isCollapsed={isCollapsed}>
              {show.pos && (
                <NavItem icon={<ShoppingBag size={16} />} label="POS"
                  isActive={isActive('/pos')} onClick={go('/pos')} onPrefetch={() => prefetch('/pos')} isCollapsed={isCollapsed} badge="NEW" />
              )}
              {show.quotations && (
                <NavItem icon={<FileText size={16} />} label="Quotations"
                  isActive={isActive('/quotations')} onClick={go('/quotations')} onPrefetch={() => prefetch('/quotations')} isCollapsed={isCollapsed}
                  onOpenWindow={() => openDashWindow('Quotations', LazyQuotationDashboard)} />
              )}
              {show.sale_orders && (
                <NavItem icon={<ShoppingCart size={16} />} label="Sale Orders"
                  isActive={isActive('/sale-orders')} onClick={go('/sale-orders')} onPrefetch={() => prefetch('/sale-orders')} isCollapsed={isCollapsed}
                  onOpenWindow={() => openDashWindow('Sale Orders', LazySaleOrderDashboard)} />
              )}
              {show.invoices && (
                <NavItem icon={<FileText size={16} />} label="Invoices"
                  isActive={isActive('/invoices')} onClick={go('/invoices')} onPrefetch={() => prefetch('/invoices')} isCollapsed={isCollapsed}
                  onOpenWindow={() => openDashWindow('Invoices', LazyInvoiceDashboard, 1300, 800)} />
              )}
              {show.delivery_orders && (
                <NavItem icon={<Truck size={16} />} label="Delivery Orders"
                  isActive={isActive('/delivery-orders')} onClick={go('/delivery-orders')} onPrefetch={() => prefetch('/delivery-orders')} isCollapsed={isCollapsed}
                  onOpenWindow={() => openDashWindow('Delivery Orders', LazyDeliveryOrderDashboard)} />
              )}
              {show.receipts && (
                <NavItem icon={<Receipt size={16} />} label="Receipts"
                  isActive={isActive('/receipts')} onClick={go('/receipts')} onPrefetch={() => prefetch('/receipts')} isCollapsed={isCollapsed}
                  onOpenWindow={() => openDashWindow('Receipts', LazyReceiptDashboard)} />
              )}
              {show.collection && (
                <NavItem icon={<Wallet size={16} />} label="Collection"
                  isActive={isActive('/collection')} onClick={go('/collection')} onPrefetch={() => prefetch('/collection')} isCollapsed={isCollapsed}
                  onOpenWindow={() => openDashWindow('Collection', LazyCollectionDashboard)} />
              )}
              {show.weekly_report && (
                <NavItem icon={<BarChart2 size={16} />} label="Weekly Report"
                  isActive={isActive('/weekly-report')} onClick={go('/weekly-report')} onPrefetch={() => prefetch('/weekly-report')} isCollapsed={isCollapsed}
                  onOpenWindow={() => openDashWindow('Weekly Report', LazyWeeklyReportDashboard, 1300, 820)} />
              )}

            </Section>
          )}

          {/* Products */}
          {showProducts && (
            <Section label="Products" isCollapsed={isCollapsed}>
              {isB2B
                ? show.b2b_pricelist && (
                  <NavItem icon={<Tags size={16} />} label="B2B Pricelist"
                    isActive={isActive('/b2b-pricelist')} onClick={go('/b2b-pricelist')} onPrefetch={() => prefetch('/b2b-pricelist')} isCollapsed={isCollapsed}
                    onOpenWindow={() => openDashWindow('B2B Pricelist', LazyB2BPricelistDashboard)} />
                )
                : show.pricelist && (
                  <NavItem icon={<Tags size={16} />} label="Pricelist"
                    isActive={isActive('/pricelist')} onClick={go('/pricelist')} onPrefetch={() => prefetch('/pricelist')} isCollapsed={isCollapsed}
                    onOpenWindow={() => openDashWindow('Pricelist', LazyPricelistDashboard)} />
                )
              }
              {show.vendor_pricelist && (
                <NavItem icon={<Package size={16} />} label="Vendor Pricelist"
                  isActive={isActive('/vendor-pricelist')} onClick={go('/vendor-pricelist')} onPrefetch={() => prefetch('/vendor-pricelist')} isCollapsed={isCollapsed}
                  onOpenWindow={() => openDashWindow('Vendor Pricelist', LazyVendorPricelistDashboard)} />
              )}
              {show.vendors && (
                <NavItem icon={<Truck size={16} />} label="Vendor Master"
                  isActive={isActive('/vendors')} onClick={go('/vendors')} onPrefetch={() => prefetch('/vendors')} isCollapsed={isCollapsed}
                  onOpenWindow={() => openDashWindow('Vendor Master', LazyVendorDashboard)} />
              )}
            </Section>
          )}

          {/* Procurement */}
          {showProcurement && (
            <Section label="Procurement" isCollapsed={isCollapsed}>
              {show.purchase_orders && (
                <NavItem icon={<ClipboardList size={16} />} label="Purchase Orders"
                  isActive={isActive('/purchase-orders')} onClick={go('/purchase-orders')} onPrefetch={() => prefetch('/purchase-orders')} isCollapsed={isCollapsed}
                  onOpenWindow={() => openDashWindow('Purchase Orders', LazyPurchaseOrderDashboard)} />
              )}
              {show.inventory && (
                <NavItem icon={<Warehouse size={16} />} label="Inventory"
                  isActive={isActive('/inventory')} onClick={go('/inventory')} onPrefetch={() => prefetch('/inventory')} isCollapsed={isCollapsed}
                  onOpenWindow={() => openDashWindow('Inventory', LazyInventoryDashboard)} />
              )}
              {show.product_inquiries && (
                <NavItem icon={<Search size={16} />} label="Inquiries"
                  isActive={isActive('/inquiries')} onClick={go('/inquiries')} onPrefetch={() => prefetch('/inquiries')} isCollapsed={isCollapsed}
                  onOpenWindow={() => openDashWindow('Inquiries', LazyInquiryDashboard)} />
              )}
              {show.consignment && (
                <NavItem icon={<PackageCheck size={16} />} label="Consignment"
                  isActive={isActive('/consignment')} onClick={go('/consignment')} isCollapsed={isCollapsed}
                  onOpenWindow={() => openDashWindow('Consignment', LazyConsignmentDashboard)} />
              )}
            </Section>
          )}

          {/* Service */}
          {showService && (
            <Section label="Service" isCollapsed={isCollapsed}>
              {show.service_tickets && (
                <NavItem icon={<Wrench size={16} />} label="Service Tickets"
                  isActive={isActive('/service-tickets')} onClick={go('/service-tickets')} onPrefetch={() => prefetch('/service-tickets')} isCollapsed={isCollapsed}
                  onOpenWindow={() => openDashWindow('Service Tickets', LazyServiceTicketDashboard)} />
              )}
              {show.pdi_records && (
                <NavItem icon={<ClipboardCheck size={16} />} label="PDI Records"
                  isActive={isActive('/pdi-records')} onClick={go('/pdi-records')} onPrefetch={() => prefetch('/pdi-records')} isCollapsed={isCollapsed}
                  onOpenWindow={() => openDashWindow('PDI Records', LazyPdiDashboard)} />
              )}
              {show.serial_numbers && (
                <NavItem icon={<Hash size={16} />} label="Serial Numbers"
                  isActive={isActive('/serial-numbers')} onClick={go('/serial-numbers')} onPrefetch={() => prefetch('/serial-numbers')} isCollapsed={isCollapsed}
                  onOpenWindow={() => openDashWindow('Serial Numbers', LazySerialNumberDashboard)} />
              )}
              {show.spare_parts && (
                <NavItem icon={<Boxes size={16} />} label="Spare Parts"
                  isActive={isActive('/spare-parts')} onClick={go('/spare-parts')} onPrefetch={() => prefetch('/spare-parts')} isCollapsed={isCollapsed}
                  onOpenWindow={() => openDashWindow('Spare Parts', LazySparePartDashboard)} />
              )}
            </Section>
          )}

          {/* Activity */}
          {showActivity && (
            <Section label="Activity" isCollapsed={isCollapsed}>
              {show.pipelines && (
                <NavItem icon={<Filter size={16} />} label="Pipelines"
                  isActive={isActive('/projects')} onClick={go('/projects')} onPrefetch={() => prefetch('/projects')} isCollapsed={isCollapsed}
                  onOpenWindow={() => openDashWindow('Pipelines', LazyPipelineDashboard)} />
              )}
              {show.contact_logs && (
                <NavItem icon={<MessageSquare size={16} />} label="Contact Logs"
                  isActive={isActive('/contact-logs')} onClick={go('/contact-logs')} onPrefetch={() => prefetch('/contact-logs')} isCollapsed={isCollapsed}
                  onOpenWindow={() => openDashWindow('Contact Logs', LazyContactLogsDashboard)} />
              )}
              {show.site_surveys && (
                <NavItem icon={<Map size={16} />} label="Site Surveys"
                  isActive={isActive('/site-surveys')} onClick={go('/site-surveys')} onPrefetch={() => prefetch('/site-surveys')} isCollapsed={isCollapsed}
                  onOpenWindow={() => openDashWindow('Site Surveys', LazySiteSurveyDashboard)} />
              )}
              {show.meetings && (
                <NavItem icon={<Calendar size={16} />} label="Meetings"
                  isActive={isActive('/meetings')} onClick={go('/meetings')} onPrefetch={() => prefetch('/meetings')} isCollapsed={isCollapsed}
                  onOpenWindow={() => openDashWindow('Meetings', LazyMeetingDashboard)} />
              )}
            </Section>
          )}

          {/* Accounting */}
          {showTools && (
            <Section label="Accounting" isCollapsed={isCollapsed}>
              {show.pricing_calculator && (
                <NavItem icon={<Calculator size={16} />} label="Pricing Calculator"
                  isActive={isActive('/pricing-calculator')} onClick={go('/pricing-calculator')} isCollapsed={isCollapsed} />
              )}
              {show.accounting && (
                <NavItem icon={<BookOpen size={16} />} label="Accounting"
                  isActive={isActive('/accounting')} onClick={go('/accounting')} isCollapsed={isCollapsed}
                  onOpenWindow={() => openDashWindow('Accounting', LazyAccountingDashboard, 1400, 860)} />
              )}
            </Section>
          )}
        </nav>

        {/* Bottom user card + collapse toggle */}
        <div className="shrink-0 pt-3 mt-2 border-t border-border/40 space-y-1">
          <UserCard user={currentUser} isCollapsed={isCollapsed} />
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex items-center justify-center w-full py-1 rounded-md text-muted-foreground/50 hover:text-muted-foreground hover:bg-accent/60 transition-all"
            aria-label={isCollapsed ? 'Expand' : 'Collapse'}
          >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={onResizeMouseDown}
        onDoubleClick={onResizeDoubleClick}
        className="absolute top-0 right-0 h-full w-1 cursor-col-resize z-40 hidden lg:block group"
        role="separator"
        aria-orientation="vertical"
      >
        <div className={`w-px h-full mx-auto bg-transparent group-hover:bg-brand-500/30 transition-colors duration-200 ${isResizing ? '!bg-brand-500/60' : ''}`} />
      </div>
    </aside>
  );
};

export default Sidebar;
