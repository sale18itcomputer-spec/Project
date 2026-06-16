'use client';

import React, { useEffect, useMemo } from 'react';
import { Invoice, SaleOrder } from '@/types';
import { useWindowManager } from '@/contexts/WindowManagerContext';
import { useData } from '@/contexts/DataContext';
import InvoiceCreator from '@/components/features/sales/invoice/InvoiceCreator';

interface InvoiceWindowContentProps {
    windowId: string;
    invNo: string | null;
    initialData?: {
        action: string;
        soData?: SaleOrder;
        duplicateOf?: Invoice;
    };
}

const InvoiceWindowContent: React.FC<InvoiceWindowContentProps> = ({
    windowId,
    invNo,
    initialData,
}) => {
    const { closeWindow, updateWindow } = useWindowManager();
    const { invoices } = useData();

    const existingInvoice = useMemo(
        () => (invNo && invoices ? invoices.find(i => i['Inv No'] === invNo) ?? null : null),
        [invoices, invNo],
    );

    useEffect(() => {
        updateWindow(windowId, {
            title: invNo ? `Invoice: ${invNo}` : 'New Invoice',
        });
    }, [windowId, invNo, updateWindow]);

    return (
        <InvoiceCreator
            onBack={() => closeWindow(windowId)}
            existingInvoice={existingInvoice}
            initialData={initialData}
        />
    );
};

export default InvoiceWindowContent;
