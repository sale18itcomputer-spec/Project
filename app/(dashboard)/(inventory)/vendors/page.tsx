'use client';

import { useEffect } from 'react';
import VendorDashboard from '@/components/dashboards/inventory/VendorDashboard';
import { useData } from '@/contexts/DataContext';

export default function VendorsPage() {
    const { fetchModule } = useData();
    useEffect(() => { fetchModule('Vendors'); }, [fetchModule]);
    return <VendorDashboard />;
}
