'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import ContentSkeleton from '@/components/common/ContentSkeleton';

const UserManagementDashboard = dynamic(() => import('@/components/dashboards/shared/UserManagementDashboard'), {
    loading: () => <ContentSkeleton />,
});

export default function UsersPage() {
    return (
        <Suspense fallback={<ContentSkeleton />}>
            <UserManagementDashboard />
        </Suspense>
    );
}
