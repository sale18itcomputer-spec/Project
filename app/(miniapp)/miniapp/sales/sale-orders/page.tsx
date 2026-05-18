'use client';
import { Suspense, useEffect, useMemo } from 'react';
import { useData } from '@/contexts/MiniAppDataContext';
import MiniAppShell from '@/components/miniapp/MiniAppShell';
import DocList from '@/components/miniapp/DocList';
import { formatCurrencySmartly } from '@/utils/formatters';
import { useNavigation } from '@/contexts/NavigationContext';
import MobileSaleOrderForm from '@/components/miniapp/forms/MobileSaleOrderForm';
import { haptic } from '@/lib/miniapp/telegramShare';
import { Plus } from 'lucide-react';

const STATUS_COLORS = {
    'Pending':   { bg: '#fbbf2415', color: '#fbbf24' },
    'Completed': { bg: '#34d39915', color: '#34d399' },
    'Cancel':    { bg: '#f4727215', color: '#f47272' },
};

function Content() {
    const { saleOrders, fetchModule, loading } = useData();
    const { handleNavigation } = useNavigation();

    useEffect(() => { fetchModule('Sale Orders'); }, [fetchModule]);

    const formattedData = useMemo(() =>
        (saleOrders ?? []).map(so => ({
            ...so,
            _amount: formatCurrencySmartly(so['Total Amount'], so.Currency),
            _date: so['SO Date'] ? new Date(so['SO Date']).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '',
        })),
        [saleOrders]
    );

    return (
        <div className="h-full relative flex flex-col">
            <DocList
                data={formattedData}
                loading={loading && !saleOrders}
                idKey="SO No"
                columns={[
                    { key: 'SO No', label: 'SO No', hidden: true },
                    { key: 'Company Name', label: 'Company Name', primary: true },
                    { key: 'Contact Name', label: 'Contact Name', secondary: true },
                    { key: '_amount', label: 'Amount', amount: true },
                    { key: '_date', label: 'Date', date: true },
                    { key: 'Created By', label: 'Created By' },
                    { key: 'Status', label: 'Status', status: true },
                ]}
                statusColors={STATUS_COLORS}
                statusKey="Status"
                statusOptions={['Pending', 'Completed', 'Cancel']}
                defaultStatus="Pending"
                searchPlaceholder="Search sale orders..."
                accent="#34d399"
                emptyMessage="No sale orders found"
                onSelect={item => {
                    haptic('medium');
                    handleNavigation({ view: 'sale-orders', action: 'view', payload: { action: 'view', data: item } });
                }}
                onRefresh={() => { fetchModule('Sale Orders'); }}
            />
            {/* FAB */}
            <button
                onClick={() => {
                    haptic('medium');
                    handleNavigation({ view: 'sale-orders', action: 'create' });
                }}
                className="absolute bottom-5 right-4 w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl active:scale-95 transition-transform z-40"
                style={{
                    background: 'linear-gradient(135deg, #34d399 0%, #10b981 100%)',
                    boxShadow: '0 8px 24px #34d39940',
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
        const existingSO = navigation.action !== 'create' ? (navigation.payload?.data || navigation.payload) : null;
        return (
            <MobileSaleOrderForm
                onBack={() => handleNavigation({ view: 'sale-orders' })}
                existingSaleOrder={existingSO}
                initialData={navigation.payload?.initialData}
            />
        );
    }

    return (
        <MiniAppShell title="Sale Orders" backHref="/miniapp">
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
