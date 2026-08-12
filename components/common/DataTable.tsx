'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ClipboardList, Download, Replace } from 'lucide-react';
import ExcelJS from 'exceljs';
import EmptyState from "./EmptyState";
import RowContextMenu from "./RowContextMenu";
import EditableCell from "./EditableCell";
import BulkActionsBar from "./BulkActionsBar";
import FindReplaceBar from "./FindReplaceBar";
import ConfirmationModal from "../modals/ConfirmationModal";
import { Checkbox } from "../ui/checkbox";
import { parseDate } from "../../utils/time";
import { parseSheetValue } from "../../utils/formatters";
import { useResizableColumns } from "../../hooks/useResizableColumns";
import { useIsMobile } from "../../hooks/useIsMobile";
import { Z } from "../../lib/zIndex";

/** Canonical cell-overflow modes. Drives `CellWrapToggle`. */
export type CellWrapStyle = 'overflow' | 'wrap' | 'clip' | 'nowrap';

export interface ColumnDef<T> {
  accessorKey: keyof T;
  header: string;
  cell?: (value: T[keyof T], row: T) => React.ReactNode;
  isSortable?: boolean;
  editable?: boolean;
  editType?: 'text' | 'number' | 'date' | 'select';
  editOptions?: string[];
}

export interface BatchResult {
  id: string;
  success: boolean;
  error?: string;
}

export interface BulkActionConfig<T> {
  label: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'danger';
  onClick: (rows: T[]) => Promise<BatchResult[]>;
  confirmText?: string;
}

// Worker-pool runner: continue-on-error, bounded concurrency. Shared by
// DataTable's own Find & Replace and by dashboards implementing bulkActions.
export async function runBatched<I, R>(
  items: I[],
  worker: (item: I) => Promise<R>,
  concurrency = 5
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const runNext = async (): Promise<void> => {
    const i = cursor++;
    if (i >= items.length) return;
    results[i] = await worker(items[i]);
    return runNext();
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runNext));
  return results;
}

interface DataTableProps<T extends object> {
  tableId: string;
  data: T[];
  columns: ColumnDef<T>[];
  loading: boolean;
  onRowClick?: (row: T) => void;
  initialSort?: { key: keyof T; direction: 'ascending' | 'descending' };
  highlightedCheck?: (row: T) => boolean;
  mobilePrimaryColumns: (keyof T)[];
  cellWrapStyle?: CellWrapStyle;
  /**
   * What to show when there are no rows. Without this every empty table in
   * the app fell back to EmptyState's generic "No results found / Try
   * adjusting your search or filter criteria" — wrong and dead-ended on a
   * module that simply has no records yet, where the right answer is
   * "No invoices yet" plus a way to create one.
   */
  emptyState?: {
    title?: string;
    description?: string;
    action?: React.ReactNode;
  };
  renderRowActions?: (row: T) => React.ReactNode;
  renderRowContextMenu?: (row: T) => React.ReactNode;
  stickyFirstColumn?: boolean;
  getRowId?: (row: T) => string;
  onCellEdit?: (row: T, columnKey: keyof T, newValue: any) => Promise<void>;
  onError?: (message: string) => void;
  enableRowSelection?: boolean;
  bulkActions?: BulkActionConfig<T>[];
  enableFindReplace?: boolean;
  /** Allow dragging rows into the AI assistant (default true). */
  enableDragToAI?: boolean;
}

const DOTS = '...';

const range = (start: number, end: number) => {
  let length = end - start + 1;
  return Array.from({ length }, (_, idx) => idx + start);
};

const usePagination = ({
  totalCount,
  pageSize,
  siblingCount = 1,
  currentPage,
}: {
  totalCount: number;
  pageSize: number;
  siblingCount?: number;
  currentPage: number;
}) => {
  const paginationRange = useMemo(() => {
    const totalPageCount = Math.ceil(totalCount / pageSize);
    const totalPageNumbers = siblingCount + 5;

    if (totalPageNumbers >= totalPageCount) {
      return range(1, totalPageCount);
    }

    const leftSiblingIndex = Math.max(currentPage - siblingCount, 1);
    const rightSiblingIndex = Math.min(currentPage + siblingCount, totalPageCount);
    const shouldShowLeftDots = leftSiblingIndex > 2;
    const shouldShowRightDots = rightSiblingIndex < totalPageCount - 2;
    const firstPageIndex = 1;
    const lastPageIndex = totalPageCount;

    if (!shouldShowLeftDots && shouldShowRightDots) {
      let leftItemCount = 3 + 2 * siblingCount;
      let leftRange = range(1, leftItemCount);
      return [...leftRange, DOTS, totalPageCount];
    }

    if (shouldShowLeftDots && !shouldShowRightDots) {
      let rightItemCount = 3 + 2 * siblingCount;
      let rightRange = range(totalPageCount - rightItemCount + 1, totalPageCount);
      return [firstPageIndex, DOTS, ...rightRange];
    }

    if (shouldShowLeftDots && shouldShowRightDots) {
      let middleRange = range(leftSiblingIndex, rightSiblingIndex);
      return [firstPageIndex, DOTS, ...middleRange, DOTS, lastPageIndex];
    }

    return []; // Fallback empty array
  }, [totalCount, pageSize, siblingCount, currentPage]);

  return paginationRange;
};

