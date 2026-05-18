'use client';

import { useMemo, useEffect } from 'react';
import MiniAppShell from '@/components/miniapp/MiniAppShell';
import { useData } from '@/contexts/MiniAppDataContext';
import { useMiniAppAuth } from '@/contexts/MiniAppAuthContext';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    CartesianGrid, Cell,
} from 'recharts';
import {
    TrendingUp, FileText, CheckCircle, DollarSign,
    Target, Clock, Award,
} from 'lucide-react';
import { formatCurrencySmartly, parseSheetValue } from '@/utils/formatters';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const ACCENT = 'hsl(var(--primary))';
const MUTED  = 'hsl(var(--muted-foreground))';

function StatCard({ label, value, sub, icon, color }: {
    label: string; value: string; sub?: string;
    icon: React.ReactNode; color: string;
}) {
    return (
        <div
            className="rounded-2xl p-4 flex flex-col gap-1"
            style={{
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border) / 0.6)',
            }}
        >
            <div className="flex items-center justify-between mb-1">
                <span
                    className="text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: MUTED }}
                >
                    {label}
                </span>
                <span style={{ color }}>{icon}</span>
            </div>
            <p
                className="text-2xl font-black leading-none"
                style={{ color: 'hsl(var(--foreground))', letterSpacing: '-0.03em' }}
            >
                {value}
            </p>
            {sub && (
                <p className="text-[11px]" style={{ color: MUTED }}>{sub}</p>
            )}
        </div>
    );
}

