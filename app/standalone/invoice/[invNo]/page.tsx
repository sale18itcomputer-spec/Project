'use client';

import React, { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useData } from '@/contexts/DataContext';
import StandaloneShell from '@/components/standalone/StandaloneShell';
import InvoiceCreator from '@/components/features/sales/invoice/InvoiceCreator';

export default function StandaloneInvoicePage() {
    const { invNo } = useParams<{ invNo: string }>();
    const { invoices } = useData();

    const existingInvoice = useMemo(
        () => (invNo !== 'new' && invoices ? invoices.find(i => i['Inv No'] === invNo) ?? null : null),
        [invoices, invNo],
    );

    return (
        <StandaloneShell>
            <div className="h-screen w-screen">
                <InvoiceCreator
                    onBack={() => window.close()}
                    existingInvoice={existingInvoice}
                />
            </div>
        </StandaloneShell>
    );
}
