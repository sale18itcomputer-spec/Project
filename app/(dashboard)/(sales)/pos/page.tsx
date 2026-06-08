'use client';

import dynamic from 'next/dynamic';
import { Suspense, useEffect } from 'react';
import ContentSkeleton from '@/components/common/ContentSkeleton';
import { useData } from '@/contexts/DataContext';

const PosTerminal = dynamic(
  () => import('@/components/pos/PosTerminal'),
  { loading: () => <ContentSkeleton /> }
);

function PosContent() {
  const { fetchModule } = useData();
  useEffect(() => {
    fetchModule('Raw', 'Invoices', 'Receipts', 'Company List', 'Contact_List');
  }, [fetchModule]);
  return <PosTerminal />;
}

export default function PosPage() {
  return (
    <Suspense fallback={<ContentSkeleton />}>
      <PosContent />
    </Suspense>
  );
}
