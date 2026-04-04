import React from 'react';
import { Skeleton } from "../ui/skeleton";

const ChartSkeleton: React.FC = () => {
  return (
    <div className="bg-card rounded-xl border shadow-sm flex flex-col overflow-hidden h-[400px] lg:h-[500px] w-full">
      <div className="p-6 pb-0 flex-shrink-0 flex flex-col gap-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-6 w-48" />
      </div>
      <div className="p-6 flex-grow flex flex-col gap-4">
        <Skeleton className="h-full w-full rounded-md" />
      </div>
    </div>
  );
};

export default ChartSkeleton;