const MobileTableSkeleton: React.FC<{ columns: number }> = ({ columns }) => (
  <div className="space-y-4 p-4 sm:p-6">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="bg-card p-4 rounded-xl border border-border shadow-sm animate-pulse">
        <div className="space-y-4 pt-2">
          {[...Array(Math.min(columns, 3))].map((_, j) => (
            <div key={j} className="flex justify-between items-center">
              <div className="h-4 bg-muted rounded w-1/4"></div>
              <div className="h-5 bg-muted rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
);

const DesktopTableSkeleton: React.FC<{ columns: number, rows: number }> = ({ columns, rows }) => (
  <table className="w-full">
    <thead className="bg-primary">
      <tr>
        {[...Array(columns)].map((_, i) => (
          <th key={i} className="px-4 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-primary-foreground/80 uppercase tracking-wider">
            <div className="h-4 bg-primary-foreground/20 rounded w-3/4 animate-pulse"></div>
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {[...Array(rows)].map((_, i) => (
        <tr key={i} className="border-b border-border">
          {[...Array(columns)].map((_, j) => (
            <td key={j} className="px-4 sm:px-6 py-2 sm:py-2.5">
              <div className="h-3.5 bg-muted rounded w-full animate-pulse"></div>
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
);

// (A combined responsive `TableSkeleton` used to live here. It was never
// referenced — the mobile and desktop skeletons are each rendered directly
// from the branch that needs them.)

function DataTable<T extends object>({
  tableId,
  data,
  columns,
  loading,
  onRowClick,
  initialSort,
  highlightedCheck,
  mobilePrimaryColumns,
  cellWrapStyle = 'overflow',
  emptyState,
  renderRowActions,
  renderRowContextMenu,
  stickyFirstColumn = true,
  getRowId,
  onCellEdit,
  onError,
  enableRowSelection = false,
  bulkActions,
  enableFindReplace = false,
  enableDragToAI = true,
}: DataTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100);
  const [sortConfig, setSortConfig] = useState<{ key: keyof T | null; direction: 'ascending' | 'descending' }>(initialSort || { key: null, direction: 'ascending' });
  const { columnWidths, handleMouseDown, tableRef, resizingColumn, autoFitColumn } = useResizableColumns(tableId, columns);
  const [expandedRows, setExpandedRows] = useState(new Set<number>());
  const [contextMenu, setContextMenu] = useState<{ row: T; x: number; y: number } | null>(null);
  const [showScrollHint, setShowScrollHint] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  // Switch to the touch-friendly card list at the same width the app shell
  // switches to its mobile layout (MOBILE_BREAKPOINT / the `.secondary-cell`
  // CSS breakpoint). Below this the table lives inside the mobile chrome (top
  // bar + bottom tab nav), so a cramped horizontally-scrolling desktop table
  // on tablets is replaced by cards.
  const isMobile = useIsMobile();

  // ── Inline edit / selection / find-replace state ──────────────────────────
  type CellEditState = {
    rowId: string;
    columnKey: string;
    value: string;
    status: 'editing' | 'saving' | 'error';
    errorMessage?: string;
  };
  const [cellEdit, setCellEdit] = useState<CellEditState | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [findReplaceOpen, setFindReplaceOpen] = useState(false);
  const [findText, setFindText] = useState('');
  const [bulkConfirm, setBulkConfirm] = useState<
    { type: 'bulk'; actionIndex: number } | { type: 'replace'; findText: string; replaceText: string } | null
  >(null);
  const [runningBulkIndex, setRunningBulkIndex] = useState<number | null>(null);
  const [isReplacing, setIsReplacing] = useState(false);

  const usesNewFeatures = enableRowSelection || enableFindReplace || columns.some(c => c.editable);
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' && usesNewFeatures && !getRowId) {
      console.warn(`DataTable "${tableId}": pass getRowId to use row selection, inline editing, or find & replace.`);
    }
  }, [usesNewFeatures, getRowId, tableId]);

  const getRowKey = useCallback((row: T, fallbackIndex: number): string => {
    return getRowId ? getRowId(row) : String(fallbackIndex);
  }, [getRowId]);

  // Drag a row (or the whole selection, if the row is selected) into the AI.
  const handleRowDragStart = useCallback((e: React.DragEvent, row: T, rowId: string) => {
    const el = e.target as HTMLElement;
    if (el.closest('input,textarea,button,select,a,[role="checkbox"]')) { e.preventDefault(); return; }
    let rows: T[] = [row];
    if (enableRowSelection && getRowId && selectedKeys.size > 0 && selectedKeys.has(rowId)) {
      const sel = data.filter(r => selectedKeys.has(getRowId(r)));
      if (sel.length) rows = sel;
    }
    try {
      e.dataTransfer.setData('application/x-lpt-rows', JSON.stringify({ source: tableId, count: rows.length, rows }));
      e.dataTransfer.setData('text/plain', `${rows.length} row(s) from ${tableId}`);
      e.dataTransfer.effectAllowed = 'copy';
    } catch { /* ignore */ }
  }, [enableRowSelection, getRowId, selectedKeys, data, tableId]);

  const toggleRowSelection = (rowId: string) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId); else next.add(rowId);
      return next;
    });
  };

  const handleStartEdit = (row: T, col: ColumnDef<T>, rowId: string) => {
    if (cellEdit?.status === 'saving') return;
    setCellEdit({
      rowId,
      columnKey: String(col.accessorKey),
      value: String(row[col.accessorKey] ?? ''),
      status: 'editing',
    });
  };

  const handleCancelEdit = () => setCellEdit(null);

  const handleChangeEditValue = (value: string) => {
    setCellEdit(prev => prev ? { ...prev, value } : prev);
  };

  // Drag to scroll functionality
  const dragRef = React.useRef<{ isDown: boolean; startX: number; scrollLeft: number }>({ isDown: false, startX: 0, scrollLeft: 0 });
  const containerRef = React.useRef<HTMLDivElement>(null);

  const handleDragDown = (e: React.MouseEvent) => {
    if (!containerRef.current || resizingColumn) return;
    dragRef.current = {
      isDown: true,
      startX: e.pageX - containerRef.current.offsetLeft,
      scrollLeft: containerRef.current.scrollLeft
    };
    containerRef.current.style.cursor = 'grabbing';
    containerRef.current.style.userSelect = 'none';
  };

  const handleDragLeave = () => {
    if (!containerRef.current) return;
    dragRef.current.isDown = false;
    containerRef.current.style.cursor = 'default';
    containerRef.current.style.removeProperty('user-select');
  };

  const handleDragUp = () => {
    if (!containerRef.current) return;
    dragRef.current.isDown = false;
    containerRef.current.style.cursor = 'default';
    containerRef.current.style.removeProperty('user-select');
  };

  const handleDragMove = (e: React.MouseEvent) => {
    if (!dragRef.current.isDown || !containerRef.current || resizingColumn) return;
    e.preventDefault();
    const x = e.pageX - containerRef.current.offsetLeft;
    const walk = (x - dragRef.current.startX) * 1.5; // multiplier for speed
    containerRef.current.scrollLeft = dragRef.current.scrollLeft - walk;
  };

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = containerRef.current;
    // Show hint if there's more content to the right (at least 50px)
    setShowScrollHint(scrollWidth > clientWidth + scrollLeft + 50);
    setIsScrolled(scrollLeft > 0);
  };


  const wrapClass = useMemo(() => {
    switch (cellWrapStyle) {
      case 'wrap':
        return 'whitespace-normal break-words';
      case 'clip':
        return 'overflow-clip';
      case 'nowrap':
        return 'whitespace-nowrap';
      case 'overflow':
      default:
        return 'truncate';
    }
  }, [cellWrapStyle]);

  const toggleRowExpansion = (index: number) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const handleRowClick = (item: T, index: number) => {
    if (isMobile) {
      if (onRowClick) {
        onRowClick(item);
      } else {
        toggleRowExpansion(index);
      }
    } else if (onRowClick) {
      onRowClick(item);
    }
  };

  const handleRowContextMenu = (e: React.MouseEvent, item: T) => {
    if (!renderRowContextMenu) return;
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ row: item, x: e.clientX, y: e.clientY });
  };

  // Mobile card renderer — fires when isMobile is true
  const renderMobileCards = () => {
    if (loading) return <MobileTableSkeleton columns={columns.length} />;
    if (paginatedData.length === 0) return (
      <div className="p-8 flex items-center justify-center">
        <EmptyState
          illustration={<ClipboardList className="w-16 h-16 text-muted-foreground/20" />}
          title={emptyState?.title}
          description={emptyState?.description}
          action={emptyState?.action}
        />
      </div>
    );
    const sortableColumns = columns.filter(c => c.isSortable);
    return (
      <>
        {/* Mobile sort control — the card layout has no column headers to click,
            so without this there's no way to re-sort on a phone. Wired to the
            same sortConfig the desktop headers drive. */}
        {sortableColumns.length > 0 && (
          <div style={{ zIndex: Z.STICKY }} className="sticky top-0 flex items-center gap-2 px-4 py-2 bg-card/95 backdrop-blur-sm border-b border-border">
            <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            <label htmlFor="mobile-sort" className="sr-only">Sort by</label>
            <select
              id="mobile-sort"
              value={sortConfig.key ? String(sortConfig.key) : ''}
              onChange={(e) => {
                if (!e.target.value) return;
                setSortConfig({ key: e.target.value as keyof T, direction: 'ascending' });
                setCurrentPage(1);
              }}
              className="flex-1 min-w-0 bg-muted border border-border rounded-md text-sm py-1.5 px-2 text-foreground focus:ring-1 focus:ring-ring focus:border-primary"
            >
              <option value="" disabled>Sort by…</option>
              {sortableColumns.map((c) => (
                <option key={String(c.accessorKey)} value={String(c.accessorKey)}>{c.header}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                setSortConfig(prev => ({
                  key: prev.key ?? sortableColumns[0].accessorKey,
                  direction: prev.direction === 'ascending' ? 'descending' : 'ascending',
                }));
                setCurrentPage(1);
              }}
              className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-muted border border-border text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
              aria-label={`Sort direction: ${sortConfig.direction}`}
            >
              {sortConfig.direction === 'ascending' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
              {sortConfig.direction === 'ascending' ? 'Asc' : 'Desc'}
            </button>
          </div>
        )}
        <ul className="divide-y divide-border">
        {paginatedData.map((item, index) => {
          const globalIndex = startIndex + index;
          const rowId = getRowKey(item, globalIndex);
          const isHighlighted = highlightedCheck ? highlightedCheck(item) : false;
          // Split columns into primary (always shown) and secondary (shown below)
          const primaryCols = columns.filter(c => mobilePrimaryColumns.includes(c.accessorKey));
          const secondaryCols = columns.filter(c => !mobilePrimaryColumns.includes(c.accessorKey));
          const [firstPrimary, ...restPrimary] = primaryCols;

          const editableCellProps = (col: ColumnDef<T>) => ({
            row: item,
            column: col,
            isEditing: !!cellEdit && cellEdit.rowId === rowId && cellEdit.columnKey === String(col.accessorKey),
            editValue: cellEdit?.value ?? '',
            editStatus: cellEdit?.status,
            errorMessage: cellEdit?.errorMessage,
            onStartEdit: () => handleStartEdit(item, col, rowId),
            onChangeValue: handleChangeEditValue,
            onCommit: handleCommitEdit,
            onCancel: handleCancelEdit,
          });

          return (
            <li
              key={globalIndex}
              onClick={() => handleRowClick(item, globalIndex)}
              onContextMenu={(e) => handleRowContextMenu(e, item)}
              // The desktop <tr> is focusable and Enter/Space-activated; the
              // mobile card was click-only, so the whole list was unreachable
              // by keyboard (and to switch-access / external-keyboard users).
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleRowClick(item, globalIndex);
                }
              }}
              className={`px-4 py-3 flex items-start gap-3 active:bg-accent/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
                isHighlighted ? 'bg-amber-500/10' : 'bg-card'
              } ${onRowClick ? 'cursor-pointer' : ''}`}
            >
              {/* Selection checkbox */}
              {enableRowSelection && (
                <div onClick={(e) => e.stopPropagation()} className="flex-shrink-0 pt-0.5">
                  <Checkbox
                    checked={selectedKeys.has(rowId)}
                    onCheckedChange={() => toggleRowSelection(rowId)}
                    aria-label="Select row"
                  />
                </div>
              )}

              {/* Left: accent bar */}
              <div className="w-0.5 self-stretch rounded-full bg-primary/30 flex-shrink-0" />

              {/* Main content */}
              <div className="flex-1 min-w-0 space-y-0.5">
                {/* First primary column — headline */}
                {firstPrimary && (
                  firstPrimary.editable ? (
                    <EditableCell {...editableCellProps(firstPrimary)} displayClassName="font-semibold text-sm text-foreground truncate" />
                  ) : (
                    <div className="font-semibold text-sm text-foreground truncate">
                      {firstPrimary.cell
                        ? firstPrimary.cell(item[firstPrimary.accessorKey], item)
                        : String(item[firstPrimary.accessorKey] ?? '')}
                    </div>
                  )
                )}
                {/* Rest of primary columns — subtitle row */}
                {restPrimary.length > 0 && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                    {restPrimary.map((col, colIdx) => (
                      col.editable ? (
                        <EditableCell key={`${String(col.accessorKey)}-${colIdx}`} {...editableCellProps(col)} displayClassName="text-xs text-muted-foreground" />
                      ) : (
                        <span key={`${String(col.accessorKey)}-${colIdx}`} className="text-xs text-muted-foreground">
                          {col.cell
                            ? col.cell(item[col.accessorKey], item)
                            : String(item[col.accessorKey] ?? '')}
                        </span>
                      )
                    ))}
                  </div>
                )}
              </div>

              {/* Right: row actions */}
              {renderRowActions && (
                <div onClick={e => e.stopPropagation()} className="flex-shrink-0">
                  {renderRowActions(item)}
                </div>
              )}
            </li>
          );
        })}
        </ul>
      </>
    );
  };


  useEffect(() => {
    setCurrentPage(1);
  }, [data.length, itemsPerPage]);

  // Reset vertical scroll to the top when the user changes page, sort, or page
  // size, so a fresh set of rows starts from the first one. Horizontal scroll
  // is intentionally preserved (keeps the user's column context). Keyed only on
  // user-driven state — a silent background data refresh won't yank the scroll.
  useEffect(() => {
    if (containerRef.current) containerRef.current.scrollTop = 0;
  }, [currentPage, sortConfig, itemsPerPage]);

  const sortedData = useMemo(() => {
    let sortableItems = [...data];
    if (sortConfig.key !== null) {
      // FIX: Use String() to safely convert key to string, preventing errors if key is number/symbol.
      const sortKey = String(sortConfig.key);

      const isCurrencyColumn =
        sortKey.toLowerCase().includes('value') ||
        sortKey.toLowerCase().includes('amount');

      sortableItems.sort((a, b) => {
        const aValue = a[sortConfig.key!];
        const bValue = b[sortConfig.key!];
        const directionMultiplier = sortConfig.direction === 'ascending' ? 1 : -1;

        // 1. Handle explicit currency columns
        if (isCurrencyColumn) {
          const numA = parseSheetValue(aValue);
          const numB = parseSheetValue(bValue);
          return (numA - numB) * directionMultiplier;
        }

        // 2. Handle native Date objects
        if (aValue instanceof Date || bValue instanceof Date) {
          const timeA = aValue instanceof Date ? aValue.getTime() : null;
          const timeB = bValue instanceof Date ? bValue.getTime() : null;
          if (timeA === timeB) return 0;
          if (timeA === null) return 1; // Sort nulls to the end
          if (timeB === null) return -1;
          return (timeA - timeB) * directionMultiplier;
        }

        // 3. Handle native numbers
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return (aValue - bValue) * directionMultiplier;
        }

        // 4. Handle date strings
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          const dateA = parseDate(aValue);
          const dateB = parseDate(bValue);
          if (dateA && dateB) {
            return (dateA.getTime() - dateB.getTime()) * directionMultiplier;
          }
        }

        // 5. Fallback to locale-insensitive string comparison
        const valA = String(aValue ?? '').toLowerCase();
        const valB = String(bValue ?? '').toLowerCase();
        return valA.localeCompare(valB) * directionMultiplier;
      });
    }
    return sortableItems;
  }, [data, sortConfig]);

  const totalPages = Math.ceil(sortedData.length / itemsPerPage);

  const paginationRange = usePagination({
    currentPage,
    totalCount: sortedData.length,
    pageSize: itemsPerPage,
    siblingCount: 1,
  });

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedData.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedData, currentPage, itemsPerPage]);

  useEffect(() => {
    // Initial check with a small delay to allow DOM to settle
    const timer = setTimeout(handleScroll, 100);
    window.addEventListener('resize', handleScroll);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleScroll);
    };
  }, [paginatedData, columnWidths]);

  const handleSort = (key: keyof T) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };

  const handleItemsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setItemsPerPage(Number(e.target.value));
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, sortedData.length);

  // ── Selection / edit-commit / find-replace logic that needs sortedData ───
  const pageRowIds = useMemo(
    () => paginatedData.map((r, i) => getRowKey(r, startIndex + i)),
    [paginatedData, getRowKey, startIndex]
  );
  const allOnPageSelected = pageRowIds.length > 0 && pageRowIds.every(id => selectedKeys.has(id));
  const someOnPageSelected = !allOnPageSelected && pageRowIds.some(id => selectedKeys.has(id));

  const toggleSelectAllOnPage = () => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        pageRowIds.forEach(id => next.delete(id));
      } else {
        pageRowIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const selectedRows = useMemo(() => {
    if (selectedKeys.size === 0) return [];
    return sortedData.filter((r, i) => selectedKeys.has(getRowKey(r, i)));
  }, [sortedData, selectedKeys, getRowKey]);

  const handleCommitEdit = async (overrideValue?: string) => {
    if (!cellEdit) return;
    const finalValue = overrideValue !== undefined ? overrideValue : cellEdit.value;
    const rowIndex = sortedData.findIndex((r, i) => getRowKey(r, i) === cellEdit.rowId);
    const row = rowIndex >= 0 ? sortedData[rowIndex] : undefined;
    const col = columns.find(c => String(c.accessorKey) === cellEdit.columnKey);

    if (!row || !col || !onCellEdit) { setCellEdit(null); return; }

    const originalValue = String(row[col.accessorKey] ?? '');
    if (finalValue === originalValue) { setCellEdit(null); return; }

    setCellEdit(prev => prev ? { ...prev, value: finalValue, status: 'saving' } : prev);
    try {
      await onCellEdit(row, col.accessorKey, finalValue);
      setCellEdit(null);
    } catch (err: any) {
      const message = err?.message || 'Failed to save';
      setCellEdit(prev => prev ? { ...prev, status: 'error', errorMessage: message } : prev);
      onError?.(message);
    }
  };

  // Find scans every column (read-only); Replace only ever writes to columns
  // marked editable — Replace All has no undo, so non-editable matches
  // (dates, numbers, computed/badge columns) are surfaced but never written.
  const findMatches = useMemo(() => {
    if (!findText) return [];
    const needle = findText.toLowerCase();
    const matches: { row: T; rowId: string; column: ColumnDef<T>; replaceable: boolean }[] = [];
    sortedData.forEach((row, i) => {
      columns.forEach(col => {
        const val = String(row[col.accessorKey] ?? '');
        if (val && val.toLowerCase().includes(needle)) {
          matches.push({ row, rowId: getRowKey(row, i), column: col, replaceable: !!col.editable });
        }
      });
    });
    return matches;
  }, [findText, sortedData, columns, getRowKey]);

  const replaceableMatches = useMemo(() => findMatches.filter(m => m.replaceable), [findMatches]);

  const activeBulkAction = bulkConfirm?.type === 'bulk' ? bulkActions?.[bulkConfirm.actionIndex] : undefined;

  const replacePreview = useMemo(() => {
    if (!bulkConfirm || bulkConfirm.type !== 'replace') return [];
    return replaceableMatches.slice(0, 5).map(m => {
      const oldVal = String(m.row[m.column.accessorKey] ?? '');
      const newVal = oldVal.split(bulkConfirm.findText).join(bulkConfirm.replaceText);
      return { column: m.column.header, oldVal, newVal };
    });
  }, [bulkConfirm, replaceableMatches]);

  const handleReplaceAll = async (find: string, replace: string) => {
    if (!onCellEdit || replaceableMatches.length === 0) return;
    setIsReplacing(true);
    try {
      const results = await runBatched(replaceableMatches, async (m) => {
        try {
          const oldVal = String(m.row[m.column.accessorKey] ?? '');
          const newVal = oldVal.split(find).join(replace);
          await onCellEdit(m.row, m.column.accessorKey, newVal);
          return { id: m.rowId, success: true } as BatchResult;
        } catch (err: any) {
          return { id: m.rowId, success: false, error: err?.message || 'Failed' } as BatchResult;
        }
      }, 5);
      const failed = results.filter(r => !r.success);
      if (failed.length > 0) {
        onError?.(`${results.length - failed.length}/${results.length} replaced. ${failed.length} failed.`);
      }
      setFindReplaceOpen(false);
      setFindText('');
    } finally {
      setIsReplacing(false);
      setBulkConfirm(null);
    }
  };

  const runBulkAction = async (index: number) => {
    const action = bulkActions?.[index];
    if (!action) return;
    setRunningBulkIndex(index);
    try {
      const rows = selectedRows;
      const results = await action.onClick(rows);
      const failed = results.filter(r => !r.success);
      const succeededIds = new Set(results.filter(r => r.success).map(r => r.id));
      setSelectedKeys(prev => {
        const next = new Set(prev);
        succeededIds.forEach(id => next.delete(id));
        return next;
      });
      if (failed.length > 0) {
        onError?.(`${results.length - failed.length}/${results.length} updated. ${failed.length} failed: ${failed.map(f => `${f.id}${f.error ? ` (${f.error})` : ''}`).join(', ')}`);
      }
    } finally {
      setRunningBulkIndex(null);
      setBulkConfirm(null);
    }
  };

  const handleBulkActionClick = (index: number) => {
    const action = bulkActions?.[index];
    if (!action) return;
    if (action.confirmText) {
      setBulkConfirm({ type: 'bulk', actionIndex: index });
    } else {
      runBulkAction(index);
    }
  };

  const handleConfirmModalConfirm = () => {
    if (!bulkConfirm) return;
    if (bulkConfirm.type === 'bulk') runBulkAction(bulkConfirm.actionIndex);
    else handleReplaceAll(bulkConfirm.findText, bulkConfirm.replaceText);
  };

  const handleExportExcel = async () => {
    if (!sortedData.length) return;

    // Filter columns to only those that have headers and accessorKeys
    const exportColumns = columns.filter(col => col.header && col.accessorKey);

    // Transform data to a simple format
    const exportData = sortedData.map(row => {
      const formattedRow: Record<string, any> = {};
      exportColumns.forEach(col => {
        formattedRow[col.header] = row[col.accessorKey];
      });
      return formattedRow;
    });

    // Create workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Data');

    // Set columns from headers
    if (exportData.length > 0) {
      worksheet.columns = Object.keys(exportData[0]).map(key => ({ header: key, key }));
    }

    // Add data rows
    exportData.forEach(row => worksheet.addRow(row));

    // Generate buffer and trigger download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tableId || 'export'}_${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full w-full bg-card md:rounded-lg border border-border shadow-sm overflow-hidden text-foreground scroll-hint-wrapper">
      {enableFindReplace && !findReplaceOpen && (
        <div className="flex-shrink-0 flex items-center justify-end px-4 py-2 border-b border-border">
          <button
            type="button"
            onClick={() => setFindReplaceOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-muted text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <Replace size={13} />
            Find &amp; Replace
          </button>
        </div>
      )}
      {findReplaceOpen && (
        <FindReplaceBar
          matchCount={findMatches.length}
          replaceableCount={replaceableMatches.length}
          onFindChange={setFindText}
          onReplaceAll={(find, replace) => setBulkConfirm({ type: 'replace', findText: find, replaceText: replace })}
          onClose={() => { setFindReplaceOpen(false); setFindText(''); }}
          isReplacing={isReplacing}
        />
      )}
      {enableRowSelection && selectedKeys.size > 0 && (
        <BulkActionsBar
          selectedCount={selectedKeys.size}
          actions={bulkActions ?? []}
          onClear={() => setSelectedKeys(new Set())}
          onAction={handleBulkActionClick}
          runningIndex={runningBulkIndex}
        />
      )}
      <div
        ref={containerRef}
        onMouseDown={!isMobile ? handleDragDown : undefined}
        onMouseLeave={!isMobile ? handleDragLeave : undefined}
        onMouseUp={!isMobile ? handleDragUp : undefined}
        onMouseMove={!isMobile ? handleDragMove : undefined}
        onScroll={handleScroll}
        className="responsive-table flex-1 w-full overflow-auto horizontal-scroll min-h-0 relative"
      >
        {isMobile ? renderMobileCards() : (loading && paginatedData.length === 0) ? (
          // Cold load: show a skeleton table instead of the real table — whose
          // empty body would otherwise flash a misleading "No records found".
          // Guarded on empty so a background revalidation (data already cached)
          // keeps showing the real rows instead of flashing the skeleton.
          <DesktopTableSkeleton columns={columns.length + (enableRowSelection ? 1 : 0)} rows={12} />
        ) : (
          <table ref={tableRef} className="w-full text-sm text-left text-muted-foreground min-w-full table-auto md:border-l md:border-t md:border-border" aria-busy={loading}>
            <colgroup>
              {enableRowSelection && <col style={{ width: '40px' }} />}
              {columns.map((col, colIdx) => (
                <col
                  key={`${String(col.accessorKey)}-${colIdx}`}
                  data-col-key={String(col.accessorKey)}
                  style={{ width: columnWidths[String(col.accessorKey)] || 'auto' }}
                />
              ))}
              {renderRowActions && (
                <col style={{ width: '120px' }} />
              )}
            </colgroup>
            {/* Header uses --primary / --primary-foreground rather than the raw
                brand ramp. `bg-brand-600 + text-white` was fixed white text on
                whatever brand-600 resolved to per theme — pale pink in Cute,
                mustard in Paper, bright green in Terminal, all around 2:1
                contrast. Every theme defines primary-foreground to contrast
                with its own primary, and in the default themes the pairing is
                byte-identical to the old blue-on-white look. */}
            <thead className="bg-primary" style={{ zIndex: Z.STICKY }}>
              <tr>
                {enableRowSelection && (
                  <th
                    scope="col"
                    className={`sticky top-0 left-0 bg-primary w-[40px] px-3 py-2.5 md:border-b-2 md:border-primary-foreground/20 ${isScrolled ? 'shadow-[4px_0_8px_-2px_rgba(0,0,0,0.3)]' : ''}`}
                    style={{ zIndex: Z.STICKY + 6 }}
                  >
                    <Checkbox
                      checked={allOnPageSelected ? true : someOnPageSelected ? 'indeterminate' : false}
                      onCheckedChange={toggleSelectAllOnPage}
                      aria-label="Select all rows on this page"
                      className="border-primary-foreground/70 data-[state=checked]:bg-primary-foreground data-[state=checked]:text-primary data-[state=indeterminate]:bg-primary-foreground data-[state=indeterminate]:text-primary"
                    />
                  </th>
                )}
                {columns.map((col, i) => (
                  <th
                    key={`${String(col.accessorKey)}-${i}`}
                    scope="col"
                    className={`pl-4 sm:pl-6 pr-3 sm:pr-4 py-2 sm:py-2.5 text-left text-xs font-bold text-primary-foreground tracking-wide whitespace-nowrap relative group md:border-b-2 md:border-primary-foreground/25 md:[&:not(:last-child)]:border-r md:border-primary-foreground/15 transition-colors
                        sticky top-0 bg-primary
                        ${resizingColumn === String(col.accessorKey) ? 'brightness-90' : ''}
                        ${i === 0 && stickyFirstColumn && !enableRowSelection ? 'left-0' : ''}
                        ${i === 0 && stickyFirstColumn && !enableRowSelection && isScrolled ? 'shadow-[4px_0_8px_-2px_rgba(0,0,0,0.3)]' : ''}
                        ${isMobile && !mobilePrimaryColumns.includes(col.accessorKey) ? 'secondary-cell' : ''}
                      `}
                    aria-sort={sortConfig.key === col.accessorKey ? sortConfig.direction : 'none'}
                    // Frozen first column must out-stack its scrolling siblings.
                    style={{ zIndex: i === 0 && stickyFirstColumn && !enableRowSelection ? Z.STICKY + 5 : Z.STICKY }}
                  >
                    <div className="truncate">
                      {col.isSortable ? (
                        <button
                          onClick={() => handleSort(col.accessorKey)}
                          aria-label={`Sort by ${col.header}`}
                          className={`group flex items-center transition-opacity ${sortConfig.key === col.accessorKey ? 'font-semibold' : 'opacity-90 hover:opacity-100'}`}
                        >
                          {col.header}
                          <ArrowUpDown
                            className={`w-4 h-4 ml-1.5 transition-opacity ${sortConfig.key === col.accessorKey ? 'opacity-100' : 'opacity-50 group-hover:opacity-100'}`}
                          />
                        </button>
                      ) : (
                        col.header
                      )}
                    </div>
                    <div
                      onMouseDown={(e) => handleMouseDown(e, String(col.accessorKey))}
                      onDoubleClick={() => autoFitColumn(String(col.accessorKey))}
                      className="absolute top-0 right-0 h-full w-2 cursor-col-resize"
                      style={{ zIndex: Z.STICKY + 10 }}
                      title="Resize column (double-click to auto-fit)"
                    >
                      <div className={`w-0.5 h-full mx-auto transition-colors duration-200
                                ${resizingColumn === String(col.accessorKey)
                          ? 'bg-primary-foreground'
                          : 'bg-transparent group-hover:bg-primary-foreground/60'
                        }`}
                      ></div>
                    </div>
                  </th>
                ))}
                {renderRowActions && (
                  <th
                    scope="col"
                    style={{ zIndex: Z.STICKY + 5 }}
                    className="sticky right-0 top-0 bg-primary border-l border-primary-foreground/15 md:border-b-2 md:border-b-primary-foreground/25 w-[120px] px-4 py-2 text-xs font-bold text-primary-foreground/80 tracking-wide text-center"
                  >
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border md:divide-y-0">
              {paginatedData.length > 0 ? (
                <>
                  {paginatedData.map((item, index) => {
                    const globalIndex = startIndex + index;
                    const isExpanded = expandedRows.has(globalIndex);
                    const isHighlighted = highlightedCheck ? highlightedCheck(item) : false;
                    const rowId = getRowKey(item, globalIndex);
                    return (
                      <tr
                        key={globalIndex}
                        // `is-highlighted` was a CSS class that never existed, and it
                        // replaced the row's background classes rather than adding to
                        // them — so a highlighted row rendered transparent in the
                        // scrolling columns while the frozen columns showed amber.
                        className={`${isHighlighted
                          ? 'bg-amber-500/10'
                          : 'md:even:bg-muted/20 bg-card'
                          } md:hover:bg-accent/50 group transition-colors duration-200 ${onRowClick || isMobile ? 'cursor-pointer' : ''} ${isExpanded ? 'is-expanded' : ''} animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-backwards`}
                        style={{
                          animationDelay: `${Math.min((index % 20) * 15, 150)}ms`
                        }}
                        onClick={() => handleRowClick(item, globalIndex)}
                        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleRowClick(item, globalIndex)}
                        onContextMenu={(e) => handleRowContextMenu(e, item)}
                        tabIndex={onRowClick || isMobile ? 0 : -1}
                        draggable={enableDragToAI}
                        onDragStart={enableDragToAI ? (e) => handleRowDragStart(e, item, rowId) : undefined}
                      >
                        {enableRowSelection && (
                          <td
                            style={{ zIndex: Z.BASE }}
                            className={`sticky left-0 w-[40px] px-3 py-1.5 md:border-b md:border-border transition-colors duration-200 ${isHighlighted ? 'bg-amber-500/10' : 'bg-card'} md:group-hover:bg-accent group-hover:bg-accent ${isScrolled ? 'shadow-[4px_0_12px_-4px_rgba(0,0,0,0.25)]' : ''}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Checkbox
                              checked={selectedKeys.has(rowId)}
                              onCheckedChange={() => toggleRowSelection(rowId)}
                              aria-label="Select row"
                            />
                          </td>
                        )}
                        {columns.map((col, colIndex) => {
                          const isSecondaryOnMobile = isMobile && !mobilePrimaryColumns.includes(col.accessorKey);
                          const isFirstColumn = colIndex === 0;

                          const cellClass = `
                            px-4 sm:px-6 py-1.5 sm:py-2 md:border-b md:[&:not(:last-child)]:border-r md:border-border
                            ${isSecondaryOnMobile ? 'secondary-cell' : ''}
                            ${resizingColumn === String(col.accessorKey) ? 'is-resizing-cell' : ''}
                            ${isFirstColumn && stickyFirstColumn && !enableRowSelection ? 'sticky left-0 z-10 bg-card md:bg-card ' + (isHighlighted ? 'bg-amber-500/10 md:bg-amber-500/10' : 'group-hover:bg-accent md:group-hover:bg-accent md:group-even:bg-muted/20') : ''}
                            ${isFirstColumn && stickyFirstColumn && !enableRowSelection && isScrolled ? 'shadow-[4px_0_12px_-4px_rgba(0,0,0,0.25)] border-r-0' : ''}
                          `;

                          return (
                            <td
                              key={`${String(col.accessorKey)}-${colIndex}`}
                              className={cellClass}
                              data-label={col.header}
                            >
                              {col.editable ? (
                                <EditableCell
                                  row={item}
                                  column={col}
                                  displayClassName={`font-medium ${wrapClass}`}
                                  isEditing={!!cellEdit && cellEdit.rowId === rowId && cellEdit.columnKey === String(col.accessorKey)}
                                  editValue={cellEdit?.value ?? ''}
                                  editStatus={cellEdit?.status}
                                  errorMessage={cellEdit?.errorMessage}
                                  onStartEdit={() => handleStartEdit(item, col, rowId)}
                                  onChangeValue={handleChangeEditValue}
                                  onCommit={handleCommitEdit}
                                  onCancel={handleCancelEdit}
                                />
                              ) : (
                                <div className={`font-medium ${wrapClass}`}>
                                  {col.cell ? col.cell(item[col.accessorKey], item) : String(item[col.accessorKey] ?? '')}
                                </div>
                              )}
                            </td>
                          )
                        })}
                        {renderRowActions && (
                          <td
                            style={{ zIndex: Z.BASE }}
                            className={`
                              sticky right-0 w-[120px] px-2 py-1.5 border-l border-border/60 md:border-b md:border-border transition-colors duration-200
                              ${isHighlighted ? 'bg-amber-500/10' : 'bg-card md:bg-card'}
                              md:group-hover:bg-accent group-hover:bg-accent
                            `}
                          >
                            <div className="flex items-center justify-center">
                              {renderRowActions(item)}
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })}

                </>
              ) : (
                <tr>
                  {/* colSpan must cover the selection and actions columns too,
                      or the empty state renders inside a single narrow cell. */}
                  <td colSpan={columns.length + (enableRowSelection ? 1 : 0) + (renderRowActions ? 1 : 0)}>
                    <EmptyState
                      illustration={<ClipboardList className="w-16 h-16 text-muted-foreground/20" />}
                      title={emptyState?.title}
                      description={emptyState?.description}
                      action={emptyState?.action}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Horizontal-scroll affordance — pinned to the card (not the scroll
          container, so it stays put) and surfaced only when the table is wider
          than its viewport with more content to the right. Cleared by
          handleScroll once the user reaches the end. */}
      {showScrollHint && !isMobile && paginatedData.length > 0 && (
        <div className="scroll-hint-indicator gap-1" aria-hidden="true">
          <span>Scroll</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </div>
      )}

      {!loading && sortedData.length > 0 && (
        <div style={{ zIndex: Z.STICKY }} className="flex-shrink-0 p-4 sm:px-6 sm:py-3 flex flex-col-reverse sm:flex-row justify-between items-center gap-4 border-t border-border bg-card">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <label htmlFor="rows-per-page" className="whitespace-nowrap font-medium text-foreground">Rows per page:</label>
              <select
                id="rows-per-page"
                value={itemsPerPage}
                onChange={handleItemsPerPageChange}
                className="bg-muted border border-border rounded-md p-1.5 text-sm focus:ring-1 focus:ring-ring focus:border-primary text-foreground"
              >
                {[10, 20, 50, 100].map(size => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </div>
            <span className="hidden lg:block font-medium">
              Showing <span className="font-bold">{startIndex + 1}</span>-<span className="font-bold">{endIndex}</span> of <span className="font-bold">{sortedData.length}</span>
            </span>
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 rounded-md border border-emerald-600/20 transition-colors text-xs font-semibold"
              title="Export filtered data as Excel"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Excel</span>
            </button>
          </div>

          <nav className="flex items-center gap-1" aria-label="Table navigation">
            <button onClick={() => handlePageChange(1)} disabled={currentPage === 1} aria-label="First page" className="p-2.5 sm:p-2 rounded-md hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"><ChevronsLeft className="w-5 h-5 text-muted-foreground" /></button>
            <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} aria-label="Previous page" className="p-2.5 sm:p-2 rounded-md hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"><ChevronLeft className="w-5 h-5 text-muted-foreground" /></button>

            {/* Full numeric range — larger screens only */}
            <div className="hidden sm:flex items-center gap-1 px-2">
              {paginationRange.map((page, index) => {
                if (page === DOTS) {
                  return <span key={index} className="px-2 py-1 text-sm text-muted-foreground" aria-hidden="true">...</span>
                }
                const pageNumber = page as number;
                const isActive = pageNumber === currentPage;
                return (
                  <button
                    key={index}
                    onClick={() => handlePageChange(pageNumber)}
                    className={`px-3 py-1 rounded-md text-sm font-semibold transition-colors ${isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}
                    aria-current={isActive ? 'page' : undefined}
                    aria-label={`Page ${pageNumber}`}
                  >
                    {pageNumber}
                  </button>
                )
              })}
            </div>

            {/* Compact indicator — phones (the full range overflows narrow widths) */}
            <span className="sm:hidden px-3 text-sm font-medium text-muted-foreground whitespace-nowrap" aria-current="page">
              Page {currentPage} of {totalPages}
            </span>

            <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} aria-label="Next page" className="p-2.5 sm:p-2 rounded-md hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"><ChevronRight className="w-5 h-5 text-muted-foreground" /></button>
            <button onClick={() => handlePageChange(totalPages)} disabled={currentPage === totalPages} aria-label="Last page" className="p-2.5 sm:p-2 rounded-md hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"><ChevronsRight className="w-5 h-5 text-muted-foreground" /></button>
          </nav>
        </div>
      )}

      {renderRowContextMenu && (
        <RowContextMenu
          open={!!contextMenu}
          x={contextMenu?.x ?? 0}
          y={contextMenu?.y ?? 0}
          onOpenChange={(open) => !open && setContextMenu(null)}
        >
          {contextMenu && renderRowContextMenu(contextMenu.row)}
        </RowContextMenu>
      )}

      {bulkConfirm && (
        <ConfirmationModal
          isOpen={!!bulkConfirm}
          onClose={() => setBulkConfirm(null)}
          onConfirm={handleConfirmModalConfirm}
          title={bulkConfirm.type === 'bulk' ? (activeBulkAction?.label ?? 'Confirm action') : 'Replace All'}
          confirmText={bulkConfirm.type === 'bulk' ? (activeBulkAction?.confirmText || 'Confirm') : 'Replace All'}
          variant={bulkConfirm.type === 'bulk' ? (activeBulkAction?.variant === 'danger' ? 'danger' : 'warning') : 'warning'}
          isLoading={bulkConfirm.type === 'bulk' ? runningBulkIndex !== null : isReplacing}
        >
          {bulkConfirm.type === 'bulk' ? (
            <p>
              This will run <strong>{activeBulkAction?.label}</strong> on <strong>{selectedRows.length}</strong> selected row{selectedRows.length === 1 ? '' : 's'}. This cannot be undone.
            </p>
          ) : (
            <div className="space-y-2">
              <p>
                Replace <strong>{replaceableMatches.length}</strong> match{replaceableMatches.length === 1 ? '' : 'es'} of &quot;{bulkConfirm.findText}&quot; with &quot;{bulkConfirm.replaceText}&quot;:
              </p>
              <ul className="text-xs bg-muted/40 rounded-md p-2 space-y-1 max-h-40 overflow-y-auto">
                {replacePreview.map((p, i) => (
                  <li key={i} className="font-mono">
                    <span className="text-muted-foreground">{p.column}:</span> {p.oldVal || '(empty)'} → {p.newVal || '(empty)'}
                  </li>
                ))}
              </ul>
              {replaceableMatches.length > replacePreview.length && (
                <p className="text-xs text-muted-foreground">...and {replaceableMatches.length - replacePreview.length} more.</p>
              )}
              {findMatches.length > replaceableMatches.length && (
                <p className="text-xs text-amber-500">
                  {findMatches.length - replaceableMatches.length} additional match{findMatches.length - replaceableMatches.length === 1 ? '' : 'es'} found in non-editable columns — these will be skipped.
                </p>
              )}
              <p>This cannot be undone.</p>
            </div>
          )}
        </ConfirmationModal>
      )}
    </div>
  );
}

export default React.memo(DataTable) as typeof DataTable;
