'use client';

import { useEffect } from 'react';
import VendorPricelistDashboard from '@/components/dashboards/inventory/VendorPricelistDashboard';
import { useData } from '@/contexts/DataContext';

export default function VendorPricelistPage() {
    const { fetchModule } = useData();
    // Vendor pricelist needs vendor names for display
    useEffect(() => { fetchModule('Vendors', 'Vendor Pricelist'); }, [fetchModule]);
    return <VendorPricelistDashboard />;
}
