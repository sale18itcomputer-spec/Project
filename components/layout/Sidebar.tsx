'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Building, Users, FileText, ShoppingCart,
  Filter, MessageSquare, Map, Calendar, Tags, Truck, Package,
  ClipboardList, Calculator, BarChart2, Receipt, ChevronLeft,
  ChevronRight, UserCog,
} from 'lucide-react';
import { useB2B } from '@/contexts/B2BContext';
import { useAuth } from '@/contexts/AuthContext';
import { FINANCE_ALLOWED_PATHS } from '@/components/layout/AppShell';

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

// ── Nav Item ──────────────────────────────────────────────────────────────────
const NavItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
  isCollapsed: boolean;
  badge?: string;
}> = ({ icon, label, isActive, onClick, isCollapsed, badge }) => (
  <li>
    <button
      onClick={onClick}
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
  const { isB2B } = useB2B();
  const { currentUser } = useAuth();
  const isFinance = currentUser?.Role === 'Finance';
  const isAdmin = currentUser?.Role === 'Admin';
  const isSales = currentUser?.Role === 'Sales';

  const isActive = (path: string) => pathname === path;
  const go = (path: string) => () => onNavigate(path);

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
          {isFinance ? (
            <Section label="Finance" isCollapsed={isCollapsed}>
              <NavItem icon={<FileText size={16} />} label="Invoices" isActive={isActive('/invoices')} onClick={go('/invoices')} isCollapsed={isCollapsed} />
              <NavItem icon={<Truck size={16} />} label="Delivery Orders" isActive={isActive('/delivery-orders')} onClick={go('/delivery-orders')} isCollapsed={isCollapsed} />
              <NavItem icon={<Receipt size={16} />} label="Receipts" isActive={isActive('/receipts')} onClick={go('/receipts')} isCollapsed={isCollapsed} />
            </Section>
          ) : (
            <>
              <Section label="Overview" isCollapsed={isCollapsed}>
                <NavItem icon={<LayoutDashboard size={16} />} label="Dashboard" isActive={isActive('/')} onClick={go('/')} isCollapsed={isCollapsed} />
                <NavItem icon={<Building size={16} />} label="Companies" isActive={isActive('/companies')} onClick={go('/companies')} isCollapsed={isCollapsed} />
                {!isB2B && <NavItem icon={<Users size={16} />} label="Contacts" isActive={isActive('/contacts')} onClick={go('/contacts')} isCollapsed={isCollapsed} />}
                {isAdmin && <NavItem icon={<UserCog size={16} />} label="Users" isActive={isActive('/users')} onClick={go('/users')} isCollapsed={isCollapsed} />}
              </Section>

              <Section label="Sales" isCollapsed={isCollapsed}>
                <NavItem icon={<FileText size={16} />} label="Quotations" isActive={isActive('/quotations')} onClick={go('/quotations')} isCollapsed={isCollapsed} />
                {!isB2B && <NavItem icon={<ShoppingCart size={16} />} label="Sale Orders" isActive={isActive('/sale-orders')} onClick={go('/sale-orders')} isCollapsed={isCollapsed} />}
                {!isB2B && <NavItem icon={<FileText size={16} />} label="Invoices" isActive={isActive('/invoices')} onClick={go('/invoices')} isCollapsed={isCollapsed} />}
                {!isB2B && <NavItem icon={<Truck size={16} />} label="Delivery Orders" isActive={isActive('/delivery-orders')} onClick={go('/delivery-orders')} isCollapsed={isCollapsed} />}
                {!isB2B && <NavItem icon={<Receipt size={16} />} label="Receipts" isActive={isActive('/receipts')} onClick={go('/receipts')} isCollapsed={isCollapsed} />}
                {!isB2B && <NavItem icon={<BarChart2 size={16} />} label="Weekly Report" isActive={isActive('/weekly-report')} onClick={go('/weekly-report')} isCollapsed={isCollapsed} />}
              </Section>

              <Section label="Products" isCollapsed={isCollapsed}>
                {isB2B
                  ? <NavItem icon={<Tags size={16} />} label="B2B Pricelist" isActive={isActive('/b2b-pricelist')} onClick={go('/b2b-pricelist')} isCollapsed={isCollapsed} />
                  : <NavItem icon={<Tags size={16} />} label="Pricelist" isActive={isActive('/pricelist')} onClick={go('/pricelist')} isCollapsed={isCollapsed} />
                }
                <NavItem icon={<Package size={16} />} label="Vendor Pricelist" isActive={isActive('/vendor-pricelist')} onClick={go('/vendor-pricelist')} isCollapsed={isCollapsed} />
                {!isSales && <NavItem icon={<Truck size={16} />} label="Vendor Master" isActive={isActive('/vendors')} onClick={go('/vendors')} isCollapsed={isCollapsed} />}
              </Section>

              {isAdmin && (
                <Section label="Procurement" isCollapsed={isCollapsed}>
                  <NavItem icon={<ClipboardList size={16} />} label="Purchase Orders" isActive={isActive('/purchase-orders')} onClick={go('/purchase-orders')} isCollapsed={isCollapsed} />
                </Section>
              )}

              <Section label="Activity" isCollapsed={isCollapsed}>
                <NavItem icon={<Filter size={16} />} label="Pipelines" isActive={isActive('/projects')} onClick={go('/projects')} isCollapsed={isCollapsed} />
                {!isB2B && <NavItem icon={<MessageSquare size={16} />} label="Contact Logs" isActive={isActive('/contact-logs')} onClick={go('/contact-logs')} isCollapsed={isCollapsed} />}
                {!isB2B && <NavItem icon={<Map size={16} />} label="Site Surveys" isActive={isActive('/site-surveys')} onClick={go('/site-surveys')} isCollapsed={isCollapsed} />}
                {!isB2B && <NavItem icon={<Calendar size={16} />} label="Meetings" isActive={isActive('/meetings')} onClick={go('/meetings')} isCollapsed={isCollapsed} />}
              </Section>

              <Section label="Tools" isCollapsed={isCollapsed}>
                <NavItem icon={<Calculator size={16} />} label="Pricing Calculator" isActive={isActive('/pricing-calculator')} onClick={go('/pricing-calculator')} isCollapsed={isCollapsed} />
              </Section>
            </>
          )}
        </nav>

        {/* Bottom */}
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
