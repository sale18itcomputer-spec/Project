'use client';

import dynamic from 'next/dynamic';
import ContentSkeleton from '@/components/common/ContentSkeleton';

const AccountingDashboard = dynamic(
    () => import('../../../components/dashboards/accounting/AccountingDashboard'),
    { loading: () => <ContentSkeleton /> }
);

export default function AccountingPage() {
    return <AccountingDashboard />;
}
