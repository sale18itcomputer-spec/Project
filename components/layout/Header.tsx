import React, { useState, useEffect } from 'react';
import { Menu, Bell, Search, LogOut, Info, CheckCircle, AlertTriangle, FileText, ShoppingCart, Briefcase, Calendar, MapPin, ShieldCheck, Lock } from 'lucide-react';
import { useNavigation } from "../../contexts/NavigationContext";

import { useNotification } from "../../contexts/NotificationContext";
import { Notification, User } from "../../types";
import { useAuth } from "../../contexts/AuthContext";
import { transformToDirectImageUrl } from "../../utils/imageUrl";
import { useConnectivity } from "../../contexts/ConnectivityContext";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { formatRelativeTime } from "../../utils/time";
import { getInitials } from "../../utils/formatters";
import B2BToggle from "../common/B2BToggle";

interface HeaderProps {
  onMenuClick: () => void;
  isSidebarOpen: boolean;
  isMobile: boolean;
}

const OfflineIndicator = () => (
  <div
    role="status"
    aria-live="assertive"
    className="ml-4 flex items-center gap-2 bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-1 rounded-full animate-pulse"
  >
    <AlertTriangle className="h-4 w-4" />
    <span className="hidden sm:inline">You are currently offline</span>
  </div>
);



const NotificationIcon: React.FC<{ type: Notification['type'] }> = ({ type }) => {
  switch (type) {
    case 'quotation': return <FileText className="w-5 h-5 text-orange-600" />;
    case 'sale_order': return <ShoppingCart className="w-5 h-5 text-emerald-600" />;
    case 'project': return <Briefcase className="w-5 h-5 text-indigo-600" />;
    case 'invoice': return <FileText className="w-5 h-5 text-blue-600" />;
    case 'meeting': return <Calendar className="w-5 h-5 text-sky-600" />;
    case 'site_survey': return <MapPin className="w-5 h-5 text-red-600" />;
    default: return <Bell className="w-5 h-5 text-slate-600" />;
  }
}

