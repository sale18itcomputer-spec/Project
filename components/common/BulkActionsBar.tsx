'use client';

import React from 'react';
import { X, Loader2 } from 'lucide-react';

export interface BulkActionDef {
  label: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'danger';
}

interface BulkActionsBarProps {
  selectedCount: number;
  actions: BulkActionDef[];
  onClear: () => void;
  onAction: (index: number) => void;
  runningIndex?: number | null;
}

const BulkActionsBar: React.FC<BulkActionsBarProps> = ({
  selectedCount,
  actions,
  onClear,
  onAction,
  runningIndex = null,
}) => {
  if (selectedCount === 0) return null;

  return (
    <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2 bg-brand-500/10 border-b border-brand-500/20 flex-wrap">
      <span className="text-sm font-semibold text-brand-600 dark:text-brand-400 whitespace-nowrap">
        {selectedCount} selected
      </span>
      <button
        type="button"
        onClick={onClear}
        className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <X size={12} /> Clear
      </button>
      <div className="flex items-center gap-2 ml-auto flex-wrap">
        {actions.map((action, i) => {
          const isRunning = runningIndex === i;
          const isDisabled = runningIndex !== null;
          return (
            <button
              key={`${action.label}-${i}`}
              type="button"
              disabled={isDisabled}
              onClick={() => onAction(i)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ${
                action.variant === 'danger'
                  ? 'bg-rose-600/10 text-rose-600 hover:bg-rose-600/20 border border-rose-600/20'
                  : 'bg-brand-600 text-white hover:bg-brand-700'
              }`}
            >
              {isRunning ? <Loader2 size={13} className="animate-spin" /> : action.icon}
              {action.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default React.memo(BulkActionsBar);
