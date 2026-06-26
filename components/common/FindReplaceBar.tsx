'use client';

import React, { useState, useEffect } from 'react';
import { Search, Replace, X } from 'lucide-react';

interface FindReplaceBarProps {
  matchCount: number;
  replaceableCount: number;
  onFindChange: (findText: string) => void;
  onReplaceAll: (findText: string, replaceText: string) => void;
  onClose: () => void;
  isReplacing?: boolean;
}

const FindReplaceBar: React.FC<FindReplaceBarProps> = ({
  matchCount,
  replaceableCount,
  onFindChange,
  onReplaceAll,
  onClose,
  isReplacing = false,
}) => {
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');

  useEffect(() => {
    onFindChange(findText);
  }, [findText, onFindChange]);

  const canReplace = findText.length > 0 && replaceableCount > 0 && !isReplacing;

  return (
    <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 flex-wrap">
      <Search size={14} className="text-muted-foreground flex-shrink-0" />
      <input
        autoFocus
        type="text"
        value={findText}
        onChange={(e) => setFindText(e.target.value)}
        placeholder="Find..."
        className="bg-background border border-border rounded px-2 py-1 text-sm w-40 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
      <Replace size={14} className="text-muted-foreground flex-shrink-0" />
      <input
        type="text"
        value={replaceText}
        onChange={(e) => setReplaceText(e.target.value)}
        placeholder="Replace with..."
        className="bg-background border border-border rounded px-2 py-1 text-sm w-40 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {findText
          ? matchCount === replaceableCount
            ? `${matchCount} match${matchCount === 1 ? '' : 'es'}`
            : `${matchCount} match${matchCount === 1 ? '' : 'es'} (${replaceableCount} replaceable)`
          : 'searches all columns'}
      </span>
      <button
        type="button"
        disabled={!canReplace}
        onClick={() => onReplaceAll(findText, replaceText)}
        title={findText && matchCount > 0 && replaceableCount === 0 ? 'No matches in editable columns' : undefined}
        className="px-3 py-1.5 rounded-md text-xs font-semibold bg-brand-600 text-white hover:bg-brand-700 transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
      >
        Replace All
      </button>
      <button
        type="button"
        onClick={onClose}
        className="ml-auto p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        title="Close find & replace"
        aria-label="Close find & replace"
      >
        <X size={14} />
      </button>
    </div>
  );
};

export default React.memo(FindReplaceBar);
