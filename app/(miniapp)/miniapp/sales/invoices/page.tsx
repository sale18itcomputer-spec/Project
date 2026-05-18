'use client';
import { Suspense, useEffect, useMemo } from 'react';
import { useData } from '@/contexts/MiniAppDataContext';
import MiniAppShell from '@/components/miniapp/MiniAppShell';
import DocList from '@/components/miniapp/DocList';
import { formatCurrencySmartly } from '@/utils/formatters';
import { useNavigation } from '@/contexts/NavigationContext';
import MobileInvoiceForm from '@/components/miniapp/forms/MobileInvoiceForm';
import { haptic } from '@/lib/miniapp/telegramShare';
import { Plus } from 'lucide-react';

const STATUS_COLORS = {
    'Draft':     { bg: '#38bdf815', color: '#38bdf8' },
    'Issued':    { bg: '#34d39915', color: '#34d399' },
    'Cancelled': { bg: '#f4727215', color: '#f47272' },
};

function Content() {
    const { invoices, fetchModule, loading } = useData();
    const { handleNavigation } = useNavigation();

    useEffect(() => { fetchModule('Invoices'); }, [fetchModule]);

    const formattedData = useMemo(() =>
        (invoices ?? []).map(inv => ({
            ...inv,
            _amount: formatCurrencySmartly(inv['Total Amount'] ?? inv['Amount'], inv.Currency),
            _date: inv['Inv Date'] ? new Date(inv['Inv Date']).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '',
        })),
        [invoices]
    );

    return (
        <div className="h-full relative flex flex-col">
            <DocList
                data={formattedData}
                loading={loading && !invoices}
                idKey="Inv No"
                columns={[
                    { key: 'Inv No', label: 'Inv No', hidden: true },
                    { key: 'Company Name', label: 'Company Name', primary: true },
                    { key: 'Contact Name', label: 'Contact Name', secondary: true },
                    { key: '_amount', label: 'Amount', amount: true },
                    { key: '_date', label: 'Date', date: true },
                    { key: 'Created By', label: 'Created By' },
                    { key: 'Status', label: 'Status', status: true },
                ]}
                statusColors={STATUS_COLORS}
                statusKey="Status"
                statusOptions={['Draft', 'Issued', 'Cancelled']}
                defaultStatus={null}
                searchPlaceholder="Search invoices..."
                accent="#a78bfa"
                emptyMessage="No invoices found"
                onSelect={item => {
                    haptic('medium');
                    handleNavigation({ view: 'invoices', action: 'view', payload: { action: 'view', data: item } });
                }}
                onRefresh={() => { fetchModule('Invoices'); }}
            />
            {/* FAB */}
            <button
                onClick={() => {
                    haptic('medium');
                    handleNavigation({ view: 'invoices', action: 'create' });
                }}
                className="absolute bottom-5 right-4 w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl active:scale-95 transition-transform z-40"
                style={{
                    background: 'linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%)',
                    boxShadow: '0 8px 24px #a78bfa40',
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
        const existingInvoice = navigation.action !== 'create' ? (navigation.payload?.data || navigation.payload) : null;
        return (
            <MobileInvoiceForm
                onBack={() => handleNavigation({ view: 'invoices' })}
                existingInvoice={existingInvoice}
                initialData={navigation.payload?.initialData || (navigation.payload?.soData ? { action: 'create', soData: navigation.payload?.soData } : undefined)}
            />
        );
    }

    return (
        <MiniAppShell title="Invoices" backHref="/miniapp">
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
