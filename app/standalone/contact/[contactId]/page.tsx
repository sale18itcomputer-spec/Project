'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import StandaloneShell from '@/components/standalone/StandaloneShell';
import StandaloneWindowAdapter from '@/components/standalone/StandaloneWindowAdapter';
import ContactWindowContent from '@/components/windows/content/ContactWindowContent';

export default function StandaloneContactPage() {
    const { contactId } = useParams<{ contactId: string }>();
    const windowId = `standalone-contact-${contactId}`;

    return (
        <StandaloneShell>
            <StandaloneWindowAdapter windowId={windowId}>
                <ContactWindowContent windowId={windowId} contactId={contactId} />
            </StandaloneWindowAdapter>
        </StandaloneShell>
    );
}
