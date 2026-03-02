'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Building, Users, FileText, ShoppingCart, Filter, MessageSquare, Map, Calendar, ChevronLeft, ChevronRight, Tags, Truck, Package, ClipboardList } from 'lucide-react';
import { useB2B } from '@/contexts/B2BContext';
import { useAuth } from '@/contexts/AuthContext';

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

const NavItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
  isCollapsed: boolean;
  badge?: string;
  disabled?: boolean;
}> = ({ icon, label, isActive, onClick, isCollapsed, badge, disabled }) => {
  const baseClasses = 'group flex items-center w-full text-left rounded-lg py-2.5 text-sm font-medium transition-all duration-200 ease-in-out';
  const activeClasses = 'bg-primary text-primary-foreground shadow-sm';
  const inactiveClasses = 'text-muted-foreground hover:bg-accent hover:text-accent-foreground';
  const disabledClasses = 'opacity-50 cursor-not-allowed';

  return (
    <li>
      <button
        onClick={disabled ? undefined : onClick}
        className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses} ${isCollapsed ? 'justify-center px-3' : 'px-3'} ${disabled ? disabledClasses : ''}`}
        aria-label={isCollapsed ? label : undefined}
        disabled={disabled}
      >
        <span className={`transition-colors ${isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-accent-foreground'}`}>{icon}</span>
        {!isCollapsed && (
          <div className="ml-3 flex items-center justify-between flex-1 min-w-0">
            <span className="truncate">{label}</span>
            {badge && (
              <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-brand-500/10 text-brand-600 rounded">
                {badge}
              </span>
            )}
          </div>
        )}
      </button>
    </li>
  );
};

