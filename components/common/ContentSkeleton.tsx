import React from 'react';

const SkeletonBox: React.FC<{ className?: string; delay?: number }> = ({ className, delay = 0 }) => (
  <div
    className={`skeleton rounded ${className}`}
    style={{ animationDelay: `${delay}ms` }}
  />
);

const ContentSkeleton: React.FC = () => (
  <div className="p-4 md:p-6">
    <div className="space-y-6">
      {/* Metric Cards Skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 md:gap-6 stagger-in">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="bg-card p-5 rounded-xl border border-border shadow-sm"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <SkeletonBox className="h-4 w-3/4 mb-3" delay={i * 50} />
            <SkeletonBox className="h-8 w-1/2" delay={i * 50 + 100} />
          </div>
        ))}
      </div>

      {/* Filter Bar Skeleton */}
      <div className="flex flex-wrap gap-3">
        <SkeletonBox className="h-10 w-64" delay={200} />
        <SkeletonBox className="h-10 w-32" delay={250} />
        <SkeletonBox className="h-10 w-32" delay={300} />
      </div>

      {/* Table/Chart Skeleton */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border">
          <SkeletonBox className="h-6 w-48 mb-2" delay={350} />
          <SkeletonBox className="h-4 w-80" delay={400} />
        </div>
        <div className="p-6 space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <SkeletonBox className="h-10 w-10 rounded-full" delay={450 + i * 50} />
              <div className="flex-1 space-y-2">
                <SkeletonBox className="h-4 w-3/4" delay={475 + i * 50} />
                <SkeletonBox className="h-3 w-1/2" delay={500 + i * 50} />
              </div>
              <SkeletonBox className="h-8 w-20" delay={525 + i * 50} />
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

export default ContentSkeleton;
