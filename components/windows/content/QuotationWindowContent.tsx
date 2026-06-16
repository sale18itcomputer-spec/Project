'use client';

import React, { useEffect, useMemo } from 'react';
import { Quotation } from '@/types';
import { useWindowManager } from '@/contexts/WindowManagerContext';
import { useB2BData } from '@/hooks/useB2BData';
import QuotationCreator from '@/components/features/sales/QuotationCreator';

interface QuotationWindowContentProps {
    windowId: string;
    quoteNo: string | null;
    initialData?: Partial<Quotation>;
}

const QuotationWindowContent: React.FC<QuotationWindowContentProps> = ({
    windowId,
    quoteNo,
    initialData,
}) => {
    const { closeWindow, updateWindow } = useWindowManager();
    const { quotations } = useB2BData();

    const existingQuotation = useMemo(
        () => (quoteNo && quotations ? quotations.find(q => q['Quote No'] === quoteNo) ?? null : null),
        [quotations, quoteNo],
    );

    useEffect(() => {
        updateWindow(windowId, {
            title: quoteNo ? `Quotation: ${quoteNo}` : 'New Quotation',
        });
    }, [windowId, quoteNo, updateWindow]);

    return (
        <QuotationCreator
            onBack={() => closeWindow(windowId)}
            existingQuotation={existingQuotation}
            initialData={initialData}
        />
    );
};

export default QuotationWindowContent;
