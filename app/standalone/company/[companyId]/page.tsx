'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import StandaloneShell from '@/components/standalone/StandaloneShell';
import StandaloneWindowAdapter from '@/components/standalone/StandaloneWindowAdapter';
import CompanyWindowContent from '@/components/windows/content/CompanyWindowContent';

export default function StandaloneCompanyPage() {
    const { companyId } = useParams<{ companyId: string }>();
    const windowId = `standalone-company-${companyId}`;

    return (
        <StandaloneShell>
            <StandaloneWindowAdapter windowId={windowId}>
                <CompanyWindowContent windowId={windowId} companyId={companyId} />
            </StandaloneWindowAdapter>
        </StandaloneShell>
    );
}
