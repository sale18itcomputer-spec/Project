'use client';

import { useEffect } from 'react';
import CollectionDashboard from '@/components/dashboards/sales/CollectionDashboard';
import { useData } from '@/contexts/DataContext';

export default function CollectionPage() {
    const { fetchModule } = useData();

    // Collection derives AR from Invoices + Receipts — both must be loaded.
    useEffect(() => { fetchModule('Invoices', 'Receipts'); }, [fetchModule]);

    return <CollectionDashboard />;
}
