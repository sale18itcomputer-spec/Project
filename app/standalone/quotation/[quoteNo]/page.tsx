'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useData } from '@/contexts/DataContext';
import { useB2B } from '@/contexts/B2BContext';
import StandaloneShell from '@/components/standalone/StandaloneShell';
import QuotationCreator from '@/components/features/sales/QuotationCreator';
import Spinner from '@/components/common/Spinner';
import type { Quotation } from '@/types';

export default function StandaloneQuotationPage() {
    const { quoteNo } = useParams<{ quoteNo: string }>();
    const { quotations } = useData();
    const { isB2B, setMode, canAccessB2B } = useB2B();

    // The quote-number prefix is authoritative: BQ-xxxx is a B2B quotation,
    // Q-xxxx is B2C. A standalone tab derives its business mode from localStorage,
    // which can lag the opener — so it may boot in the WRONG mode. When that
    // happens DataContext loads the wrong table set (b2b_quotations vs quotations),
    // the record is never found, and QuotationCreator seeds a blank NEW draft
    // (with a mismatched Q-xxxx number). Align the mode to the record's prefix
    // before the creator mounts.
    const isExisting = quoteNo !== 'new';
    const wantB2B = isExisting && quoteNo.startsWith('BQ');
    // We can only switch INTO B2B if the user has access; switching to B2C is
    // always allowed. If we can't align (wants B2B, no access), don't block —
    // fall through rather than spin forever.
    const canAlign = !wantB2B || canAccessB2B;
    const modeMismatch = isExisting && canAlign && wantB2B !== isB2B;
    useEffect(() => {
        if (!modeMismatch) return;
        setMode(wantB2B ? 'B2B' : 'B2C');
        // setMode identity is unstable but the modeMismatch guard makes re-runs no-ops.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [modeMismatch, wantB2B]);

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
        () => (isExisting && quotations ? quotations.find(q => q['Quote No'] === quoteNo) ?? null : null),
        [quotations, quoteNo, isExisting],
    );

    // Gate the creator until it can seed correctly. For an existing quote that
    // means the business mode is aligned AND the store has actually loaded —
    // QuotationCreator bakes existingQuotation into its state ONCE on mount, so
    // mounting it before the record is available leaves a permanent blank draft.
    const storeLoaded = quotations !== null;
    const waitingForRecord = isExisting && canAlign && (modeMismatch || !storeLoaded);

    return (
        <StandaloneShell>
            <div className="h-screen w-screen">
                {boot.ready && !waitingForRecord ? (
                    <QuotationCreator
                        key={quoteNo}
                        onBack={() => window.close()}
                        existingQuotation={existingQuotation}
                        initialData={boot.initialData}
                    />
                ) : (
                    <div className="h-full flex items-center justify-center">
                        <Spinner size="lg" />
                    </div>
                )}
            </div>
        </StandaloneShell>
    );
}
