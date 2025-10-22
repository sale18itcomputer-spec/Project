import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useMemo } from 'react';
import { useData } from './DataContext';
import { Notification } from '../types';
import { parseDate } from '../utils/time';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { projects, loading } = useData();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  // Load read IDs from localStorage on mount
  useEffect(() => {
    try {
      const storedIds = localStorage.getItem('readNotificationIds');
      if (storedIds) {
        // Correctly type the Set created from localStorage to avoid type errors.
        setReadIds(new Set<string>(JSON.parse(storedIds)));
      }
    } catch (error) {
      console.error("Failed to load read notification IDs from localStorage", error);
    }
  }, []);

  // Function to save read IDs to localStorage
  const saveReadIds = (ids: Set<string>) => {
    try {
      localStorage.setItem('readNotificationIds', JSON.stringify(Array.from(ids)));
    } catch (error) {
      console.error("Failed to save read notification IDs to localStorage", error);
    }
  };

  // Generate notifications when projects data is loaded
  useEffect(() => {
    if (loading || !projects) return;

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const generatedNotifications: Notification[] = [];

    projects.forEach(p => {
      if (!p['Pipeline No.']) return;

      const dueDate = parseDate(p['Due Date']);
      
      // Overdue notifications
      if (p.Status === 'Quote Submitted' && dueDate && dueDate < now) {
        generatedNotifications.push({
          id: `overdue-${p['Pipeline No.']}`,
          type: 'overdue',
          title: 'Project Overdue',
          description: `${p['Company Name']} (${p['Pipeline No.']}) was due on ${p['Due Date']}.`,
          timestamp: dueDate,
          read: false,
          link: { view: 'projects', filter: p['Pipeline No.'] }
        });
      }
      
      // Due soon notifications
      if (p.Status === 'Quote Submitted' && dueDate) {
        const diffTime = dueDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays <= 7) {
            generatedNotifications.push({
              id: `due-${p['Pipeline No.']}`,
              type: 'due_date',
              title: `Due in ${diffDays} day(s)`,
              description: `${p['Company Name']} (${p['Pipeline No.']}) is approaching its due date.`,
              timestamp: new Date(), // Use current time for sorting recent notifications
              read: false,
              link: { view: 'projects', filter: p['Pipeline No.'] }
            });
        }
      }
      
      // Won project notifications
      const invDate = parseDate(p['Inv Date']);
      if (p.Status === 'Close (win)' && invDate) {
        const diffTime = now.getTime() - invDate.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays <= 30) { // Won in the last 30 days
            generatedNotifications.push({
              id: `win-${p['Pipeline No.']}`,
              type: 'status_win',
              title: 'Project Won!',
              description: `You won the project with ${p['Company Name']} for ${p['Bid Value']}.`,
              timestamp: invDate,
              read: false,
              link: { view: 'projects', filter: p['Pipeline No.'] }
            });
        }
      }
    });
    
    // Sort by timestamp descending
    const sortedNotifications = generatedNotifications
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    setNotifications(sortedNotifications);
  }, [projects, loading]);

  const markAsRead = useCallback((id: string) => {
    setReadIds(prev => {
      const newIds = new Set<string>(prev);
      newIds.add(id);
      saveReadIds(newIds);
      return newIds;
    });
  }, []);

  const markAllAsRead = useCallback(() => {
    setReadIds(prev => {
      const currentIds = notifications.map(n => n.id);
      // FIX: Explicitly type the new Set as Set<string> to prevent TypeScript from inferring Set<unknown>.
      const newIds = new Set<string>([...prev, ...currentIds]);
      saveReadIds(newIds);
      return newIds;
    });
  }, [notifications]);

  const unreadNotifications = useMemo(() => {
    return notifications.filter(n => !readIds.has(n.id));
  }, [notifications, readIds]);

  const value = {
    notifications: unreadNotifications,
    unreadCount: unreadNotifications.length,
    markAsRead,
    markAllAsRead
  };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
