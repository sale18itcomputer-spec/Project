'use client';
import { Suspense, useEffect, useMemo } from 'react';
import { useData } from '@/contexts/MiniAppDataContext';
import MiniAppShell from '@/components/miniapp/MiniAppShell';
import DocList from '@/components/miniapp/DocList';
import { formatCurrencySmartly } from '@/utils/formatters';
import { useNavigation } from '@/contexts/NavigationContext';
import MobilePurchaseOrderForm from '@/components/miniapp/forms/MobilePurchaseOrderForm';
import { haptic } from '@/lib/miniapp/telegramShare';
import { Plus } from 'lucide-react';

const STATUS_COLORS = {
    'Draft':     { bg: '#94a3b815', color: '#94a3b8' },
    'Approved':  { bg: '#38bdf815', color: '#38bdf8' },
    'Sent':      { bg: '#fbbf2415', color: '#fbbf24' },
    'Completed': { bg: '#34d39915', color: '#34d399' },
    'Cancelled': { bg: '#f4727215', color: '#f47272' },
};

function Content() {
    const { purchaseOrders, fetchModule, loading } = useData();
    const { handleNavigation } = useNavigation();

    useEffect(() => { fetchModule('Purchase Orders'); }, [fetchModule]);

    const formattedData = useMemo(() =>
        (purchaseOrders ?? []).map(po => ({
            ...po,
            _amount: formatCurrencySmartly(po.grand_total ?? po.sub_total, po.currency),
            _date: po.order_date ? new Date(po.order_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '',
        })),
        [purchaseOrders]
    );

    return (
        <div className="h-full relative flex flex-col">
            <DocList
                data={formattedData}
                loading={loading && !purchaseOrders}
                idKey="po_number"
                columns={[
                    { key: 'po_number', label: 'PO No', hidden: true },
                    { key: 'vendor_name', label: 'Vendor', primary: true },
                    { key: 'vendor_contact', label: 'Contact', secondary: true },
                    { key: '_amount', label: 'Amount', amount: true },
                    { key: '_date', label: 'Date', date: true },
                    { key: 'created_by', label: 'Created By' },
                    { key: 'status', label: 'Status', status: true },
                ]}
                statusColors={STATUS_COLORS}
                statusKey="status"
                statusOptions={['Draft', 'Approved', 'Sent', 'Completed', 'Cancelled']}
                defaultStatus={null}
                searchPlaceholder="Search purchase orders..."
                accent="#f59e0b"
                emptyMessage="No purchase orders found"
                onSelect={item => {
                    haptic('medium');
                    handleNavigation({ view: 'purchase-orders', action: 'view', payload: { action: 'view', data: item } });
                }}
                onRefresh={() => { fetchModule('Purchase Orders'); }}
            />
            {/* FAB */}
            <button
                onClick={() => {
                    haptic('medium');
                    handleNavigation({ view: 'purchase-orders', action: 'create' });
                }}
                className="absolute bottom-5 right-4 w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl active:scale-95 transition-transform z-40"
                style={{
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    boxShadow: '0 8px 24px #f59e0b40',
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
        const existingPO = navigation.action !== 'create' ? (navigation.payload?.data || navigation.payload) : null;
        return (
            <MobilePurchaseOrderForm
                onBack={() => handleNavigation({ view: 'purchase-orders' })}
                existingPO={existingPO}
                initialData={navigation.payload?.initialData}
            />
        );
    }

    return (
        <MiniAppShell title="Purchase Orders" backHref="/miniapp">
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
