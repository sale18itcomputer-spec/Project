'use client';

import { useMemo, useEffect, useState } from 'react';
import MiniAppShell from '@/components/miniapp/MiniAppShell';
import { useData } from '@/contexts/MiniAppDataContext';
import { useMiniAppAuth } from '@/contexts/MiniAppAuthContext';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    CartesianGrid, Cell,
} from 'recharts';
import { Calendar, ChevronLeft, ChevronRight, FileText, ShoppingCart, Receipt, Truck } from 'lucide-react';
import { formatCurrencySmartly, parseSheetValue } from '@/utils/formatters';
import { haptic } from '@/lib/miniapp/telegramShare';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function getWeekRange(date: Date): { start: Date; end: Date } {
    const start = new Date(date);
    start.setDate(date.getDate() - date.getDay()); // Sunday
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
}

function formatDateShort(d: Date) {
    return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
}

function SummaryRow({ label, count, amount, color, icon }: {
    label: string; count: number; amount?: number;
    color: string; icon: React.ReactNode;
}) {
    return (
        <div
            className="flex items-center gap-3 py-3"
            style={{ borderBottom: '1px solid hsl(var(--border)/0.4)' }}
        >
            <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${color}18`, border: `1px solid ${color}30` }}
            >
                <span style={{ color }}>{icon}</span>
            </div>
            <div className="flex-1">
                <p className="text-[13px] font-semibold" style={{ color: 'hsl(var(--foreground))' }}>{label}</p>
                {amount !== undefined && (
                    <p className="text-[11px]" style={{ color: 'hsl(var(--muted-foreground))' }}>
                        {formatCurrencySmartly(amount, 'USD')}
                    </p>
                )}
            </div>
            <span
                className="text-[15px] font-black"
                style={{ color: 'hsl(var(--foreground))', letterSpacing: '-0.02em' }}
            >
                {count}
            </span>
        </div>
    );
}

export default function WeeklyReportMiniPage() {
    const { quotations, saleOrders, invoices, deliveryOrders, fetchModule } = useData();
    const { authState } = useMiniAppAuth();
    const [weekOffset, setWeekOffset] = useState(0); // 0 = this week, -1 = last week, etc.

    useEffect(() => {
        fetchModule('Quotations');
        fetchModule('Sale Orders');
        fetchModule('Invoices');
        fetchModule('Delivery Orders');
    }, [fetchModule]);

    const user = authState.status === 'authenticated' ? authState.user : null;
    const myName = user?.Name ?? '';
    const isAdmin = user?.Role === 'Admin';

    const { start, end } = useMemo(() => {
        const base = new Date();
        base.setDate(base.getDate() + weekOffset * 7);
        return getWeekRange(base);
    }, [weekOffset]);

    const inRange = (dateStr: string) => {
        const d = new Date(dateStr);
        return !isNaN(d.getTime()) && d >= start && d <= end;
    };

    const isMine = (row: any) =>
        isAdmin || [row['Created By'], row['Prepared By']].some(
            v => v && String(v).toLowerCase() === myName.toLowerCase()
        );

    const { quotes, orders, invs, dos, dailyActivity } = useMemo(() => {
        const quotes = (quotations ?? []).filter(q => isMine(q) && inRange(q['Quote Date']));
        const orders = (saleOrders ?? []).filter(so => isMine(so) && inRange(so['SO Date']) && so.Status !== 'Cancel');
        const invs   = (invoices ?? []).filter(inv => isMine(inv) && inRange(inv['Inv Date'] || inv['Created Date'] || ''));
        const dos    = (deliveryOrders ?? []).filter(d => isMine(d) && inRange(d['DO Date'] || d['Created Date'] || ''));

        // Daily activity bar chart (Mon-Sat)
        const dailyMap: Record<string, number> = {};
        for (let i = 1; i <= 6; i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            dailyMap[DAYS[d.getDay()]] = 0;
        }
        [...quotes, ...orders].forEach(item => {
            const d = new Date(item['Quote Date'] ?? item['SO Date'] ?? '');
            if (!isNaN(d.getTime()) && d >= start && d <= end) {
                const key = DAYS[d.getDay()];
                if (key in dailyMap) dailyMap[key] = (dailyMap[key] ?? 0) + 1;
            }
        });
        const dailyActivity = Object.entries(dailyMap).map(([name, count]) => ({ name, count }));

        return { quotes, orders, invs, dos, dailyActivity };
     
    }, [quotations, saleOrders, invoices, deliveryOrders, start, end, myName, isAdmin]);

    const orderRevenue = orders.reduce((s, o) => s + parseSheetValue(o['Total Amount']), 0);
    const isCurrentWeek = weekOffset === 0;

    return (
        <MiniAppShell title="Weekly Report" backHref="/miniapp">
            <div
                className="h-full overflow-y-auto pb-8"
                style={{ background: 'hsl(var(--background))' }}
            >
                {/* ── Week selector ─────────────────────────────────── */}
                <div
                    className="flex items-center justify-between px-4 py-3 sticky top-0 z-10"
                    style={{
                        background: 'hsl(var(--card)/0.95)',
                        backdropFilter: 'blur(8px)',
                        borderBottom: '1px solid hsl(var(--border)/0.5)',
                    }}
                >
                    <button
                        onClick={() => { haptic('light'); setWeekOffset(p => p - 1); }}
                        className="w-9 h-9 rounded-xl flex items-center justify-center active:opacity-60"
                        style={{ background: 'hsl(var(--muted)/0.6)', color: 'hsl(var(--foreground))' }}
                    >
                        <ChevronLeft size={18} />
                    </button>

                    <div className="text-center">
                        <div className="flex items-center justify-center gap-1.5">
                            <Calendar size={13} style={{ color: 'hsl(var(--primary))' }} />
                            <p className="text-[13px] font-bold" style={{ color: 'hsl(var(--foreground))' }}>
                                {isCurrentWeek ? 'This Week' : weekOffset === -1 ? 'Last Week' : `${weekOffset < 0 ? Math.abs(weekOffset) : '+'} weeks ago`}
                            </p>
                        </div>
                        <p className="text-[11px] mt-0.5" style={{ color: 'hsl(var(--muted-foreground))' }}>
                            {formatDateShort(start)} – {formatDateShort(end)}
                        </p>
                    </div>

                    <button
                        onClick={() => { haptic('light'); if (weekOffset < 0) setWeekOffset(p => p + 1); }}
                        disabled={isCurrentWeek}
                        className="w-9 h-9 rounded-xl flex items-center justify-center active:opacity-60 disabled:opacity-30"
                        style={{ background: 'hsl(var(--muted)/0.6)', color: 'hsl(var(--foreground))' }}
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>

                <div className="px-3 pt-3 space-y-3">
                    {/* ── Summary cards ───────────────────────────────── */}
                    <div
                        className="rounded-2xl p-4"
                        style={{
                            background: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border)/0.6)',
                        }}
                    >
                        <p
                            className="text-[10px] font-bold uppercase tracking-wider mb-1"
                            style={{ color: 'hsl(var(--muted-foreground))' }}
                        >
                            Activity Summary {isAdmin ? '(All Users)' : `(${myName})`}
                        </p>

                        <SummaryRow label="Quotations Sent"  count={quotes.length}  color="#38bdf8" icon={<FileText size={16} />} />
                        <SummaryRow label="Sale Orders"       count={orders.length}  amount={orderRevenue} color="#34d399" icon={<ShoppingCart size={16} />} />
                        <SummaryRow label="Invoices Issued"   count={invs.length}   color="#a78bfa" icon={<Receipt size={16} />} />
                        <div style={{ borderBottom: 'none' }}>
                            <SummaryRow label="Deliveries"    count={dos.length}    color="#fb923c" icon={<Truck size={16} />} />
                        </div>
                    </div>

                    {/* ── Revenue banner ──────────────────────────────── */}
                    {orderRevenue > 0 && (
                        <div
                            className="rounded-2xl px-4 py-4 flex items-center justify-between"
                            style={{
                                background: 'linear-gradient(135deg, hsl(var(--primary)/0.12) 0%, hsl(var(--primary)/0.04) 100%)',
                                border: '1px solid hsl(var(--primary)/0.2)',
                            }}
                        >
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'hsl(var(--primary)/0.7)' }}>
                                    Week Revenue
                                </p>
                                <p
                                    className="text-[22px] font-black leading-tight mt-0.5"
                                    style={{ color: 'hsl(var(--primary))', letterSpacing: '-0.03em' }}
                                >
                                    {formatCurrencySmartly(orderRevenue, 'USD')}
                                </p>
                            </div>
                            <div
                                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                                style={{ background: 'hsl(var(--primary)/0.12)' }}
                            >
                                <ShoppingCart size={22} style={{ color: 'hsl(var(--primary))' }} />
                            </div>
                        </div>
                    )}

                    {/* ── Daily activity chart ─────────────────────────── */}
                    <div
                        className="rounded-2xl p-4"
                        style={{
                            background: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border)/0.6)',
                        }}
                    >
                        <p
                            className="text-[10px] font-bold uppercase tracking-wider mb-3"
                            style={{ color: 'hsl(var(--muted-foreground))' }}
                        >
                            Daily Activity (Quotes + Orders)
                        </p>
                        <ResponsiveContainer width="100%" height={120}>
                            <BarChart data={dailyActivity} barSize={24} margin={{ top: 0, right: 0, bottom: 0, left: -28 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border)/0.4)" />
                                <XAxis
                                    dataKey="name"
                                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <YAxis
                                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                                    axisLine={false}
                                    tickLine={false}
                                    allowDecimals={false}
                                />
                                <Tooltip
                                    contentStyle={{
                                        background: 'hsl(var(--card))',
                                        border: '1px solid hsl(var(--border))',
                                        borderRadius: '10px',
                                        fontSize: '12px',
                                    }}
                                    cursor={{ fill: 'hsl(var(--muted)/0.4)' }}
                                    formatter={(v: number) => [v, 'Items']}
                                />
                                <Bar dataKey="count" radius={[5, 5, 0, 0]} fill="hsl(var(--primary)/0.3)">
                                    {dailyActivity.map((entry, i) => (
                                        <Cell
                                            key={i}
                                            fill={entry.count > 0 ? 'hsl(var(--primary))' : 'hsl(var(--primary)/0.15)'}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* ── Recent quotations this week ──────────────────── */}
                    {quotes.length > 0 && (
                        <div
                            className="rounded-2xl overflow-hidden"
                            style={{
                                background: 'hsl(var(--card))',
                                border: '1px solid hsl(var(--border)/0.6)',
                            }}
                        >
                            <div className="px-4 pt-4 pb-2">
                                <p
                                    className="text-[10px] font-bold uppercase tracking-wider"
                                    style={{ color: 'hsl(var(--muted-foreground))' }}
                                >
                                    Quotations This Week
                                </p>
                            </div>
                            {quotes.slice(0, 8).map((q, i) => (
                                <div
                                    key={q['Quote No']}
                                    className="flex items-center gap-3 px-4 py-2.5"
                                    style={{
                                        borderTop: i > 0 ? '1px solid hsl(var(--border)/0.3)' : 'none',
                                    }}
                                >
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[12px] font-bold truncate" style={{ color: 'hsl(var(--foreground))' }}>
                                            {q['Quote No']}
                                        </p>
                                        <p className="text-[11px] truncate" style={{ color: 'hsl(var(--muted-foreground))' }}>
                                            {q['Company Name']}
                                        </p>
                                    </div>
                                    <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                                        <span
                                            className="text-[11px] font-bold"
                                            style={{ color: '#38bdf8' }}
                                        >
                                            {formatCurrencySmartly(parseSheetValue(q['Amount']), 'USD')}
                                        </span>
                                        <span
                                            className="text-[10px] px-1.5 py-0.5 rounded-full"
                                            style={{
                                                background: q.Status === 'Close (Win)' ? '#34d39920' : q.Status === 'Open' ? '#38bdf820' : '#88888820',
                                                color: q.Status === 'Close (Win)' ? '#34d399' : q.Status === 'Open' ? '#38bdf8' : '#888',
                                            }}
                                        >
                                            {q.Status}
                                        </span>
                                    </div>
                                </div>
                            ))}
                            {quotes.length > 8 && (
                                <div className="px-4 py-2.5 border-t border-border/30">
                                    <p className="text-[11px] text-center" style={{ color: 'hsl(var(--muted-foreground))' }}>
                                        +{quotes.length - 8} more
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {quotes.length === 0 && orders.length === 0 && (
                        <div className="text-center py-12">
                            <Calendar size={36} className="mx-auto mb-3" style={{ color: 'hsl(var(--muted-foreground)/0.4)' }} />
                            <p className="text-[14px] font-semibold" style={{ color: 'hsl(var(--muted-foreground))' }}>
                                No activity this week
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </MiniAppShell>
    );
}
