'use client';
import { Suspense, useEffect, useMemo } from 'react';
import { useData } from '@/contexts/MiniAppDataContext';
import MiniAppShell from '@/components/miniapp/MiniAppShell';
import DocList from '@/components/miniapp/DocList';
import { formatCurrencySmartly } from '@/utils/formatters';
import { useNavigation } from '@/contexts/NavigationContext';
import MobileReceiptForm from '@/components/miniapp/forms/MobileReceiptForm';
import { haptic } from '@/lib/miniapp/telegramShare';
import { Plus } from 'lucide-react';

const STATUS_COLORS = {
    'Draft':     { bg: '#38bdf815', color: '#38bdf8' },
    'Issued':    { bg: '#34d39915', color: '#34d399' },
    'Cancelled': { bg: '#f4727215', color: '#f47272' },
};

function Content() {
    const { receipts, fetchModule, loading } = useData();
    const { handleNavigation } = useNavigation();

    useEffect(() => { fetchModule('Receipts'); }, [fetchModule]);

    const formattedData = useMemo(() =>
        (receipts ?? []).map(r => ({
            ...r,
            _amount: formatCurrencySmartly(String(r.Amount ?? ''), r.Currency),
            _date: r['RV Date'] ? new Date(r['RV Date']).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '',
            _method: r['Payment Method'] || '',
        })),
        [receipts]
    );

    return (
        <div className="h-full relative flex flex-col">
            <DocList
                data={formattedData}
                loading={loading && !receipts}
                idKey="RV No"
                columns={[
                    { key: 'RV No', label: 'RV No', hidden: true },
                    { key: 'Company Name', label: 'Company Name', primary: true },
                    { key: '_method', label: 'Method', secondary: true },
                    { key: '_amount', label: 'Amount', amount: true },
                    { key: '_date', label: 'Date', date: true },
                    { key: 'Created By', label: 'Created By' },
                    { key: 'Status', label: 'Status', status: true },
                ]}
                statusColors={STATUS_COLORS}
                statusKey="Status"
                statusOptions={['Draft', 'Issued', 'Cancelled']}
                defaultStatus={null}
                searchPlaceholder="Search receipts..."
                accent="#f472b6"
                emptyMessage="No receipts found"
                onSelect={item => {
                    haptic('medium');
                    handleNavigation({ view: 'receipts', action: 'view', payload: { action: 'view', data: item } });
                }}
                onRefresh={() => { fetchModule('Receipts'); }}
            />
            {/* FAB */}
            <button
                onClick={() => {
                    haptic('medium');
                    handleNavigation({ view: 'receipts', action: 'create' });
                }}
                className="absolute bottom-5 right-4 w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl active:scale-95 transition-transform z-40"
                style={{
                    background: 'linear-gradient(135deg, #f472b6 0%, #ec4899 100%)',
                    boxShadow: '0 8px 24px #f472b640',
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
        const existingReceipt = navigation.action !== 'create' ? (navigation.payload?.data || navigation.payload) : null;
        return (
            <MobileReceiptForm
                onBack={() => handleNavigation({ view: 'receipts' })}
                existingReceipt={existingReceipt}
                initialData={navigation.payload?.initialData}
            />
        );
    }

    return (
        <MiniAppShell title="Receipts" backHref="/miniapp">
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
