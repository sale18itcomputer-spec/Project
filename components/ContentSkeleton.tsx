import React from 'react';

const ContentSkeleton: React.FC = () => (
  <div className="animate-pulse">
    <div className="space-y-6">
      {/* Metric Cards Skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white p-5 rounded-xl border border-slate-200/70 shadow-sm">
            <div className="h-4 bg-slate-200 rounded w-3/4 mb-3"></div>
            <div className="h-8 bg-slate-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>

      {/* Table/Chart Skeleton */}
      <div className="bg-white rounded-xl border border-slate-200/70 shadow-sm p-6">
        <div className="h-6 w-1/3 bg-slate-200 rounded mb-4"></div>
        <div className="h-4 w-1/2 bg-slate-200 rounded mb-6"></div>
        <div className="h-96 bg-slate-100 rounded-lg"></div>
      </div>
    </div>
  </div>
);

export default ContentSkeleton;