const Sidebar: React.FC<SidebarProps> = ({ isSidebarOpen, width, isResizing, isCollapsed, onToggleCollapse, onNavigate, onResizeMouseDown, onResizeDoubleClick }) => {
  const pathname = usePathname();
  const { isB2B } = useB2B();
  const { currentUser } = useAuth();

  const isActive = (path: string) => pathname === path;

  const sidebarClasses = `
    fixed inset-y-0 left-0 bg-card border-r
    flex
    transform transition-transform duration-300 ease-in-out
    lg:translate-x-0
    z-[100]
    ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
    ${isResizing ? 'lg:transition-none' : 'lg:transition-[width] lg:duration-300 lg:ease-in-out'}
  `;

  return (
    <aside style={{ width: `${width}px` }} className={sidebarClasses}>
      <div className={`flex flex-col h-full flex-grow overflow-y-auto overflow-x-hidden ${isCollapsed ? 'p-3' : 'p-4'}`}>
        <div className={`flex items-center flex-shrink-0 h-16 border-b ${isCollapsed ? 'justify-center' : 'justify-center'}`}>
          <button
            onClick={() => onNavigate('/')}
            className="focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring rounded-md transition-opacity hover:opacity-80"
            aria-label="Go to dashboard"
          >
            {isCollapsed ? (
              <div className="w-10 h-10 bg-primary text-primary-foreground font-sans font-bold text-base rounded-lg flex items-center justify-center shadow-md">LPT</div>
            ) : (
              <img
                src="https://i.imgur.com/Hur36Vc.png"
                alt="Limperial Company Logo"
                className="h-9 w-auto"
              />
            )}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <nav className="pt-4 space-y-4 sm:space-y-5">
            {/* Main Section */}
            <div>
              {!isCollapsed && <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Main</h3>}
              <ul className="mt-2 space-y-1">
                <NavItem
                  icon={<LayoutDashboard size={20} />}
                  label="Dashboard"
                  isActive={isActive('/')}
                  onClick={() => onNavigate('/')}
                  isCollapsed={isCollapsed}
                />
                <NavItem
                  icon={<Building size={20} />}
                  label="Companies"
                  isActive={isActive('/companies')}
                  onClick={() => onNavigate('/companies')}
                  isCollapsed={isCollapsed}
                />
                {!isB2B && (
                  <NavItem
                    icon={<Users size={20} />}
                    label="Contacts"
                    isActive={isActive('/contacts')}
                    onClick={() => onNavigate('/contacts')}
                    isCollapsed={isCollapsed}
                  />
                )}
                {currentUser?.Role === 'Admin' && (
                  <NavItem
                    icon={<Users size={20} />}
                    label="User Management"
                    isActive={isActive('/users')}
                    onClick={() => onNavigate('/users')}
                    isCollapsed={isCollapsed}
                  />
                )}
              </ul>
            </div>

            {/* Sales Documents Section */}
            <div>
              {isCollapsed ? <hr className="my-4" /> : <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sales Documents</h3>}
              <ul className="mt-2 space-y-1">
                <NavItem
                  icon={<FileText size={20} />}
                  label="Quotations"
                  isActive={isActive('/quotations')}
                  onClick={() => onNavigate('/quotations')}
                  isCollapsed={isCollapsed}
                />
                {!isB2B && (
                  <NavItem
                    icon={<ShoppingCart size={20} />}
                    label="Sale Orders"
                    isActive={isActive('/sale-orders')}
                    onClick={() => onNavigate('/sale-orders')}
                    isCollapsed={isCollapsed}
                  />
                )}
                {!isB2B && (
                  <NavItem
                    icon={<FileText size={20} />}
                    label="Invoice & DO"
                    isActive={isActive('/invoice-do')}
                    onClick={() => onNavigate('/invoice-do')}
                    isCollapsed={isCollapsed}
                  />
                )}
              </ul>
            </div>

            {/* Products Section */}
            <div>
              {isCollapsed ? <hr className="my-4" /> : <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Products</h3>}
              <ul className="mt-2 space-y-1">
                {isB2B ? (
                  <NavItem
                    icon={<Tags size={20} />}
                    label="B2B Pricelist"
                    isActive={isActive('/b2b-pricelist')}
                    onClick={() => onNavigate('/b2b-pricelist')}
                    isCollapsed={isCollapsed}
                  />
                ) : (
                  <NavItem
                    icon={<Tags size={20} />}
                    label="Pricelist"
                    isActive={isActive('/pricelist')}
                    onClick={() => onNavigate('/pricelist')}
                    isCollapsed={isCollapsed}
                  />
                )}
                <NavItem
                  icon={<Package size={20} />}
                  label="Vendor Pricelist"
                  isActive={isActive('/vendor-pricelist')}
                  onClick={() => onNavigate('/vendor-pricelist')}
                  isCollapsed={isCollapsed}
                />
                <NavItem
                  icon={<Truck size={20} />}
                  label="Vendor Master"
                  isActive={isActive('/vendors')}
                  onClick={() => onNavigate('/vendors')}
                  isCollapsed={isCollapsed}
                />
              </ul>
            </div>

            {/* Procurement Section - Admin only */}
            {currentUser?.Role === 'Admin' && (
              <div>
                {isCollapsed ? <hr className="my-4" /> : <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Procurement</h3>}
                <ul className="mt-2 space-y-1">
                  <NavItem
                    icon={<ClipboardList size={20} />}
                    label="Purchase Orders"
                    isActive={isActive('/purchase-orders')}
                    onClick={() => onNavigate('/purchase-orders')}
                    isCollapsed={isCollapsed}
                  />
                </ul>
              </div>
            )}

            {/* Logs Section */}
            <div>
              {isCollapsed ? <hr className="my-4" /> : <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Logs</h3>}
              <ul className="mt-2 space-y-1">
                <NavItem
                  icon={<Filter size={20} />}
                  label="Pipelines"
                  isActive={isActive('/projects')}
                  onClick={() => onNavigate('/projects')}
                  isCollapsed={isCollapsed}
                />
                {!isB2B && (
                  <NavItem
                    icon={<MessageSquare size={20} />}
                    label="Contact Logs"
                    isActive={isActive('/contact-logs')}
                    onClick={() => onNavigate('/contact-logs')}
                    isCollapsed={isCollapsed}
                  />
                )}
                {!isB2B && (
                  <NavItem
                    icon={<Map size={20} />}
                    label="Site Surveys"
                    isActive={isActive('/site-surveys')}
                    onClick={() => onNavigate('/site-surveys')}
                    isCollapsed={isCollapsed}
                  />
                )}
                {!isB2B && (
                  <NavItem
                    icon={<Calendar size={20} />}
                    label="Meetings"
                    isActive={isActive('/meetings')}
                    onClick={() => onNavigate('/meetings')}
                    isCollapsed={isCollapsed}
                  />
                )}
              </ul>
            </div>
          </nav>
        </div>

        <div className="mt-auto flex-shrink-0 border-t pt-3">
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex items-center justify-center w-full p-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight size={24} /> : <ChevronLeft size={24} />}
          </button>
        </div>
      </div>

      <div
        onMouseDown={onResizeMouseDown}
        onDoubleClick={onResizeDoubleClick}
        className="absolute top-0 right-0 h-full w-2 cursor-col-resize z-40 hidden lg:block group"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar (double-click to toggle collapse)"
      >
        <div className={`w-0.5 h-full bg-transparent group-hover:bg-primary/50 transition-colors duration-200 mx-auto ${isResizing ? '!bg-primary' : ''}`} />
      </div>
    </aside>
  );
};

export default Sidebar;