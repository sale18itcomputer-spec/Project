import React from 'react';
import { Notification } from '../types';
import { formatRelativeTime } from '../utils/time';
import { Calendar, AlertTriangle, CheckCircle, Bell } from 'lucide-react';

interface NotificationDropdownProps {
  isOpen: boolean;
  notifications: Notification[];
  onNotificationClick: (notification: Notification) => void;
  onMarkAllAsRead: () => void;
}

const NotificationIcon: React.FC<{ type: Notification['type'] }> = ({ type }) => {
    switch (type) {
        case 'due_date':
            return (
                <div className="w-10 h-10 rounded-full bg-sky-100 flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-5 h-5 text-sky-600" />
                </div>
            );
        case 'overdue':
             return (
                <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-5 h-5 text-rose-600" />
                </div>
            );
        case 'status_win':
            return (
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                </div>
            );
        default:
            return null;
    }
}

const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ isOpen, notifications, onNotificationClick, onMarkAllAsRead }) => {
    if (!isOpen) return null;
    
    return (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-slate-100 origin-top-right z-20 animate-contentFadeIn" style={{animationDuration: '0.2s'}}>
            {/* Header */}
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                <h3 className="font-semibold text-slate-800">Notifications</h3>
                {notifications.length > 0 && (
                     <button onClick={onMarkAllAsRead} className="text-xs font-semibold text-brand-600 hover:underline">Mark all as read</button>
                )}
            </div>

            {/* Body */}
            <div className="max-h-96 overflow-y-auto">
                {notifications.length > 0 ? (
                    <ul>
                        {notifications.map(n => (
                            <li key={n.id}>
                                <button onClick={() => onNotificationClick(n)} className="w-full text-left flex items-start gap-4 p-4 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0">
                                    <NotificationIcon type={n.type} />
                                    <div className="flex-1">
                                        <p className="font-semibold text-sm text-slate-800">{n.title}</p>
                                        <p className="text-sm text-slate-500 line-clamp-2">{n.description}</p>
                                        <p className="text-xs text-slate-400 mt-1">{formatRelativeTime(n.timestamp)}</p>
                                    </div>
                                </button>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="text-center p-12 text-slate-500">
                        <Bell className="w-12 h-12 mx-auto text-slate-300" />
                        <p className="font-semibold mt-4">All caught up!</p>
                        <p className="text-sm">You have no new notifications.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default NotificationDropdown;