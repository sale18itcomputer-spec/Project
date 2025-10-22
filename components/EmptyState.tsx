import React from 'react';

interface EmptyStateProps {
    illustration?: React.ReactNode;
    children?: React.ReactNode;
}

const EmptyState: React.FC<EmptyStateProps> = ({ illustration, children }) => {
  return (
    <div className="text-center py-12 text-gray-500">
      {illustration || (
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
            />
          </svg>
      )}
      {children || (
        <>
            <h3 className="mt-2 text-sm font-semibold text-gray-900">No results found</h3>
            <p className="mt-1 text-sm text-gray-500">Try adjusting your search or filter criteria.</p>
        </>
      )}
    </div>
  );
};

export default EmptyState;
