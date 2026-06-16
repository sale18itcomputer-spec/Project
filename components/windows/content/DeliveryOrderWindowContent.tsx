'use client';

import React, { useEffect, useMemo } from 'react';
import { DeliveryOrder, Invoice, SaleOrder } from '@/types';
import { useWindowManager } from '@/contexts/WindowManagerContext';
import { useData } from '@/contexts/DataContext';
import DeliveryOrderCreator from '@/components/features/sales/DeliveryOrderCreator';

interface DeliveryOrderWindowContentProps {
    windowId: string;
    doNo: string | null;
    initialData?: {
        action?: string;
        invoiceData?: Invoice;
        soData?: SaleOrder;
    };
}

const DeliveryOrderWindowContent: React.FC<DeliveryOrderWindowContentProps> = ({
    windowId,
    doNo,
    initialData,
}) => {
    const { closeWindow, updateWindow } = useWindowManager();
    const { deliveryOrders } = useData();

    const existingDO = useMemo(
        () => (doNo && deliveryOrders ? deliveryOrders.find(d => d['DO No'] === doNo) ?? null : null),
        [deliveryOrders, doNo],
    );

    useEffect(() => {
        updateWindow(windowId, {
            title: doNo ? `Delivery Order: ${doNo}` : 'New Delivery Order',
        });
    }, [windowId, doNo, updateWindow]);

    return (
        <DeliveryOrderCreator
            onBack={() => closeWindow(windowId)}
            existingDO={existingDO}
            initialData={initialData}
        />
    );
};

export default DeliveryOrderWindowContent;
