'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useB2BData } from '../hooks/useB2BData';
import { parseDate } from '../utils/time';
import { Notification } from '../types';
import { useAuth } from './AuthContext';
import { localStorageGet, localStorageSet } from '../utils/storage';


interface NotificationContextType {
    notifications: Notification[];
    unreadCount: number;
    markAsRead: (id: string) => void;
    markAllAsRead: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { quotations, saleOrders, projects, invoices, meetings, siteSurveys } = useB2BData();
    const { currentUser } = useAuth();
    const [readIds, setReadIds] = useState<Set<string>>(() => {
        try {
            const saved = localStorageGet('read_notifications');
            return saved ? new Set(JSON.parse(saved)) : new Set<string>();
        } catch { return new Set<string>(); }
    });

    const [notifications, setNotifications] = useState<Notification[]>([]);

    useEffect(() => {
        try {
            localStorageSet('read_notifications', JSON.stringify(Array.from(readIds)));
        } catch { /* ignore */ }
    }, [readIds]);

    const markAsRead = (id: string) => {
        setReadIds(prev => new Set(prev).add(id));
    };

    const markAllAsRead = () => {
        const ids = notifications.map(n => n.id);
        setReadIds(prev => {
            const next = new Set(prev);
            ids.forEach(id => next.add(id));
            return next;
        });
    };

