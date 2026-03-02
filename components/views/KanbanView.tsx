'use client';

import React, { useState } from 'react';
import Spinner from "../common/Spinner";
import EmptyState from "../common/EmptyState";
import { ClipboardList } from 'lucide-react';

export interface KanbanColumn<T> {
  id: string;
  title: string;
  items: T[];
  color: 'sky' | 'emerald' | 'rose' | 'violet' | 'amber' | 'slate';
  renderHeader?: (items: T[]) => React.ReactNode;
}

interface KanbanViewProps<T> {
  columns: KanbanColumn<T>[];
  renderCardContent: (item: T) => React.ReactNode;
  onCardClick: (item: T) => void;
  loading: boolean;
  onItemMove?: (item: T, newColumnId: string) => void;
  getItemId: (item: T) => string;
}

const colorConfig = {
  sky: { border: 'border-sky-500', bg: 'bg-sky-100', text: 'text-sky-800', bgDot: 'bg-sky-500' },
  emerald: { border: 'border-emerald-500', bg: 'bg-emerald-100', text: 'text-emerald-800', bgDot: 'bg-emerald-500' },
  rose: { border: 'border-rose-500', bg: 'bg-rose-100', text: 'text-rose-800', bgDot: 'bg-rose-500' },
  violet: { border: 'border-violet-500', bg: 'bg-violet-100', text: 'text-violet-800', bgDot: 'bg-violet-500' },
  amber: { border: 'border-amber-500', bg: 'bg-amber-100', text: 'text-amber-800', bgDot: 'bg-amber-500' },
  slate: { border: 'border-slate-500', bg: 'bg-slate-100', text: 'text-slate-800', bgDot: 'bg-slate-500' },
};


const KanbanBoardSkeleton = () => (
  <div className="flex-1 overflow-x-auto horizontal-scroll p-6 bg-slate-100">
    <div className="grid gap-6 h-full" style={{ gridTemplateColumns: 'repeat(5, minmax(320px, 1fr))' }}>
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-backwards" style={{ animationDelay: `${i * 100}ms` }}>
          <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200 mb-4 h-24 w-full animate-pulse"></div>
          <div className="space-y-3 flex-1">
            <div className="h-32 bg-slate-200 rounded-lg animate-pulse w-full"></div>
            <div className="h-32 bg-slate-200 rounded-lg animate-pulse w-full"></div>
            <div className="h-32 bg-slate-200 rounded-lg animate-pulse w-full"></div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

function KanbanView<T>({ columns, renderCardContent, onCardClick, loading, onItemMove, getItemId }: KanbanViewProps<T>) {
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  if (loading) {
    return <KanbanBoardSkeleton />;
  }

  const handleDragStart = (e: React.DragEvent, item: T, columnId: string) => {
    if (!onItemMove) return;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/json', JSON.stringify({ item, sourceColumnId: columnId }));
    (e.target as HTMLElement).setAttribute('data-dragging', 'true');
  };

  const handleDragEnd = (e: React.DragEvent) => {
    (e.target as HTMLElement).setAttribute('data-dragging', 'false');
    setDragOverColumn(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (onItemMove) {
      e.preventDefault();
    }
  };

  const handleDragEnter = (e: React.DragEvent, columnId: string) => {
    if (onItemMove) {
      e.preventDefault();
      setDragOverColumn(columnId);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault();
    if (!onItemMove) return;
    const data = e.dataTransfer.getData('application/json');
    if (data) {
      const { item, sourceColumnId } = JSON.parse(data);
      if (sourceColumnId !== targetColumnId) {
        onItemMove(item, targetColumnId);
      }
    }
    setDragOverColumn(null);
  };

  const totalItems = columns.reduce((sum, col) => sum + col.items.length, 0);

  if (totalItems === 0 && !loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50">
        <EmptyState illustration={<ClipboardList className="w-20 h-20 text-slate-300" />}>
          <h3 className="mt-2 text-lg font-semibold text-gray-900">No Items to Display</h3>
          <p className="mt-1 text-sm text-slate-600">There are currently no items in the board.</p>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-x-auto horizontal-scroll p-6 bg-slate-100">
      <div
        className="grid gap-6 h-full kanban-board-grid"
        style={{ '--kanban-column-count': columns.length } as React.CSSProperties}
      >
        {columns.map(column => {
          const colors = colorConfig[column.color] || colorConfig.sky;
          return (
            <div
              key={column.id}
              className={`flex flex-col h-full transition-colors duration-200 ${dragOverColumn === column.id ? 'kanban-column-dragover' : ''}`}
              onDragOver={handleDragOver}
              onDragEnter={(e) => handleDragEnter(e, column.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column.id)}
            >

              {/* Header Card */}
              <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200/70 mb-4 flex-shrink-0 transition-all duration-200">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${colors.bgDot}`}></span>
                      <h3 className="font-semibold uppercase tracking-wider text-xs text-slate-600">
                        {column.title}
                      </h3>
                    </div>
                    {column.renderHeader && (
                      <div className="mt-1 pl-[16px]">
                        {column.renderHeader(column.items)}
                      </div>
                    )}
                  </div>
                  <span className={`w-8 h-8 flex items-center justify-center text-sm font-bold rounded-full ${colors.bg} ${colors.text}`}>
                    {column.items.length}
                  </span>
                </div>
              </div>

              {/* Scrollable list of cards */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-2 vertical-scroll pb-2">
                {column.items.length > 0 ? (
                  column.items.map((item, index) => (
                    <div
                      key={getItemId(item)}
                      draggable={!!onItemMove}
                      onDragStart={(e) => handleDragStart(e, item, column.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => onCardClick(item)}
                      className={`w-full text-left bg-white p-4 rounded-lg shadow-sm hover:shadow-md ${!!onItemMove ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} transition-all duration-200 group relative border-l-4 animate-in fade-in zoom-in-95 duration-300 fill-mode-backwards`}
                      style={{
                        borderColor: colorConfig[column.color].border.replace('border-', '') || undefined,
                        animationDelay: `${Math.min((index % 10) * 50, 500)}ms`
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onCardClick(item)}
                    >
                      {renderCardContent(item)}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-16 px-4 text-slate-600 text-sm h-full flex flex-col items-center justify-center">
                    <div className="p-6 rounded-lg border-2 border-dashed border-slate-200 w-full">
                      <p className="font-medium text-slate-400">{onItemMove ? "Drag items here" : "No items to display"}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default KanbanView;
