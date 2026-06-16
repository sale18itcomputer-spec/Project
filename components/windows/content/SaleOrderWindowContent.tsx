'use client';

import React, { useEffect, useMemo } from 'react';
import { SaleOrder } from '@/types';
import { useWindowManager } from '@/contexts/WindowManagerContext';
import { useData } from '@/contexts/DataContext';
import SaleOrderCreator from '@/components/features/sales/SaleOrderCreator';

interface SaleOrderWindowContentProps {
    windowId: string;
    soNo: string | null;
    initialData?: Partial<SaleOrder>;
}

const SaleOrderWindowContent: React.FC<SaleOrderWindowContentProps> = ({
    windowId,
    soNo,
    initialData,
}) => {
    const { closeWindow, updateWindow } = useWindowManager();
    const { saleOrders } = useData();

    const existingSaleOrder = useMemo(
        () => (soNo && saleOrders ? saleOrders.find(s => s['SO No'] === soNo) ?? null : null),
        [saleOrders, soNo],
    );

    useEffect(() => {
        updateWindow(windowId, {
            title: soNo ? `Sale Order: ${soNo}` : 'New Sale Order',
        });
    }, [windowId, soNo, updateWindow]);

    return (
        <SaleOrderCreator
            onBack={() => closeWindow(windowId)}
            existingSaleOrder={existingSaleOrder}
            initialData={initialData}
        />
    );
};

export default SaleOrderWindowContent;