    useEffect(() => {
        if (!currentUser) return;

        const newNotifications: Notification[] = [];
        const now = new Date();
        // Use midnight for date comparisons (except hours logic)
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);

        const getDaysDiff = (target: Date) => {
            const t = new Date(target);
            t.setHours(0, 0, 0, 0);
            const diffTime = t.getTime() - today.getTime();
            return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        };

        const getHoursDiff = (target: Date) => {
            return (target.getTime() - now.getTime()) / (1000 * 60 * 60);
        };

        // Helper to generate a realistic timestamp for notifications based on string ID and a target date
        const getSimulatedTimestamp = (baseDate: Date, id: string): Date => {
            let hash = 0;
            for (let i = 0; i < id.length; i++) {
                hash = ((hash << 5) - hash) + id.charCodeAt(i);
                hash |= 0;
            }
            const rand = Math.abs(hash) / 2147483648; // 0 to 1

            const simulated = new Date(baseDate);
            // working hours 8 AM to 5 PM
            simulated.setHours(8 + Math.floor(rand * 9), Math.floor(rand * 60), 0, 0);

            // if simulated is in the future, fall back to somewhere in the last hour
            if (simulated > now) {
                return new Date(now.getTime() - Math.floor(rand * 60 * 60 * 1000));
            }
            return simulated;
        };

        // Helper to check if user should see item
        const shouldShow = (itemUser?: string, itemPreparer?: string) => {
            if (currentUser.Role === 'Admin') return true;
            if (itemUser && itemUser === currentUser.Name) return true;
            if (itemPreparer && itemPreparer === currentUser.Name) return true;
            return false;
        };

        // 1. Quotations
        quotations?.forEach(q => {
            if (!shouldShow(q['Created By'], q['Prepared By'])) return;
            if (q.Status !== 'Open') return;

            const validDate = parseDate(q['Validity Date']);
            if (!validDate) return;

            const diff = getDaysDiff(validDate);
            const conditions = [
                { days: 3, subtype: 'expiry', severity: 'low', msg: 'expires in 3 days' },
                { days: 1, subtype: 'expiry', severity: 'medium', msg: 'expires tomorrow' },
                { days: 0, subtype: 'expiry', severity: 'high', msg: 'expires today' },
            ] as const;

            conditions.forEach(cond => {
                if (diff === cond.days) {
                    const id = `quote-${q['Quote No']}-${cond.days}`;
                    newNotifications.push({
                        id,
                        type: 'quotation',
                        subtype: cond.subtype,
                        title: `Quotation Expiry`,
                        description: `Quote #${q['Quote No']} (${q['Company Name']}) ${cond.msg}.`,
                        timestamp: getSimulatedTimestamp(today, id),
                        severity: cond.severity,
                        link: { view: 'quotations', filter: q['Quote No'] }
                    });
                }
            });
        });

        // 2. Sale Orders
        saleOrders?.forEach(so => {
            if (!shouldShow(so['Created By'], so['Prepared By'])) return;
            if (so.Status !== 'Pending') return;

            const deliveryDate = parseDate(so['Delivery Date']);
            if (!deliveryDate) return;

            const diff = getDaysDiff(deliveryDate);
            const conditions = [
                { days: 2, subtype: 'delivery', severity: 'low', msg: 'delivery in 2 days' },
                { days: 1, subtype: 'delivery', severity: 'medium', msg: 'delivery tomorrow' },
                { days: 0, subtype: 'delivery', severity: 'high', msg: 'delivery today' },
            ] as const;

            conditions.forEach(cond => {
                if (diff === cond.days) {
                    const id = `so-${so['SO No']}-${cond.days}`;
                    newNotifications.push({
                        id,
                        type: 'sale_order',
                        subtype: 'delivery',
                        title: `Order Delivery`,
                        description: `SO #${so['SO No']} (${so['Company Name']}) ${cond.msg}.`,
                        timestamp: getSimulatedTimestamp(today, id),
                        severity: cond.severity,
                        link: { view: 'sale-orders', filter: so['SO No'] }
                    });
                }
            });
        });

        // 3. Pipelines/Projects
        projects?.forEach(p => {
            if (currentUser.Role !== 'Admin' && p['Responsible By'] !== currentUser.Name) return;
            if (['Close (win)', 'Close (lose)'].includes(p.Status)) return;

            // Due Date
            const dueDate = parseDate(p['Due Date']);
            if (dueDate) {
                const diff = getDaysDiff(dueDate);
                const conditions = [
                    { days: 3, subtype: 'due_date', severity: 'low', msg: 'due in 3 days' },
                    { days: 1, subtype: 'due_date', severity: 'medium', msg: 'due tomorrow' },
                ] as const;

                conditions.forEach(cond => {
                    if (diff === cond.days) {
                        const id = `proj-due-${p['Pipeline No']}-${cond.days}`;
                        newNotifications.push({
                            id,
                            type: 'project',
                            subtype: 'due_date',
                            title: `Project Due`,
                            description: `Pipeline #${p['Pipeline No']} (${p['Company Name']}) ${cond.msg}.`,
                            timestamp: getSimulatedTimestamp(today, id),
                            severity: cond.severity,
                            link: { view: 'projects', filter: p['Pipeline No'] }
                        });
                    }
                });
            }

            // Stuck logic
            const createdDate = parseDate(p['Created Date']);
            if (createdDate) {
                const daysOpen = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
                if (daysOpen > 7) {
                    const id = `proj-stuck-${p['Pipeline No']}-7plus`;
                    const thresholdDate = new Date(createdDate.getTime() + 7 * 24 * 60 * 60 * 1000);
                    newNotifications.push({
                        id,
                        type: 'project',
                        subtype: 'stuck',
                        title: `Pipeline Stuck`,
                        description: `Pipeline #${p['Pipeline No']} has been ${p.Status} for over 7 days.`,
                        timestamp: getSimulatedTimestamp(thresholdDate, id),
                        severity: 'medium',
                        link: { view: 'projects', filter: p['Pipeline No'] }
                    });
                }
            }
        });

        // 4. Invoices
        invoices?.forEach(inv => {
            if (currentUser.Role !== 'Admin' && inv['Created By'] !== currentUser.Name) return;

            const invDate = parseDate(inv['Inv Date'] || inv['Created Date']);
            if (!invDate) return;

            const daysSince = Math.floor((now.getTime() - invDate.getTime()) / (1000 * 60 * 60 * 24));

            if (inv.Status === 'Draft' && daysSince > 3) {
                const id = `inv-${inv['Inv No']}-draft-3`;
                const thresholdDate = new Date(invDate.getTime() + 3 * 24 * 60 * 60 * 1000);
                newNotifications.push({
                    id,
                    type: 'invoice',
                    subtype: 'stuck',
                    title: `Invoice Draft`,
                    description: `Invoice #${inv['Inv No']} has been in Draft for > 3 days.`,
                    timestamp: getSimulatedTimestamp(thresholdDate, id),
                    severity: 'medium',
                    link: { view: 'invoice-do', filter: inv['Inv No'] }
                });
            }

            if (inv.Status === 'Processing' && daysSince > 7) {
                const id = `inv-${inv['Inv No']}-processing-7`;
                const thresholdDate = new Date(invDate.getTime() + 7 * 24 * 60 * 60 * 1000);
                newNotifications.push({
                    id,
                    type: 'invoice',
                    subtype: 'stuck',
                    title: `Invoice Processing`,
                    description: `Invoice #${inv['Inv No']} has been Processing for > 7 days.`,
                    timestamp: getSimulatedTimestamp(thresholdDate, id),
                    severity: 'medium',
                    link: { view: 'invoice-do', filter: inv['Inv No'] }
                });
            }
        });

        // 5. Meetings/Surveys
        const checkActivity = (
            type: 'meeting' | 'site_survey',
            dateStr: string,
            timeStr: string,
            idStr: string,
            title: string,
            view: string
        ) => {
            let date = parseDate(dateStr);
            if (!date) return;

            // Combine date and time
            // parseTime is not imported but basic string "HH:mm" parsing
            if (timeStr) {
                const [hours, mins] = timeStr.split(':').map(Number);
                if (!isNaN(hours)) {
                    date.setHours(hours, mins || 0, 0, 0);
                }
            } else {
                // Default to 9 AM if no time? Or skip hourly check
                date.setHours(9, 0, 0, 0);
            }

            const hoursDiff = getHoursDiff(date); // (Target - Now) in hours
            const daysDiff = getDaysDiff(date); // Floor Days

            // 1 Day before (approx 24h, or calendar day?)
            // "1 day before" usually means "Tomorrow". Calendar day check.
            if (daysDiff === 1) {
                const id = `${type}-${idStr}-1day`;
                newNotifications.push({
                    id,
                    type,
                    subtype: 'upcoming',
                    title: `Upcoming ${title}`,
                    description: `${title} is tomorrow at ${timeStr || 'requested time'}.`,
                    timestamp: getSimulatedTimestamp(today, id),
                    severity: 'medium',
                    link: { view, filter: idStr }
                });
            }

            // 3 Hours before: 0 < diff <= 3
            if (hoursDiff > 0 && hoursDiff <= 3) {
                const id = `${type}-${idStr}-3hours`;
                const thresholdDate = new Date(date.getTime() - 3 * 60 * 60 * 1000);
                newNotifications.push({
                    id,
                    type,
                    subtype: 'upcoming',
                    title: `Upcoming ${title}`,
                    description: `${title} in ${Math.ceil(hoursDiff)} hours.`,
                    timestamp: getSimulatedTimestamp(thresholdDate, id),
                    severity: 'high',
                    link: { view, filter: idStr }
                });
            }
        };

        meetings?.forEach(m => {
            if (currentUser.Role !== 'Admin' && m['Responsible By'] !== currentUser.Name) return;
            if (m.Status === 'Close' || m.Status === 'Cancelled') return;
            checkActivity('meeting', m['Meeting Date'], m['Start Time'], m['Meeting ID'] || m['id'], `Meeting with ${m['Company Name']}`, 'meetings');
        });

        siteSurveys?.forEach(s => {
            if (currentUser.Role !== 'Admin' && s['Responsible By'] !== currentUser.Name) return;
            checkActivity('site_survey', s['Date'], s['Start Time'], s['Site ID'] || s['id'], `Site Survey at ${s['Location']}`, 'site-surveys');
        });

        // Sort by Date (newest first)? Or severity?
        // User didn't specify, standard is Newest First.
        // Since 'timestamp' is mostly 'now', we might sort by severity then type?
        // Or just push order. 
        setNotifications(newNotifications);

    // readIds is intentionally excluded from deps — read state is handled at render time
    // by filtering in the context value. Including it would cause an infinite loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [quotations, saleOrders, projects, invoices, meetings, siteSurveys, currentUser]);





    return (
        <NotificationContext.Provider value={{
            // Filter out notifications that are already marked as read
            notifications: notifications.filter(n => !readIds.has(n.id)),
            unreadCount: notifications.filter(n => !readIds.has(n.id)).length,
            markAsRead,
            markAllAsRead
        }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
};

