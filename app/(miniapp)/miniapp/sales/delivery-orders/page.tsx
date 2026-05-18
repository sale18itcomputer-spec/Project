'use client';
import { Suspense, useEffect, useMemo } from 'react';
import { useData } from '@/contexts/MiniAppDataContext';
import MiniAppShell from '@/components/miniapp/MiniAppShell';
import DocList from '@/components/miniapp/DocList';
import { useNavigation } from '@/contexts/NavigationContext';
import MobileDeliveryOrderForm from '@/components/miniapp/forms/MobileDeliveryOrderForm';
import { haptic } from '@/lib/miniapp/telegramShare';
import { Plus } from 'lucide-react';

const STATUS_COLORS = {
    'Pending':   { bg: '#fbbf2415', color: '#fbbf24' },
    'Delivered': { bg: '#34d39915', color: '#34d399' },
    'Cancelled': { bg: '#f4727215', color: '#f47272' },
};

function Content() {
    const { deliveryOrders, fetchModule, loading } = useData();
    const { handleNavigation } = useNavigation();

    useEffect(() => { fetchModule('Delivery Orders'); }, [fetchModule]);

    const formattedData = useMemo(() =>
        (deliveryOrders ?? []).map(d => ({
            ...d,
            _date: d['DO Date'] ? new Date(d['DO Date']).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '',
            _refs: [d['Inv No'], d['SO No']].filter(Boolean).join(' · '),
        })),
        [deliveryOrders]
    );

    return (
        <div className="h-full relative flex flex-col">
            <DocList
                data={formattedData}
                loading={loading && !deliveryOrders}
                idKey="DO No"
                columns={[
                    { key: 'DO No', label: 'DO No', hidden: true },
                    { key: 'Company Name', label: 'Company Name', primary: true },
                    { key: '_refs', label: 'Refs', secondary: true },
                    { key: '_date', label: 'Date', date: true },
                    { key: 'Created By', label: 'Created By' },
                    { key: 'Status', label: 'Status', status: true },
                ]}
                statusColors={STATUS_COLORS}
                statusKey="Status"
                statusOptions={['Pending', 'Delivered', 'Cancelled']}
                defaultStatus="Pending"
                searchPlaceholder="Search delivery orders..."
                accent="#fb923c"
                emptyMessage="No delivery orders found"
                onSelect={item => {
                    haptic('medium');
                    handleNavigation({ view: 'delivery-orders', action: 'view', payload: { action: 'view', data: item } });
                }}
                onRefresh={() => { fetchModule('Delivery Orders'); }}
            />
            {/* FAB */}
            <button
                onClick={() => {
                    haptic('medium');
                    handleNavigation({ view: 'delivery-orders', action: 'create' });
                }}
                className="absolute bottom-5 right-4 w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl active:scale-95 transition-transform z-40"
                style={{
                    background: 'linear-gradient(135deg, #fb923c 0%, #f97316 100%)',
                    boxShadow: '0 8px 24px #fb923c40',
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
        const existingDO = navigation.action !== 'create' ? (navigation.payload?.data || navigation.payload) : null;
        return (
            <MobileDeliveryOrderForm
                onBack={() => handleNavigation({ view: 'delivery-orders' })}
                existingDO={existingDO}
                initialData={navigation.payload?.initialData}
            />
        );
    }

    return (
        <MiniAppShell title="Delivery Orders" backHref="/miniapp">
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