export default function MyPerformancePage() {
    const { quotations, saleOrders, fetchModule } = useData();
    const { authState } = useMiniAppAuth();

    useEffect(() => {
        fetchModule('Quotations');
        fetchModule('Sale Orders');
    }, [fetchModule]);

    const user = authState.status === 'authenticated' ? authState.user : null;
    const tgUser = authState.status === 'authenticated' ? authState.telegramUser : null;
    const displayName = user?.Name || tgUser?.first_name || '';
    const avatarLetter = displayName?.[0]?.toUpperCase() || 'L';
    const photoUrl = tgUser?.photo_url;
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const { thisMonth, lastMonth, monthlyQuotes, monthlyRevenue, winRate, avgDeal } = useMemo(() => {
        if (!displayName) return {
            thisMonth: { quotes: 0, orders: 0, revenue: 0, openQuotes: 0 },
            lastMonth: { quotes: 0, orders: 0, revenue: 0 },
            monthlyQuotes: [],
            monthlyRevenue: [],
            winRate: 0,
            avgDeal: 0,
        };

        const isMine = (row: any) =>
            [row['Prepared By'], row['Created By']].some(
                v => v && String(v).toLowerCase() === displayName.toLowerCase()
            );

        const monthOf = (dateStr: string) => {
            const d = new Date(dateStr);
            return isNaN(d.getTime()) ? null : { m: d.getMonth(), y: d.getFullYear() };
        };

        // ── This month / last month ──────────────────────────────────────────
        const thisM = { quotes: 0, orders: 0, revenue: 0, openQuotes: 0 };
        const lastM = { quotes: 0, orders: 0, revenue: 0 };

        const lastMonthIdx = currentMonth === 0 ? 11 : currentMonth - 1;
        const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

        quotations?.forEach(q => {
            if (!isMine(q)) return;
            const mo = monthOf(q['Quote Date']);
            if (!mo) return;
            if (mo.m === currentMonth && mo.y === currentYear) {
                thisM.quotes++;
                if (q.Status === 'Open') thisM.openQuotes++;
            }
            if (mo.m === lastMonthIdx && mo.y === lastMonthYear) lastM.quotes++;
        });

        saleOrders?.forEach(so => {
            if (!isMine(so)) return;
            if (so.Status === 'Cancel') return;
            const mo = monthOf(so['SO Date']);
            if (!mo) return;
            const amt = parseSheetValue(so['Total Amount']);
            if (mo.m === currentMonth && mo.y === currentYear) {
                thisM.orders++;
                thisM.revenue += amt;
            }
            if (mo.m === lastMonthIdx && mo.y === lastMonthYear) {
                lastM.orders++;
                lastM.revenue += amt;
            }
        });

        // ── 6-month trend ────────────────────────────────────────────────────
        const monthlyQuotes: { name: string; count: number; current: boolean }[] = [];
        const monthlyRevenue: { name: string; amount: number; current: boolean }[] = [];

        for (let i = 5; i >= 0; i--) {
            const mIdx = ((currentMonth - i) % 12 + 12) % 12;
            const mYear = currentMonth - i < 0 ? currentYear - 1 : currentYear;
            const isCurrent = i === 0;

            let qCount = 0;
            let rev = 0;

            quotations?.forEach(q => {
                if (!isMine(q)) return;
                const mo = monthOf(q['Quote Date']);
                if (mo?.m === mIdx && mo?.y === mYear) qCount++;
            });
            saleOrders?.forEach(so => {
                if (!isMine(so) || so.Status === 'Cancel') return;
                const mo = monthOf(so['SO Date']);
                if (mo?.m === mIdx && mo?.y === mYear) rev += parseSheetValue(so['Total Amount']);
            });

            monthlyQuotes.push({ name: MONTHS[mIdx], count: qCount, current: isCurrent });
            monthlyRevenue.push({ name: MONTHS[mIdx], amount: rev, current: isCurrent });
        }

        // ── Win rate (quotes → orders, this year) ────────────────────────────
        const myQuotesYTD = quotations?.filter(q => {
            if (!isMine(q)) return false;
            const mo = monthOf(q['Quote Date']);
            return mo?.y === currentYear;
        }) ?? [];
        const closedWon = myQuotesYTD.filter(q => q.Status === 'Close (Win)').length;
        const closedTotal = myQuotesYTD.filter(q => ['Close (Win)','Close (Lose)','Cancel'].includes(q.Status)).length;
        const winRate = closedTotal > 0 ? Math.round((closedWon / closedTotal) * 100) : 0;

        // ── Avg deal size ────────────────────────────────────────────────────
        const validOrders = saleOrders?.filter(so => isMine(so) && so.Status !== 'Cancel') ?? [];
        const totalRev = validOrders.reduce((s, o) => s + parseSheetValue(o['Total Amount']), 0);
        const avgDeal = validOrders.length > 0 ? totalRev / validOrders.length : 0;

        return { thisMonth: thisM, lastMonth: lastM, monthlyQuotes, monthlyRevenue, winRate, avgDeal };
    }, [quotations, saleOrders, displayName, currentMonth, currentYear]);

    const quotesDelta = thisMonth.quotes - lastMonth.quotes;
    const revDelta = thisMonth.revenue - lastMonth.revenue;

    return (
        <MiniAppShell title="My Performance" backHref="/miniapp">
            <div
                className="h-full overflow-y-auto pb-8"
                style={{ background: 'hsl(var(--background))' }}
            >
                {/* ── Profile hero ─────────────────────────────────────── */}
                <div
                    className="px-4 pt-5 pb-5 mb-1"
                    style={{
                        background: 'linear-gradient(160deg, hsl(var(--card)) 60%, hsl(var(--card)/0.8))',
                        borderBottom: '1px solid hsl(var(--border)/0.4)',
                    }}
                >
                    <div className="flex items-center gap-3">
                        <div
                            className="w-12 h-12 rounded-2xl flex-shrink-0 flex items-center justify-center font-bold text-lg text-white overflow-hidden shadow-lg"
                            style={{
                                background: photoUrl ? 'transparent' : 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary)/0.7) 100%)',
                                boxShadow: '0 4px 16px hsl(var(--primary)/0.25)',
                            }}
                        >
                            {photoUrl
                                ? <img src={photoUrl} alt={displayName} className="w-full h-full object-cover" />
                                : <span>{avatarLetter}</span>
                            }
                        </div>
                        <div>
                            <p
                                className="text-[18px] font-black leading-tight"
                                style={{ color: 'hsl(var(--foreground))', letterSpacing: '-0.02em' }}
                            >
                                {displayName || 'Sales Rep'}
                            </p>
                            <p className="text-[12px] font-medium mt-0.5" style={{ color: MUTED }}>
                                {user?.Role || 'Sales'} · {MONTHS[currentMonth]} {currentYear}
                            </p>
                        </div>
                    </div>

                    {/* Quick KPIs */}
                    <div className="grid grid-cols-3 gap-2 mt-4">
                        {[
                            { label: 'Win Rate', value: `${winRate}%`, icon: <Award size={13} /> },
                            { label: 'Avg Deal', value: avgDeal > 0 ? `$${Math.round(avgDeal / 1000)}k` : '—', icon: <Target size={13} /> },
                            { label: 'Open Quotes', value: String(thisMonth.openQuotes), icon: <Clock size={13} /> },
                        ].map(({ label, value, icon }) => (
                            <div
                                key={label}
                                className="rounded-xl px-2.5 py-2 text-center"
                                style={{
                                    background: 'hsl(var(--muted)/0.5)',
                                    border: '1px solid hsl(var(--border)/0.4)',
                                }}
                            >
                                <div className="flex items-center justify-center gap-1 mb-0.5" style={{ color: MUTED }}>
                                    {icon}
                                </div>
                                <p
                                    className="text-[15px] font-black leading-none"
                                    style={{ color: 'hsl(var(--foreground))', letterSpacing: '-0.02em' }}
                                >
                                    {value}
                                </p>
                                <p className="text-[10px] mt-0.5 font-medium" style={{ color: MUTED }}>{label}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="px-3 space-y-3 pt-3">
                    {/* ── This month stats ───────────────────────────────── */}
                    <div className="grid grid-cols-2 gap-2.5">
                        <StatCard
                            label="Quotes This Month"
                            value={String(thisMonth.quotes)}
                            sub={quotesDelta !== 0
                                ? `${quotesDelta > 0 ? '+' : ''}${quotesDelta} vs last month`
                                : 'Same as last month'
                            }
                            icon={<FileText size={15} />}
                            color="#38bdf8"
                        />
                        <StatCard
                            label="Orders This Month"
                            value={String(thisMonth.orders)}
                            sub={`${lastMonth.orders} last month`}
                            icon={<CheckCircle size={15} />}
                            color="#34d399"
                        />
                        <StatCard
                            label="Revenue This Month"
                            value={formatCurrencySmartly(thisMonth.revenue, 'USD')}
                            sub={revDelta !== 0
                                ? `${revDelta > 0 ? '+' : ''}${formatCurrencySmartly(Math.abs(revDelta), 'USD')} vs last`
                                : 'Same as last month'
                            }
                            icon={<DollarSign size={15} />}
                            color="#a78bfa"
                        />
                        <StatCard
                            label="Total YTD Revenue"
                            value={formatCurrencySmartly(
                                (saleOrders ?? [])
                                    .filter(so => {
                                        const isMine = [so['Prepared By'], so['Created By']].some(
                                            v => v && String(v).toLowerCase() === displayName.toLowerCase()
                                        );
                                        const d = new Date(so['SO Date']);
                                        return isMine && so.Status !== 'Cancel' && !isNaN(d.getTime()) && d.getFullYear() === currentYear;
                                    })
                                    .reduce((s, o) => s + parseSheetValue(o['Total Amount']), 0),
                                'USD'
                            )}
                            sub={`${currentYear} year to date`}
                            icon={<TrendingUp size={15} />}
                            color="#fb923c"
                        />
                    </div>

                    {/* ── 6-month quote trend ─────────────────────────────── */}
                    <div
                        className="rounded-2xl p-4"
                        style={{
                            background: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border) / 0.6)',
                        }}
                    >
                        <p
                            className="text-[11px] font-bold uppercase tracking-wider mb-3"
                            style={{ color: MUTED }}
                        >
                            Quotes Sent — Last 6 Months
                        </p>
                        <ResponsiveContainer width="100%" height={130}>
                            <BarChart data={monthlyQuotes} barSize={20} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border)/0.4)" />
                                <XAxis
                                    dataKey="name"
                                    tick={{ fontSize: 10, fill: MUTED }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <YAxis tick={{ fontSize: 10, fill: MUTED }} axisLine={false} tickLine={false} allowDecimals={false} />
                                <Tooltip
                                    contentStyle={{
                                        background: 'hsl(var(--card))',
                                        border: '1px solid hsl(var(--border))',
                                        borderRadius: '10px',
                                        fontSize: '12px',
                                        color: 'hsl(var(--foreground))',
                                    }}
                                    cursor={{ fill: 'hsl(var(--muted)/0.4)' }}
                                    formatter={(v: number) => [v, 'Quotes']}
                                />
                                <Bar dataKey="count" radius={[5, 5, 0, 0]}>
                                    {monthlyQuotes.map((entry, i) => (
                                        <Cell
                                            key={i}
                                            fill={entry.current ? ACCENT : 'hsl(var(--primary)/0.25)'}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* ── 6-month revenue trend ───────────────────────────── */}
                    <div
                        className="rounded-2xl p-4"
                        style={{
                            background: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border) / 0.6)',
                        }}
                    >
                        <p
                            className="text-[11px] font-bold uppercase tracking-wider mb-3"
                            style={{ color: MUTED }}
                        >
                            Revenue — Last 6 Months
                        </p>
                        <ResponsiveContainer width="100%" height={130}>
                            <BarChart data={monthlyRevenue} barSize={20} margin={{ top: 0, right: 0, bottom: 0, left: -10 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border)/0.4)" />
                                <XAxis
                                    dataKey="name"
                                    tick={{ fontSize: 10, fill: MUTED }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <YAxis
                                    tick={{ fontSize: 10, fill: MUTED }}
                                    axisLine={false}
                                    tickLine={false}
                                    tickFormatter={v => v >= 1000 ? `$${(v/1000).toFixed(0)}k` : `$${v}`}
                                />
                                <Tooltip
                                    contentStyle={{
                                        background: 'hsl(var(--card))',
                                        border: '1px solid hsl(var(--border))',
                                        borderRadius: '10px',
                                        fontSize: '12px',
                                        color: 'hsl(var(--foreground))',
                                    }}
                                    cursor={{ fill: 'hsl(var(--muted)/0.4)' }}
                                    formatter={(v: number) => [formatCurrencySmartly(v, 'USD'), 'Revenue']}
                                />
                                <Bar dataKey="amount" radius={[5, 5, 0, 0]}>
                                    {monthlyRevenue.map((entry, i) => (
                                        <Cell
                                            key={i}
                                            fill={entry.current ? '#34d399' : 'hsl(161 69% 62% / 0.25)'}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </MiniAppShell>
    );
}