const Header: React.FC<HeaderProps> = ({ onMenuClick, isSidebarOpen, isMobile }) => {
  const { navigation, handleNavigation } = useNavigation();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotification();
  const { currentUser, logout } = useAuth();
  const { isOnline } = useConnectivity();
  const [isAvatarError, setAvatarError] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    setAvatarError(false);
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [currentUser]);

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    handleNavigation(notification.link);
  };

  const getBreadcrumbs = () => {
    const root = <span className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors" onClick={() => handleNavigation({ view: 'dashboard' })}>Home</span>;
    const separator = <span className="text-muted-foreground/40 mx-2">/</span>;

    let current = '';
    switch (navigation.view) {
      case 'projects': current = 'Pipelines'; break;
      case 'companies': current = 'Companies'; break;
      case 'contacts': current = 'Contacts'; break;
      case 'contact-logs': current = 'Contact Logs'; break;
      case 'site-surveys': current = 'Site Surveys'; break;
      case 'meetings': current = 'Meetings'; break;
      case 'quotations': current = 'Quotations'; break;
      case 'sale-orders': current = 'Sale Orders'; break;
      case 'pricelist': current = 'Pricelist'; break;
      case 'b2b-pricelist': current = 'B2B Pricelist'; break;
      case 'invoice-do': current = 'Invoice & DO'; break;
      case 'vendors': current = 'Vendors'; break;
      case 'vendor-pricelist': current = 'Vendor Pricelist'; break;
      case 'users': current = 'Users'; break;
      case 'dashboard': default: current = 'Dashboard'; break;
    }

    if (navigation.view === 'dashboard') return root;

    return (
      <div className="flex items-center text-sm font-medium">
        {root}
        {separator}
        <span className="text-foreground">{current}</span>
      </div>
    );
  };

  const avatarUrl = currentUser ? transformToDirectImageUrl(currentUser.Picture) : '';

  const isDashboard = navigation.view === 'dashboard';

  /* Removed getTitle function as we are now using breadcrumbs for desktop and only simplified title for mobile, handled inline or via separate logic if needed. 
     Wait, getTitle was used for mobile. Let's bringing it back or alternative. */

  const getMobileTitle = () => {
    switch (navigation.view) {
      case 'projects': return 'Pipelines';
      case 'companies': return 'Companies';
      case 'contacts': return 'Contacts';
      case 'contact-logs': return 'Contact Logs';
      case 'site-surveys': return 'Site Surveys';
      case 'meetings': return 'Meetings';
      case 'quotations': return 'Quotations';
      case 'sale-orders': return 'Sale Orders';
      case 'pricelist': return 'Pricelist';
      case 'b2b-pricelist': return 'B2B Pricelist';
      case 'invoice-do': return 'Invoice & DO';
      case 'vendors': return 'Vendors';
      case 'vendor-pricelist': return 'Vendor Price';
      case 'users': return 'Users';
      case 'dashboard': default: return 'Dashboard';
    }
  };

  const headerClasses = isMobile
    ? "mobile-nav"
    : `sticky top-0 bg-background/80 backdrop-blur-md h-16 sm:h-16 px-4 sm:px-5 flex justify-between items-center z-[80] transition-all duration-300 ${scrolled ? 'border-b shadow-sm' : 'border-b border-transparent'}`;

  return (
    <header className={headerClasses}>
      <div className="flex items-center gap-3">
        <Button
          onClick={onMenuClick}
          variant="ghost"
          size="icon"
          className="text-muted-foreground lg:hidden hover:bg-accent/50"
          aria-controls="sidebar"
          aria-expanded={isSidebarOpen}
          aria-label="Toggle sidebar"
        >
          <Menu />
        </Button>

        <div className="flex flex-col justify-center">
          {/* Show title on mobile, breadcrumbs on desktop */}
          <h1 className={`${isMobile ? 'block text-lg font-semibold mobile-nav-title' : 'hidden'}`}>{getMobileTitle()}</h1>
          <div className="hidden lg:block">
            {getBreadcrumbs()}
          </div>
        </div>

        {!isOnline && <OfflineIndicator />}
      </div>
      <div className="flex items-center space-x-3 sm:space-x-5">
        {!isMobile && (
          <div className={`relative hidden md:block transition-all duration-300 ease-in-out ${isSearchFocused ? 'w-96' : 'w-64 lg:w-72'}`}>
            <label htmlFor="search-global" className="sr-only">Search</label>
            <Search className={`w-4 h-4 absolute top-1/2 left-3 -translate-y-1/2 z-10 pointer-events-none transition-colors duration-300 ${isSearchFocused ? 'text-brand-500' : 'text-muted-foreground'}`} />
            <Input
              type="text"
              id="search-global"
              placeholder="Search..."
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              className={`pl-9 border-transparent shadow-sm transition-all duration-300 ${isSearchFocused ? 'bg-background ring-2 ring-brand-500/20 border-brand-500/50' : 'bg-muted/50 hover:bg-muted/80'}`}
            />
          </div>
        )}
        <B2BToggle />

        {/* Quick Lock Button */}
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-brand-600 transition-all duration-200 hover:bg-brand-50 hover:scale-105"
          onClick={() => {
            window.dispatchEvent(new CustomEvent('lock-app'));
          }}
          title="Lock Screen"
        >
          <Lock className="w-5 h-5" />
        </Button>

        <div className={`flex items-center space-x-2 sm:space-x-4 ${!isMobile && isDashboard ? 'border-l pl-3 sm:pl-5' : ''}`}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:bg-accent hover:text-foreground transition-colors" aria-label={`View notifications (${unreadCount} unread)`}>
                <Bell className={unreadCount > 0 ? 'text-foreground' : ''} />
                {unreadCount > 0 && (
                  <span className="absolute top-2.5 right-2 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 ring-2 ring-background"></span>
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 sm:w-96 p-0 shadow-xl border-border/60">
              <div className="p-4 flex justify-between items-center border-b bg-muted/30">
                <span className="font-semibold text-sm">Notifications</span>
                {notifications.length > 0 && (
                  <button onClick={markAllAsRead} className="text-xs font-medium text-brand-600 hover:text-brand-700 hover:underline transition-colors">Mark all as read</button>
                )}
              </div>
              <div className="max-h-[28rem] overflow-y-auto custom-scrollbar">
                {notifications.length > 0 ? (
                  notifications.map(n => (
                    <DropdownMenuItem
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`flex items-start gap-3 p-4 cursor-pointer border-b last:border-0 hover:bg-muted/50 transition-colors ${n.read ? 'opacity-75 bg-background' : 'bg-brand-50/30'}`}
                    >
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${n.read ? 'bg-muted text-muted-foreground' : 'bg-white ring-1 ring-border'}`}>
                        <NotificationIcon type={n.type} />
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex justify-between items-start gap-2">
                          <p className={`text-sm leading-none ${n.read ? 'font-medium text-foreground/90' : 'font-semibold text-foreground'}`}>{n.title}</p>
                          {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-1"></span>}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{n.description}</p>
                        <p className="text-[10px] text-muted-foreground/70 font-medium pt-1">{formatRelativeTime(n.timestamp)}</p>
                      </div>
                    </DropdownMenuItem>
                  ))
                ) : (
                  <div className="text-center py-12 px-8 text-muted-foreground">
                    <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse-soft">
                      <Bell className="w-8 h-8 text-muted-foreground/40" />
                    </div>
                    <p className="font-semibold text-foreground">All caught up!</p>
                    <p className="text-xs mt-1 text-muted-foreground/80">You have no new notifications to review.</p>
                  </div>
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 sm:h-10 sm:w-10 rounded-full ring-2 ring-transparent hover:ring-brand-100 transition-all p-0 overflow-hidden" aria-label="Open user menu">
                <Avatar className="h-full w-full">
                  {currentUser && avatarUrl && !isAvatarError ? (
                    <AvatarImage src={`${avatarUrl}&t=${new Date().getTime()}`} alt={currentUser.Name} onError={() => setAvatarError(true)} className="object-cover" />
                  ) : null}
                  <AvatarFallback className="bg-brand-100 text-brand-700 font-bold">{currentUser ? getInitials(currentUser.Name) : '?'}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 p-2 shadow-xl border-border/60">
              <div className="px-2 py-3 mb-2 bg-muted/30 rounded-md">
                <p className="font-semibold text-sm truncate">{currentUser?.Name || 'User'}</p>
                <p className="text-xs text-muted-foreground/80 font-medium truncate mt-0.5">{currentUser?.Role || 'Role'}</p>
              </div>
              <DropdownMenuItem onClick={() => window.dispatchEvent(new CustomEvent('open-security-modal'))} className="cursor-pointer py-2.5">
                <ShieldCheck className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>Security Settings</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => window.dispatchEvent(new CustomEvent('lock-app'))}
                className="cursor-pointer py-2.5"
              >
                <Lock className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>Lock Screen</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="my-2" />
              <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer py-2.5">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sign Out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};

export default Header;