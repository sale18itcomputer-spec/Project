import React from 'react';
import { LayoutDashboard, Building, Users, FileText, ShoppingCart, Filter, MessageSquare, Map, Calendar, ChevronLeft, ChevronRight, Tags } from 'lucide-react';
import { useNavigation, NavigationState } from '../contexts/NavigationContext';
import { useB2B } from '../contexts/B2BContext';
import { useAuth } from '../contexts/AuthContext';

interface SidebarProps {
  isSidebarOpen: boolean;
  width: number;
  isResizing: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onNavigate: (nav: NavigationState) => void;
  onResizeMouseDown: (e: React.MouseEvent) => void;
  onResizeDoubleClick: () => void;
}

const NavItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
  isCollapsed: boolean;
}> = ({ icon, label, isActive, onClick, isCollapsed }) => {
  const baseClasses = 'group flex items-center w-full text-left rounded-lg py-2.5 text-sm font-medium transition-all duration-200 ease-in-out';
  const activeClasses = 'bg-primary text-primary-foreground shadow-sm';
  const inactiveClasses = 'text-muted-foreground hover:bg-accent hover:text-accent-foreground';

  return (
    <li>
      <button
        onClick={onClick}
        className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses} ${isCollapsed ? 'justify-center px-3' : 'px-3'}`}
        aria-label={isCollapsed ? label : undefined}
      >
        <span className={`transition-colors ${isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-accent-foreground'}`}>{icon}</span>
        {!isCollapsed && <span className="ml-3 truncate">{label}</span>}
      </button>
    </li>
  );
};

const Sidebar: React.FC<SidebarProps> = ({ isSidebarOpen, width, isResizing, isCollapsed, onToggleCollapse, onNavigate, onResizeMouseDown, onResizeDoubleClick }) => {
  const { navigation } = useNavigation();
  const { isB2B } = useB2B();
  const { currentUser } = useAuth();

  const sidebarClasses = `
    fixed inset-y-0 left-0 bg-card border-r
    flex
    transform transition-transform duration-300 ease-in-out
    lg:translate-x-0
    z-30
    ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
    ${isResizing ? 'lg:transition-none' : 'lg:transition-[width] lg:duration-300 lg:ease-in-out'}
  `;

  return (
    <aside style={{ width: `${width}px` }} className={sidebarClasses}>
      <div className={`flex flex-col h-full flex-grow overflow-y-auto overflow-x-hidden ${isCollapsed ? 'p-3' : 'p-4'}`}>
        <div className={`flex items-center flex-shrink-0 h-16 border-b ${isCollapsed ? 'justify-center' : 'justify-center'}`}>
          <button
            onClick={() => onNavigate({ view: 'dashboard' })}
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
          <nav className="pt-6 space-y-6">
            {/* Main Section - Always visible */}
            <div>
              {!isCollapsed && <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Main</h3>}
              <ul className="mt-2 space-y-1">
                <NavItem
                  icon={<LayoutDashboard size={20} />}
                  label="Dashboard"
                  isActive={navigation.view === 'dashboard'}
                  onClick={() => onNavigate({ view: 'dashboard' })}
                  isCollapsed={isCollapsed}
                />
                <NavItem
                  icon={<Building size={20} />}
                  label="Companies"
                  isActive={navigation.view === 'companies'}
                  onClick={() => onNavigate({ view: 'companies' })}
                  isCollapsed={isCollapsed}
                />
                {/* Contacts - Hidden in B2B mode */}
                {!isB2B && (
                  <NavItem
                    icon={<Users size={20} />}
                    label="Contacts"
                    isActive={navigation.view === 'contacts'}
                    onClick={() => onNavigate({ view: 'contacts' })}
                    isCollapsed={isCollapsed}
                  />
                )}
                {/* User management - Admin only */}
                {currentUser?.Role === 'Admin' && (
                  <NavItem
                    icon={<Users size={20} />}
                    label="User Management"
                    isActive={navigation.view === 'users'}
                    onClick={() => onNavigate({ view: 'users' })}
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
                  isActive={navigation.view === 'quotations'}
                  onClick={() => onNavigate({ view: 'quotations' })}
                  isCollapsed={isCollapsed}
                />
                {/* Sale Orders - Hidden in B2B mode */}
                {!isB2B && (
                  <NavItem
                    icon={<ShoppingCart size={20} />}
                    label="Sale Orders"
                    isActive={navigation.view === 'sale-orders'}
                    onClick={() => onNavigate({ view: 'sale-orders' })}
                    isCollapsed={isCollapsed}
                  />
                )}
                {/* Invoice & DO - Hidden in B2B mode */}
                {!isB2B && (
                  <NavItem
                    icon={<FileText size={20} />}
                    label="Invoice & DO"
                    isActive={navigation.view === 'invoice-do'}
                    onClick={() => onNavigate({ view: 'invoice-do' })}
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
                    isActive={navigation.view === 'b2b-pricelist'}
                    onClick={() => onNavigate({ view: 'b2b-pricelist' })}
                    isCollapsed={isCollapsed}
                  />
                ) : (
                  <NavItem
                    icon={<Tags size={20} />}
                    label="Pricelist"
                    isActive={navigation.view === 'pricelist'}
                    onClick={() => onNavigate({ view: 'pricelist' })}
                    isCollapsed={isCollapsed}
                  />
                )}
              </ul>
            </div>

            {/* Logs Section */}
            <div>
              {isCollapsed ? <hr className="my-4" /> : <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Logs</h3>}
              <ul className="mt-2 space-y-1">
                <NavItem
                  icon={<Filter size={20} />}
                  label="Pipelines"
                  isActive={navigation.view === 'projects'}
                  onClick={() => onNavigate({ view: 'projects' })}
                  isCollapsed={isCollapsed}
                />
                {/* Contact Logs - Hidden in B2B mode */}
                {!isB2B && (
                  <NavItem
                    icon={<MessageSquare size={20} />}
                    label="Contact Logs"
                    isActive={navigation.view === 'contact-logs'}
                    onClick={() => onNavigate({ view: 'contact-logs' })}
                    isCollapsed={isCollapsed}
                  />
                )}
                {/* Site Surveys - Hidden in B2B mode */}
                {!isB2B && (
                  <NavItem
                    icon={<Map size={20} />}
                    label="Site Surveys"
                    isActive={navigation.view === 'site-surveys'}
                    onClick={() => onNavigate({ view: 'site-surveys' })}
                    isCollapsed={isCollapsed}
                  />
                )}
                {/* Meetings - Hidden in B2B mode */}
                {!isB2B && (
                  <NavItem
                    icon={<Calendar size={20} />}
                    label="Meetings"
                    isActive={navigation.view === 'meetings'}
                    onClick={() => onNavigate({ view: 'meetings' })}
                    isCollapsed={isCollapsed}
                  />
                )}
              </ul>
            </div>
          </nav>
        </div>
        <div className={`mt-auto flex-shrink-0 border-t pt-3`}>
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
        <div className={`w-0.5 h-full bg-transparent group-hover:bg-primary/50 transition-colors duration-200 mx-auto ${isResizing ? '!bg-primary' : ''}`}></div>
      </div>
    </aside>
  );
};

export default Sidebar;