'use client';

import React, { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useData } from '@/contexts/DataContext';
import StandaloneShell from '@/components/standalone/StandaloneShell';
import SaleOrderCreator from '@/components/features/sales/SaleOrderCreator';

export default function StandaloneSaleOrderPage() {
    const { soNo } = useParams<{ soNo: string }>();
    const { saleOrders } = useData();

    const existingSaleOrder = useMemo(
        () => (soNo !== 'new' && saleOrders ? saleOrders.find(s => s['SO No'] === soNo) ?? null : null),
        [saleOrders, soNo],
    );

    return (
        <StandaloneShell>
            <div className="h-screen w-screen">
                <SaleOrderCreator
                    onBack={() => window.close()}
                    existingSaleOrder={existingSaleOrder}
                />
            </div>
        </StandaloneShell>
    );
}
