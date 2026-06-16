'use client';

import React, { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useData } from '@/contexts/DataContext';
import StandaloneShell from '@/components/standalone/StandaloneShell';
import QuotationCreator from '@/components/features/sales/QuotationCreator';

export default function StandaloneQuotationPage() {
    const { quoteNo } = useParams<{ quoteNo: string }>();
    const { quotations } = useData();

    const existingQuotation = useMemo(
        () => (quoteNo !== 'new' && quotations ? quotations.find(q => q['Quote No'] === quoteNo) ?? null : null),
        [quotations, quoteNo],
    );

    return (
        <StandaloneShell>
            <div className="h-screen w-screen">
                <QuotationCreator
                    onBack={() => window.close()}
                    existingQuotation={existingQuotation}
                />
            </div>
        </StandaloneShell>
    );
}
