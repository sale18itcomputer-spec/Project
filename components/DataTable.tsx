import React, { useState, useMemo, useEffect } from 'react';
import { ArrowUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ClipboardList } from 'lucide-react';
import EmptyState from './EmptyState';
import { parseDate } from '../utils/time';
import { parseSheetValue } from '../utils/formatters';
import { useResizableColumns } from '../hooks/useResizableColumns';
import { useWindowSize } from '../hooks/useWindowSize';

export interface ColumnDef<T> {
  accessorKey: keyof T;
  header: string;
  cell?: (value: T[keyof T], row: T) => React.ReactNode;
  isSortable?: boolean;
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
  cellWrapStyle?: 'overflow' | 'wrap' | 'clip';
  renderRowActions?: (row: T) => React.ReactNode;
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
      <div key={i} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm animate-pulse">
        <div className="space-y-4 pt-2">
          {[...Array(Math.min(columns, 3))].map((_, j) => (
            <div key={j} className="flex justify-between items-center">
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              <div className="h-5 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
);

const DesktopTableSkeleton: React.FC<{ columns: number, rows: number }> = ({ columns, rows }) => (
  <table className="w-full">
    <thead className="bg-brand-600">
      <tr>
        {[...Array(columns)].map((_, i) => (
          <th key={i} className="px-6 py-3 text-left text-xs font-medium text-white/80 uppercase tracking-wider">
            <div className="h-4 bg-white/20 rounded w-3/4 animate-pulse"></div>
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {[...Array(rows)].map((_, i) => (
        <tr key={i} className="border-b border-slate-100">
          {[...Array(columns)].map((_, j) => (
            <td key={j} className="px-6 py-4">
              <div className={`h-5 bg-gray-200 rounded animate-pulse ${j === 0 ? 'w-4/5' : 'w-3/5'}`}></div>
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
);

const TableSkeleton: React.FC<{ columns: number, rows: number }> = ({ columns, rows }) => (
  <>
    <div className="hidden md:block"><DesktopTableSkeleton columns={columns} rows={rows} /></div>
    <div className="md:hidden"><MobileTableSkeleton columns={columns} /></div>
  </>
);


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
  renderRowActions,
}: DataTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100);
  const [sortConfig, setSortConfig] = useState<{ key: keyof T | null; direction: 'ascending' | 'descending' }>(initialSort || { key: null, direction: 'ascending' });
  const { columnWidths, handleMouseDown, tableRef, resizingColumn, autoFitColumn } = useResizableColumns(tableId, columns);
  const [expandedRows, setExpandedRows] = useState(new Set<number>());
  const { width } = useWindowSize();
  const isMobile = width < 768; // Tailwind's `md` breakpoint

  const wrapClass = useMemo(() => {
    switch (cellWrapStyle) {
      case 'wrap':
        return 'whitespace-normal break-words';
      case 'clip':
        return 'overflow-clip';
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
      toggleRowExpansion(index);
    } else if (onRowClick) {
      onRowClick(item);
    }
  };


  useEffect(() => {
    setCurrentPage(1);
  }, [data.length, itemsPerPage]);

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

  const emptyRowsToRender = itemsPerPage - paginatedData.length;

  return (
    <>
      <div className="responsive-table">
        {loading ? (
          <TableSkeleton columns={columns.length + (renderRowActions ? 1 : 0)} rows={itemsPerPage} />
        ) : (
          <table ref={tableRef} className="w-full text-sm text-left text-gray-500 min-w-[640px] table-fixed md:border-l md:border-t md:border-slate-200" aria-busy={loading}>
            <colgroup>
              {columns.map(col => (
                <col
                  key={String(col.accessorKey)}
                  data-col-key={String(col.accessorKey)}
                  style={{ width: columnWidths[String(col.accessorKey)] ? `${columnWidths[String(col.accessorKey)]}px` : undefined }}
                />
              ))}
              {renderRowActions && (
                <col style={{ width: '120px' }} />
              )}
            </colgroup>
            <thead className="bg-brand-600 sticky top-0 z-10">
              <tr>
                {columns.map(col => (
                  <th
                    key={String(col.accessorKey)}
                    scope="col"
                    className={`pl-6 pr-4 py-3 text-left text-sm font-semibold text-white uppercase tracking-wider whitespace-nowrap relative group md:border-b-2 md:border-brand-500 md:[&:not(:last-child)]:border-r md:[&:not(:last-child)]:border-brand-700/50 transition-colors ${resizingColumn === String(col.accessorKey) ? 'bg-brand-700' : ''}`}
                    aria-sort={sortConfig.key === col.accessorKey ? sortConfig.direction : 'none'}
                  >
                    <div className="truncate">
                      {col.isSortable ? (
                        <button onClick={() => handleSort(col.accessorKey)} className={`group flex items-center transition-colors ${sortConfig.key === col.accessorKey ? 'text-white font-semibold' : 'hover:text-white'}`}>
                          {col.header}
                          <ArrowUpDown
                            className={`w-4 h-4 ml-1.5 transition-colors ${sortConfig.key === col.accessorKey ? 'text-white' : 'text-white/50 group-hover:text-white'}`}
                          />
                        </button>
                      ) : (
                        col.header
                      )}
                    </div>
                    <div
                      onMouseDown={(e) => handleMouseDown(e, String(col.accessorKey))}
                      onDoubleClick={() => autoFitColumn(String(col.accessorKey))}
                      className="absolute top-0 right-0 h-full w-2 cursor-col-resize z-20"
                      title="Resize column (double-click to auto-fit)"
                    >
                      <div className={`w-0.5 h-full mx-auto transition-colors duration-200 
                                ${resizingColumn === String(col.accessorKey)
                          ? 'bg-brand-300'
                          : 'bg-transparent group-hover:bg-brand-400'
                        }`}
                      ></div>
                    </div>
                  </th>
                ))}
                {renderRowActions && (
                  <th scope="col" className="sticky right-0 top-0 z-20 bg-brand-600 border-none w-[120px]"></th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 md:divide-y-0">
              {paginatedData.length > 0 ? (
                <>
                  {paginatedData.map((item, index) => {
                    const globalIndex = startIndex + index;
                    const isExpanded = expandedRows.has(globalIndex);
                    const isHighlighted = highlightedCheck ? highlightedCheck(item) : false;
                    return (
                      <tr
                        key={globalIndex}
                        className={`${isHighlighted
                          ? 'is-highlighted'
                          : 'md:even:bg-slate-50 bg-white'
                          } md:hover:bg-sky-50 group transition-colors duration-200 ${onRowClick || isMobile ? 'cursor-pointer' : ''} ${isExpanded ? 'is-expanded' : ''}`}
                        onClick={() => handleRowClick(item, globalIndex)}
                        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleRowClick(item, globalIndex)}
                        tabIndex={onRowClick || isMobile ? 0 : -1}
                      >
                        {columns.map((col) => {
                          const isSecondaryOnMobile = isMobile && !mobilePrimaryColumns.includes(col.accessorKey);
                          const cellClass = `
                            px-6 py-4 md:border-b md:[&:not(:last-child)]:border-r md:border-slate-200 
                            ${isSecondaryOnMobile ? 'secondary-cell' : ''}
                            ${resizingColumn === String(col.accessorKey) ? 'is-resizing-cell' : ''}
                          `;
                          return (
                            <td
                              key={String(col.accessorKey)}
                              className={cellClass}
                              data-label={col.header}
                            >
                              <div className={`font-medium ${wrapClass}`}>
                                {col.cell ? col.cell(item[col.accessorKey], item) : String(item[col.accessorKey] ?? '')}
                              </div>
                            </td>
                          )
                        })}
                        {renderRowActions && (
                          <td
                            className={`
                              sticky right-0 z-10 w-[120px] px-2 py-4 border-none transition-colors duration-200
                              ${isHighlighted ? 'bg-amber-50' : 'bg-slate-50 md:bg-slate-50'}
                              md:group-hover:bg-slate-100 group-hover:bg-slate-100
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
                  {emptyRowsToRender > 0 && Array.from({ length: emptyRowsToRender }).map((_, index) => (
                    <tr key={`empty-${index}`} className="hidden md:table-row">
                      {columns.map(col => (
                        <td key={`empty-${index}-${String(col.accessorKey)}`} className="px-6 py-4 md:border-b md:[&:not(:last-child)]:border-r md:border-slate-200">
                          &nbsp;
                        </td>
                      ))}
                      {renderRowActions && (
                        <td className="sticky right-0 z-10 w-[120px] px-2 py-4 border-none bg-slate-50 md:bg-slate-50">
                          &nbsp;
                        </td>
                      )}
                    </tr>
                  ))}
                </>
              ) : (
                <tr>
                  <td colSpan={columns.length}>
                    <EmptyState illustration={<ClipboardList className="w-16 h-16 text-slate-300" />} />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {!loading && sortedData.length > 0 && (
        <div className="p-4 sm:px-6 sm:py-3 flex flex-col-reverse sm:flex-row justify-between items-center gap-4 border-t border-slate-200/70">
          <div className="flex items-center gap-4 text-sm text-gray-700">
            <div className="flex items-center gap-2">
              <label htmlFor="rows-per-page" className="whitespace-nowrap font-medium">Rows per page:</label>
              <select
                id="rows-per-page"
                value={itemsPerPage}
                onChange={handleItemsPerPageChange}
                className="bg-slate-50 border border-slate-200 rounded-md p-1.5 text-sm focus:ring-1 focus:ring-brand-500 focus:border-brand-500"
              >
                {[10, 20, 50, 100].map(size => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </div>
            <span className="hidden lg:block font-medium">
              Showing <span className="font-bold">{startIndex + 1}</span>-<span className="font-bold">{endIndex}</span> of <span className="font-bold">{sortedData.length}</span>
            </span>
          </div>

          <nav className="flex items-center gap-1" aria-label="Table navigation">
            <button onClick={() => handlePageChange(1)} disabled={currentPage === 1} aria-label="First page" className="p-2 rounded-md hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"><ChevronsLeft className="w-5 h-5 text-slate-600" /></button>
            <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} aria-label="Previous page" className="p-2 rounded-md hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"><ChevronLeft className="w-5 h-5 text-slate-600" /></button>

            <div className="flex items-center gap-1 px-2">
              {paginationRange.map((page, index) => {
                if (page === DOTS) {
                  return <span key={index} className="px-2 py-1 text-sm text-slate-500" aria-hidden="true">...</span>
                }
                const pageNumber = page as number;
                const isActive = pageNumber === currentPage;
                return (
                  <button
                    key={index}
                    onClick={() => handlePageChange(pageNumber)}
                    className={`px-3 py-1 rounded-md text-sm font-semibold transition-colors ${isActive ? 'bg-brand-100 text-brand-700' : 'hover:bg-slate-100 text-slate-600'}`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {pageNumber}
                  </button>
                )
              })}
            </div>

            <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} aria-label="Next page" className="p-2 rounded-md hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"><ChevronRight className="w-5 h-5 text-slate-600" /></button>
            <button onClick={() => handlePageChange(totalPages)} disabled={currentPage === totalPages} aria-label="Last page" className="p-2 rounded-md hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"><ChevronsRight className="w-5 h-5 text-slate-600" /></button>
          </nav>
        </div>
      )}
    </>
  );
}

export default React.memo(DataTable) as typeof DataTable;