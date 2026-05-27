'use client';

import { useEffect } from 'react';
import InventoryDashboard from '@/components/dashboards/inventory/InventoryDashboard';
import { useData } from '@/contexts/DataContext';

export default function InventoryPage() {
    const { fetchModule } = useData();

    // Pre-load inventory + PO data (PO needed for the source PO number resolution)
    useEffect(() => {
        fetchModule('Inventory', 'Purchase Orders', 'Vendors');
    }, [fetchModule]);

    return <InventoryDashboard />;
}
