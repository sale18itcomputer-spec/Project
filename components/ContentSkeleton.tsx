import React from 'react';

const ContentSkeleton: React.FC = () => (
  <div className="animate-pulse">
    <div className="space-y-6">
      {/* Metric Cards Skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-card p-5 rounded-xl border border-border shadow-sm">
            <div className="h-4 bg-muted rounded w-3/4 mb-3"></div>
            <div className="h-8 bg-muted rounded w-1/2"></div>
          </div>
        ))}
      </div>

      {/* Table/Chart Skeleton */}
      <div className="bg-card rounded-xl border border-border shadow-sm p-6">
        <div className="h-6 w-1/3 bg-muted rounded mb-4"></div>
        <div className="h-4 w-1/2 bg-muted rounded mb-6"></div>
        <div className="h-96 bg-muted rounded-lg"></div>
      </div>
    </div>
  </div>
);

export default ContentSkeleton;
