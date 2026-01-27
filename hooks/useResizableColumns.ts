import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ColumnDef } from '../components/DataTable';

const TABLE_WIDTHS_STORAGE_KEY = 'limperial-table-widths';

const getSavedWidths = (tableId: string): { [key: string]: number } => {
  try {
    const saved = localStorage.getItem(TABLE_WIDTHS_STORAGE_KEY);
    if (saved) {
      const allWidths = JSON.parse(saved);
      return allWidths[tableId] || {};
    }
  } catch (error) {
    console.error('Failed to parse table widths from localStorage', error);
  }
  return {};
};

const saveWidths = (tableId: string, widths: { [key: string]: number }) => {
  try {
    const saved = localStorage.getItem(TABLE_WIDTHS_STORAGE_KEY);
    const allWidths = saved ? JSON.parse(saved) : {};
    allWidths[tableId] = widths;
    localStorage.setItem(TABLE_WIDTHS_STORAGE_KEY, JSON.stringify(allWidths));
  } catch (error) {
    console.error('Failed to save table widths to localStorage', error);
  }
};

export const useResizableColumns = <T extends object>(tableId: string, columns: ColumnDef<T>[], minWidth = 75) => {
  const [columnWidths, setColumnWidths] = useState<{ [key: string]: number }>(() => getSavedWidths(tableId));
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const tableRef = useRef<HTMLTableElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent, columnKey: string) => {
    e.preventDefault();
    e.stopPropagation();

    // Snapshot current widths of all columns to prevent redistribution
    if (tableRef.current) {
      const currentWidths: { [key: string]: number } = {};
      const thElements = tableRef.current.querySelectorAll('thead th');

      columns.forEach((col, index) => {
        const th = thElements[index] as HTMLElement;
        if (th) {
          currentWidths[String(col.accessorKey)] = th.getBoundingClientRect().width;
        }
      });

      setColumnWidths(prev => ({ ...prev, ...currentWidths }));
    }

    setResizingColumn(columnKey);
    startXRef.current = e.clientX;

    // Get starting width from the specific column header
    const columnIndex = columns.findIndex(c => String(c.accessorKey) === columnKey);
    const th = tableRef.current?.querySelectorAll('thead th')[columnIndex] as HTMLElement;
    startWidthRef.current = th ? th.getBoundingClientRect().width : 0;
  }, [columns]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!resizingColumn) return;
    const deltaX = e.clientX - startXRef.current;
    const newWidth = Math.max(minWidth, startWidthRef.current + deltaX);

    setColumnWidths(prev => ({ ...prev, [resizingColumn]: newWidth }));
  }, [resizingColumn, minWidth]);

  const currentWidthsRef = useRef(columnWidths);
  currentWidthsRef.current = columnWidths;

  const handleMouseUp = useCallback(() => {
    if (resizingColumn) {
      saveWidths(tableId, currentWidthsRef.current);
    }
    setResizingColumn(null);
  }, [tableId, resizingColumn]);

  const autoFitColumn = useCallback((columnKey: string) => {
    if (!tableRef.current) return;

    const columnIndex = columns.findIndex(c => String(c.accessorKey) === columnKey);
    if (columnIndex === -1) return;

    let maxWidth = 0;
    const rows = Array.from(tableRef.current.querySelectorAll('tr'));

    rows.forEach(row => {
      // FIX: The 'row' element from querySelectorAll is of a generic 'Element' type.
      // It must be cast to 'HTMLTableRowElement' to safely access the 'cells' property.
      const cell = (row as HTMLTableRowElement).cells[columnIndex] as HTMLElement | undefined;
      if (cell) {
        // The content is wrapped in a div. 'truncate' class sets white-space: nowrap, so scrollWidth is reliable.
        const content = cell.querySelector('div');
        if (content) {
          const styles = window.getComputedStyle(cell);
          const padding = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
          maxWidth = Math.max(maxWidth, content.scrollWidth + padding);
        } else {
          // Fallback for cells without a div wrapper
          maxWidth = Math.max(maxWidth, cell.scrollWidth);
        }
      }
    });

    // Add extra padding for breathing room and apply bounds
    const finalWidth = Math.max(minWidth, Math.min(maxWidth + 24, 600));

    setColumnWidths(prev => {
      const newWidths = { ...prev, [columnKey]: finalWidth };
      saveWidths(tableId, newWidths);
      return newWidths;
    });
  }, [columns, tableId, minWidth]);

  useEffect(() => {
    if (resizingColumn) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [resizingColumn, handleMouseMove, handleMouseUp]);

  return { columnWidths, handleMouseDown, tableRef, resizingColumn, autoFitColumn };
};