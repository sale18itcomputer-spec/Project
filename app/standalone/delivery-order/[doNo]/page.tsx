'use client';

import React, { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useData } from '@/contexts/DataContext';
import StandaloneShell from '@/components/standalone/StandaloneShell';
import DeliveryOrderCreator from '@/components/features/sales/DeliveryOrderCreator';

export default function StandaloneDeliveryOrderPage() {
    const { doNo } = useParams<{ doNo: string }>();
    const { deliveryOrders } = useData();

    const existingDO = useMemo(
        () => (doNo !== 'new' && deliveryOrders ? deliveryOrders.find(d => d['DO No'] === doNo) ?? null : null),
        [deliveryOrders, doNo],
    );

    return (
        <StandaloneShell>
            <div className="h-screen w-screen">
                <DeliveryOrderCreator
                    onBack={() => window.close()}
                    existingDO={existingDO}
                />
            </div>
        </StandaloneShell>
    );
}
