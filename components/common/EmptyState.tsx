import React, { useEffect, useRef, useState } from 'react';
import { prepare, layout } from '@chenglou/pretext';

function useAutoFontSize(text: string, font: string, lineHeight: number) {
  const ref = useRef<HTMLHeadingElement>(null);
  const [cls, setCls] = useState('text-base');
  useEffect(() => {
    if (!ref.current) return;
    const w = ref.current.offsetWidth;
    if (w === 0) return;
    const sizes = [
      { cls: 'text-base', px: 16 },
      { cls: 'text-sm',   px: 14 },
      { cls: 'text-xs',   px: 12 },
    ] as const;
    for (const s of sizes) {
      const p = prepare(text, `600 ${s.px}px ${font}`);
      const { lineCount } = layout(p, w, lineHeight);
      if (lineCount <= 1) { setCls(s.cls); return; }
    }
    setCls('text-xs');
  }, [text, font, lineHeight]);
  return { ref, cls };
}

interface EmptyStateProps {
  illustration?: React.ReactNode;
  children?: React.ReactNode;
  title?: string;
  description?: string;
  action?: React.ReactNode;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  illustration,
  children,
  title = "No results found",
  description = "Try adjusting your search or filter criteria.",
  action
}) => {
  return (
    <div className="text-center py-16 px-4 animate-fadeIn">
      <div className="animate-float">
        {illustration || (
          <div className="mx-auto h-20 w-20 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
            <svg
              className="h-10 w-10 text-muted-foreground/60"
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
          </div>
        )}
      </div>
      {children || (
        <div className="space-y-2">
          <AutoTitle title={title} />
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">{description}</p>
          {action && (
            <div className="pt-4">
              {action}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const AutoTitle: React.FC<{ title: string }> = ({ title }) => {
  const { ref, cls } = useAutoFontSize(title, 'Inter', 24);
  return <h3 ref={ref} className={`${cls} font-semibold text-foreground`}>{title}</h3>;
};

export default EmptyState;
