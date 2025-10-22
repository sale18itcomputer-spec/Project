import React, { useState, useEffect } from 'react';
import { Menu, Bell, Search, LogOut, Info, CheckCircle, AlertTriangle } from 'lucide-react';
import { useNavigation } from '../contexts/NavigationContext';
import { useNotification } from '../contexts/NotificationContext';
import { Notification, User } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { transformToDirectImageUrl } from '../utils/imageUrl';
import { useConnectivity } from '../contexts/ConnectivityContext';
import { Button } from './ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { formatRelativeTime } from '../utils/time';
import { getInitials } from '../utils/formatters';

interface HeaderProps {
  onMenuClick: () => void;
  isSidebarOpen: boolean;
}

const OfflineIndicator = () => (
    <div className="ml-4 flex items-center gap-2 bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-1 rounded-full">
        <AlertTriangle className="h-4 w-4" />
        <span>Offline</span>
    </div>
);

const NotificationIcon: React.FC<{ type: Notification['type'] }> = ({ type }) => {
    switch (type) {
        case 'due_date': return <Bell className="w-5 h-5 text-sky-600" />;
        case 'overdue': return <AlertTriangle className="w-5 h-5 text-rose-600" />;
        case 'status_win': return <CheckCircle className="w-5 h-5 text-emerald-600" />;
        default: return <Bell className="w-5 h-5 text-slate-600" />;
    }
}

const Header: React.FC<HeaderProps> = ({ onMenuClick, isSidebarOpen }) => {
  const { navigation, handleNavigation } = useNavigation();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotification();
  const { currentUser, logout } = useAuth();
  const { isOnline } = useConnectivity();
  const [isAvatarError, setAvatarError] = useState(false);
  
  const getTitle = () => {
    switch (navigation.view) {
      case 'projects': return 'Pipelines';
      case 'companies': return 'Companies';
      case 'contacts': return 'Contacts';
      case 'contact-logs': return 'Contact Logs';
      case 'site-surveys': return 'Site Surveys';
      case 'meetings': return 'Meetings';
      case 'quotations': return 'Quotations';
      case 'sale-orders': return 'Sale Orders';
      case 'dashboard': default: return 'Dashboard';
    }
  };

  useEffect(() => { setAvatarError(false); }, [currentUser]);

  const handleNotificationClick = (notification: Notification) => {
      markAsRead(notification.id);
      handleNavigation(notification.link);
  };

  const avatarUrl = currentUser ? transformToDirectImageUrl(currentUser.Picture) : '';
  const isDashboard = navigation.view === 'dashboard';

  return (
    <header className="sticky top-0 bg-background/95 backdrop-blur-sm h-16 sm:h-20 px-4 sm:px-6 flex justify-between items-center border-b z-30">
      <div className="flex items-center gap-3">
        <Button
            onClick={onMenuClick}
            variant="ghost"
            size="icon"
            className="text-muted-foreground lg:hidden"
            aria-controls="sidebar"
            aria-expanded={isSidebarOpen}
            aria-label="Toggle sidebar"
        >
            <Menu />
        </Button>
        <h1 className="text-xl sm:text-2xl font-semibold text-foreground truncate">{getTitle()}</h1>
        {!isOnline && <OfflineIndicator />}
      </div>
      <div className="flex items-center space-x-3 sm:space-x-5">
        {isDashboard && (
          <div className="relative hidden md:block">
            <label htmlFor="search-global" className="sr-only">Search</label>
            <Search className="w-5 h-5 text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2 z-10" />
            <input
              type="text"
              id="search-global"
              placeholder="Search..."
              className="bg-muted border-transparent text-foreground placeholder-muted-foreground text-sm rounded-lg focus:ring-2 focus:ring-ring/50 focus:bg-background focus:border-primary block w-full pl-10 p-2.5 transition duration-200"
            />
          </div>
        )}
        <div className={`flex items-center space-x-2 sm:space-x-4 ${isDashboard ? 'border-l pl-3 sm:pl-5' : ''}`}>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="relative text-muted-foreground">
                        <Bell />
                        {unreadCount > 0 && (
                          <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
                          </span>
                        )}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80 sm:w-96">
                    <DropdownMenuLabel className="flex justify-between items-center">
                        <span>Notifications</span>
                        {notifications.length > 0 && (
                            <button onClick={markAllAsRead} className="text-xs font-semibold text-primary hover:underline">Mark all as read</button>
                        )}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <div className="max-h-96 overflow-y-auto">
                        {notifications.length > 0 ? (
                            notifications.map(n => (
                                <DropdownMenuItem key={n.id} onClick={() => handleNotificationClick(n)} className="flex items-start gap-3 p-3 cursor-pointer">
                                    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center flex-shrink-0"><NotificationIcon type={n.type} /></div>
                                    <div className="flex-1">
                                        <p className="font-semibold text-sm">{n.title}</p>
                                        <p className="text-sm text-muted-foreground line-clamp-2">{n.description}</p>
                                        <p className="text-xs text-muted-foreground mt-1">{formatRelativeTime(n.timestamp)}</p>
                                    </div>
                                </DropdownMenuItem>
                            ))
                        ) : (
                            <div className="text-center p-8 text-muted-foreground">
                                <Bell className="w-12 h-12 mx-auto text-slate-300" />
                                <p className="font-semibold mt-4">All caught up!</p>
                                <p className="text-sm">You have no new notifications.</p>
                            </div>
                        )}
                    </div>
                </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-9 w-9 sm:h-10 sm:w-10 rounded-full">
                      <Avatar className="h-9 w-9 sm:h-10 sm:w-10">
                        {currentUser && avatarUrl && !isAvatarError ? (
                           <AvatarImage src={`${avatarUrl}&t=${new Date().getTime()}`} alt={currentUser.Name} onError={() => setAvatarError(true)} />
                        ) : null}
                        <AvatarFallback>{currentUser ? getInitials(currentUser.Name) : '?'}</AvatarFallback>
                      </Avatar>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuLabel>
                        <p className="font-semibold truncate">{currentUser?.Name || 'User'}</p>
                        <p className="text-sm text-muted-foreground font-normal truncate">{currentUser?.Role || 'Role'}</p>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                        <Info className="mr-2 h-4 w-4" />
                        <span>Profile</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Logout</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
      </div>
    </header>
  );
};

export default Header;