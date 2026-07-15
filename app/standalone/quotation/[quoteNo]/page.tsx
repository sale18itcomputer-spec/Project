'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useData } from '@/contexts/DataContext';
import StandaloneShell from '@/components/standalone/StandaloneShell';
import QuotationCreator from '@/components/features/sales/QuotationCreator';
import type { Quotation } from '@/types';

export default function StandaloneQuotationPage() {
    const { quoteNo } = useParams<{ quoteNo: string }>();
    const { quotations } = useData();

    // Consume any one-time prefill/duplicate payload handed over via localStorage
    // (see QuotationDashboard.openQuotationWindow). Read it BEFORE QuotationCreator
    // mounts — its state initialises from initialData once, on mount — so gate the
    // creator behind `ready`. For a plain new/edit tab there's no draft key and
    // `ready` flips true immediately.
    const [boot, setBoot] = useState<{ ready: boolean; initialData?: Partial<Quotation> }>({ ready: false });
    useEffect(() => {
        let initialData: Partial<Quotation> | undefined;
        try {
            const key = new URLSearchParams(window.location.search).get('draft');
            if (key) {
                const raw = localStorage.getItem(key);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    initialData = parsed?.initialData;
                    // QuotationCreator reads duplicated line items from sessionStorage.
                    if (parsed?.items) sessionStorage.setItem('duplicate_quotation_items', JSON.stringify(parsed.items));
                    localStorage.removeItem(key);
                }
            }
        } catch { /* ignore a malformed handoff — open a blank new quote */ }
        setBoot({ ready: true, initialData });
    }, []);

    const existingQuotation = useMemo(
        () => (quoteNo !== 'new' && quotations ? quotations.find(q => q['Quote No'] === quoteNo) ?? null : null),
        [quotations, quoteNo],
    );

    return (
        <StandaloneShell>
            <div className="h-screen w-screen">
                {boot.ready && (
                    <QuotationCreator
                        onBack={() => window.close()}
                        existingQuotation={existingQuotation}
                        initialData={boot.initialData}
                    />
                )}
            </div>
        </StandaloneShell>
    );
}
