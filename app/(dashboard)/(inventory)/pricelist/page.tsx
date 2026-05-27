'use client';

import { useEffect } from 'react';
import PricelistDashboard from '@/components/dashboards/inventory/PricelistDashboard';
import { useData } from '@/contexts/DataContext';

export default function PricelistPage() {
    const { fetchModule } = useData();
    useEffect(() => { fetchModule('Raw'); }, [fetchModule]);
    return <PricelistDashboard />;
}
