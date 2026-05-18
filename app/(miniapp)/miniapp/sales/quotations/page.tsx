'use client';
import { Suspense, useEffect, useMemo } from 'react';
import { useData } from '@/contexts/MiniAppDataContext';
import MiniAppShell from '@/components/miniapp/MiniAppShell';
import DocList from '@/components/miniapp/DocList';
import { formatCurrencySmartly } from '@/utils/formatters';
import { Plus } from 'lucide-react';
import { haptic } from '@/lib/miniapp/telegramShare';
import { useNavigation } from '@/contexts/NavigationContext';
import MobileQuotationForm from '@/components/miniapp/forms/MobileQuotationForm';

const STATUS_COLORS = {
    'Open':         { bg: '#38bdf815', color: '#38bdf8' },
    'Close (Win)':  { bg: '#34d39915', color: '#34d399' },
    'Close (Lose)': { bg: '#f4727215', color: '#f47272' },
    'Cancel':       { bg: '#a78bfa15', color: '#a78bfa' },
};

function Content() {
    const { quotations, fetchModule, loading } = useData();
    const { handleNavigation } = useNavigation();

    useEffect(() => { fetchModule('Quotations'); }, [fetchModule]);

    const formattedData = useMemo(() =>
        (quotations ?? []).map(q => ({
            ...q,
            _amount: formatCurrencySmartly(q.Amount, q.Currency),
            _date: q['Quote Date'] ? new Date(q['Quote Date']).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '',
        })),
        [quotations]
    );

    return (
        <div className="h-full relative flex flex-col">
            <DocList
                data={formattedData}
                loading={loading && !quotations}
                idKey="Quote No"
                columns={[
                    { key: 'Quote No', label: 'Quote No', hidden: true },
                    { key: 'Company Name', label: 'Company Name', primary: true },
                    { key: 'Contact Name', label: 'Contact Name', secondary: true },
                    { key: '_amount', label: 'Amount', amount: true },
                    { key: '_date', label: 'Date', date: true },
                    { key: 'Created By', label: 'Created By' },
                    { key: 'Status', label: 'Status', status: true },
                ]}
                statusColors={STATUS_COLORS}
                statusKey="Status"
                statusOptions={['Open', 'Close (Win)', 'Close (Lose)', 'Cancel']}
                defaultStatus="Open"
                searchPlaceholder="Search quotations..."
                accent="#38bdf8"
                emptyMessage="No quotations found"
                onSelect={item => {
                    haptic('medium');
                    handleNavigation({ view: 'quotations', action: 'view', payload: { action: 'view', data: item } });
                }}
                onRefresh={() => fetchModule('Quotations')}
            />
            {/* FAB */}
            <button
                onClick={() => {
                    haptic('medium');
                    handleNavigation({ view: 'quotations', action: 'create' });
                }}
                className="absolute bottom-5 right-4 w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl active:scale-95 transition-transform z-40"
                style={{
                    background: 'linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%)',
                    boxShadow: '0 8px 24px #38bdf840',
                }}
            >
                <Plus size={24} color="#fff" />
            </button>
        </div>
    );
}

function PageContent() {
    const { navigation, handleNavigation } = useNavigation();
    
    const isCreatingOrEditing = navigation.action === 'create' || navigation.action === 'edit' || navigation.action === 'view';

    if (isCreatingOrEditing) {
        const existingQuote = navigation.action !== 'create' ? (navigation.payload?.data || navigation.payload) : null;
        return (
            <MobileQuotationForm
                onBack={() => handleNavigation({ view: 'quotations' })}
                existingQuotation={existingQuote}
                initialData={navigation.payload?.initialData}
            />
        );
    }

    return (
        <MiniAppShell title="Quotations" backHref="/miniapp">
            <Content />
        </MiniAppShell>
    );
}

export default function Page() {
    return (
        <Suspense>
            <PageContent />
        </Suspense>
    );
}
