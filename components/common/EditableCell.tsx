'use client';

import React from 'react';
import { Pencil, Loader2 } from 'lucide-react';
import type { ColumnDef } from './DataTable';

export type CellEditStatus = 'editing' | 'saving' | 'error';

interface EditableCellProps<T> {
  row: T;
  column: ColumnDef<T>;
  displayClassName: string;
  isEditing: boolean;
  editValue: string;
  editStatus?: CellEditStatus;
  errorMessage?: string;
  onStartEdit: () => void;
  onChangeValue: (value: string) => void;
  onCommit: (overrideValue?: string) => void;
  onCancel: () => void;
}

function EditableCell<T>({
  row,
  column,
  displayClassName,
  isEditing,
  editValue,
  editStatus,
  errorMessage,
  onStartEdit,
  onChangeValue,
  onCommit,
  onCancel,
}: EditableCellProps<T>) {
  const value = row[column.accessorKey];

  if (!isEditing) {
    return (
      <div className="group/cell relative flex items-center gap-1.5">
        <div className={displayClassName}>
          {column.cell ? column.cell(value, row) : String(value ?? '')}
        </div>
        {column.editable && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onStartEdit(); }}
            className="flex-shrink-0 p-1 rounded text-muted-foreground/60 hover:text-brand-500 hover:bg-brand-500/10 transition-opacity opacity-50 md:opacity-0 md:group-hover/cell:opacity-100 md:group-focus-within/cell:opacity-100"
            title={`Edit ${column.header}`}
            aria-label={`Edit ${column.header}`}
          >
            <Pencil size={12} />
          </button>
        )}
      </div>
    );
  }

  const isSaving = editStatus === 'saving';
  const hasError = editStatus === 'error';

  const inputClass = `w-full min-w-0 bg-background border rounded px-1.5 py-1 text-sm focus:outline-none focus:ring-1 ${
    hasError ? 'border-rose-500 ring-1 ring-rose-500' : 'border-brand-500 ring-1 ring-brand-500'
  }`;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); onCommit(); }
    else if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
  };

  return (
    <div onClick={(e) => e.stopPropagation()} className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1">
        {column.editType === 'select' ? (
          <select
            autoFocus
            value={editValue}
            disabled={isSaving}
            onChange={(e) => { onChangeValue(e.target.value); onCommit(e.target.value); }}
            onKeyDown={handleKeyDown}
            className={inputClass}
          >
            {(column.editOptions ?? []).map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        ) : (
          <input
            autoFocus
            type={column.editType === 'number' ? 'number' : column.editType === 'date' ? 'date' : 'text'}
            value={editValue}
            disabled={isSaving}
            onChange={(e) => onChangeValue(e.target.value)}
            onBlur={() => onCommit()}
            onKeyDown={handleKeyDown}
            className={inputClass}
          />
        )}
        {isSaving && <Loader2 size={14} className="animate-spin text-muted-foreground flex-shrink-0" />}
      </div>
      {hasError && errorMessage && (
        <span className="text-[11px] text-rose-500 leading-tight">{errorMessage}</span>
      )}
    </div>
  );
}

export default React.memo(EditableCell) as typeof EditableCell;
