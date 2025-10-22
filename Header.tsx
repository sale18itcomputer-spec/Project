import React, { useState, useRef, useEffect } from 'react';
import MenuIcon from './icons/MenuIcon';
import { useNavigation } from '../contexts/NavigationContext';
import BellIcon from './icons/BellIcon';
import { useNotification } from '../contexts/NotificationContext';
import NotificationDropdown from './NotificationDropdown';
import { Notification } from '../types';
import { useAuth } from '../contexts/AuthContext';
import Avatar from './Avatar';
import ProfileDropdown from './ProfileDropdown';
import { transformToDirectImageUrl } from '../utils/imageUrl';
import { useConnectivity } from '../contexts/ConnectivityContext';

interface HeaderProps {
  onMenuClick: () => void;
  isSidebarOpen: boolean;
}

const OfflineIndicator = () => (
    <div className="ml-4 flex items-center gap-2 bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-1 rounded-full animate-pulse">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 010 12.728m-12.728 0a9 9 0 010-12.728m12.728 0L5.636 18.364m12.728 0L5.636 5.636" />
        </svg>
        <span>Offline</span>
    </div>
);

const Header: React.FC<HeaderProps> = ({ onMenuClick, isSidebarOpen }) => {
  const { navigation, handleNavigation } = useNavigation();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotification();
  const { currentUser } = useAuth();
  const { isOnline } = useConnectivity();
  const [isNotificationOpen, setNotificationOpen] = useState(false);
  const [isProfileOpen, setProfileOpen] = useState(false);
  const [isAvatarError, setAvatarError] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  
  const getTitle = () => {
    switch (navigation.view) {
      case 'projects':
        return 'Pipelines';
      case 'companies':
        return 'Companies';
      case 'contacts':
        return 'Contacts';
      case 'contact-logs':
        return 'Contact Logs';
      case 'site-surveys':
        return 'Site Surveys';
      case 'meetings':
        return 'Meetings';
      case 'quotations':
        return 'Quotations';
      case 'sale-orders':
        return 'Sale Orders';
      case 'dashboard':
      default:
        return 'Dashboard';
    }
  };

  // Reset avatar error state when user changes
  useEffect(() => {
    setAvatarError(false);
  }, [currentUser]);


  // Hook to close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
            setNotificationOpen(false);
        }
        if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
            setProfileOpen(false);
        }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
        document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleNotificationClick = (notification: Notification) => {
      markAsRead(notification.id);
      handleNavigation(notification.link);
      setNotificationOpen(false);
  };

  const sourceAvatar = currentUser ? currentUser.Picture : '';
  const avatarUrl = transformToDirectImageUrl(sourceAvatar);
  
  const isDashboard = navigation.view === 'dashboard';

  return (
    <header className="sticky top-0 bg-white/95 backdrop-blur-sm h-16 sm:h-20 px-4 sm:px-6 flex justify-between items-center shadow-sm z-10">
      <div className="flex items-center gap-3">
        <button
            onClick={onMenuClick}
            className="text-slate-500 hover:text-brand-600 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-500 lg:hidden"
            aria-controls="sidebar"
            aria-expanded={isSidebarOpen}
            aria-label="Toggle sidebar"
        >
            <span className="sr-only">Open sidebar</span>
            <MenuIcon />
        </button>
        <h1 className="text-xl sm:text-2xl font-semibold text-slate-800 truncate">{getTitle()}</h1>
        {!isOnline && <OfflineIndicator />}
      </div>
      <div className="flex items-center space-x-3 sm:space-x-5">
        {isDashboard && (
          <div className="relative hidden md:block">
            <label htmlFor="search-global" className="sr-only">Search</label>
            <svg className="w-5 h-5 text-slate-400 absolute top-1/2 left-3 -translate-y-1/2 z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            <input
              type="text"
              id="search-global"
              placeholder="Search..."
              className="bg-slate-100 border-transparent text-slate-800 placeholder-slate-400 text-sm rounded-lg focus:ring-2 focus:ring-brand-500/50 focus:bg-white focus:border-brand-500 block w-full pl-10 p-2.5 transition duration-200"
            />
          </div>
        )}
        <div className={`flex items-center space-x-4 ${isDashboard ? 'border-l border-slate-200 pl-3 sm:pl-5' : ''}`}>
            <div ref={notificationRef} className="relative">
              <button onClick={() => setNotificationOpen(prev => !prev)} className="relative p-2 rounded-full text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                  <span className="sr-only">View notifications</span>
                  <BellIcon />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-sky-500"></span>
                    </span>
                  )}
              </button>
              <NotificationDropdown
                isOpen={isNotificationOpen}
                notifications={notifications}
                onNotificationClick={handleNotificationClick}
                onMarkAllAsRead={markAllAsRead}
              />
            </div>
            <div ref={profileRef} className="relative">
                <button onClick={() => setProfileOpen(prev => !prev)} className="w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500">
                    {currentUser ? (
                        avatarUrl && !isAvatarError ? (
                            <img 
                                className="w-full h-full rounded-full object-cover" 
                                src={`${avatarUrl}${avatarUrl.includes('?') ? '&' : '?'}t=${new Date().getTime()}`}
                                alt={`${currentUser.Name}'s Avatar`}
                                onError={() => setAvatarError(true)}
                                referrerPolicy="no-referrer"
                            />
                        ) : (
                            <Avatar name={currentUser.Name} showName={false} className="w-full h-full text-base" />
                        )
                    ) : (
                        <div className="w-full h-full rounded-full bg-slate-200" />
                    )}
                </button>
                <ProfileDropdown isOpen={isProfileOpen} user={currentUser} />
            </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
