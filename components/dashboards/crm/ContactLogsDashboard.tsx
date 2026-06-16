'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { ContactLog } from "../../../types";
import { useData } from "../../../contexts/DataContext";
import { deleteRecord } from "../../../services/api";
import { parseDate, formatDisplayDate } from "../../../utils/time";
import DataTable, { ColumnDef } from "../../common/DataTable";
import { useNavigation } from "../../../contexts/NavigationContext";
import { ExternalLink, ArrowRightToLine, WrapText, Scissors, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from "../../../contexts/AuthContext";
import { DataTableColumnToggle } from "../../common/DataTableColumnToggle";
import { localStorageGet, localStorageSet } from '../../../utils/storage';
import { PermissionGate } from '../../common/PermissionGate';
import { usePermissions } from '../../../hooks/usePermissions';
import RowActionMenuItems from '../../common/RowActionMenuItems';
import { useWindowManager } from '../../../contexts/WindowManagerContext';
import { useToast } from '../../../contexts/ToastContext';
import ContactLogWindowContent from '../../windows/content/ContactLogWindowContent';
import ConfirmationModal from '../../modals/ConfirmationModal';

const KANBAN_COLUMN_IDS = ['Call', 'Message', 'Email'] as const;

interface ContactLogsDashboardProps {
  initialFilter?: string;
}

const CONTACT_LOG_COLUMNS_VISIBILITY_KEY = 'limperial-contact-log-columns-visibility';



const ContactLogsDashboard: React.FC<ContactLogsDashboardProps> = ({ initialFilter }) => {
  const { contactLogs, setContactLogs, loading, error } = useData();
  const { users } = useAuth();
  const [searchQuery, setSearchQuery] = useState(initialFilter || '');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [cellWrapStyle, setCellWrapStyle] = useState<'overflow' | 'wrap' | 'clip'>('nowrap' as any);
  const [logTypeFilter, setLogTypeFilter] = useState('All Types');
  const [responsibleUserFilter, setResponsibleUserFilter] = useState('All Users');
  const { handleNavigation } = useNavigation();
  const { openWindow } = useWindowManager();
  const { addToast } = useToast();
  const { can } = usePermissions();
  const [logToDelete, setLogToDelete] = useState<ContactLog | null>(null);

  const openLogWindow = (logId: string | null) => {
    const id = `contact-log-${logId ?? 'new'}`;
    openWindow({
      id,
      title: logId ? `Log: ${logId}` : 'New Contact Log',
      content: <ContactLogWindowContent windowId={id} logId={logId} />,
      draggable: true,
      initialWidth: 800,
      initialHeight: 640,
      minWidth: 600,
      minHeight: 480,
    });
  };

  const handleOpenNewLog = () => openLogWindow(null);
  const handleViewLog = (log: ContactLog) => openLogWindow(log['Log ID'] || null);
  const handleEditLog = (log: ContactLog) => openLogWindow(log['Log ID'] || null);
  const handleDeleteRequest = (log: ContactLog) => setLogToDelete(log);
  const handleConfirmDelete = async () => {
    if (!logToDelete?.['Log ID']) return;
    const id = logToDelete['Log ID'];
    const originalLogs = contactLogs ? [...contactLogs] : [];
    setContactLogs(cur => cur ? cur.filter(l => l['Log ID'] !== id) : null);
    setLogToDelete(null);
    try {
      await deleteRecord('Contact_Logs', id);
      addToast('Contact log deleted!', 'success');
    } catch (err: any) {
      addToast(`Failed to delete: ${err.message}`, 'error');
      setContactLogs(originalLogs);
    }
  };
  const logTypeOptions = useMemo(() => ['All Types', ...KANBAN_COLUMN_IDS], []);
  const userOptions = useMemo(() => {
    if (!users) return ['All Users'];
    const userNames = new Set(users.map(u => u.Name).filter(Boolean));
    return ['All Users', ...Array.from(userNames).sort()];
  }, [users]);

  const filteredData = useMemo(() => {
    let data = contactLogs || [];

    if (statusFilter) {
      data = data.filter(log => log.Type === statusFilter);
    }

    if (logTypeFilter !== 'All Types') {
      data = data.filter(log => log.Type === logTypeFilter);
    }
    if (responsibleUserFilter !== 'All Users') {
      data = data.filter(log => log['Responsible By'] === responsibleUserFilter);
    }

    if (searchQuery) {
      data = data.filter(log => Object.values(log).some(val => String(val).toLowerCase().includes(searchQuery.toLowerCase())));
    }
    // Sort by date descending
    return data.sort((a, b) => (parseDate(b['Contact Date'])?.getTime() ?? 0) - (parseDate(a['Contact Date'])?.getTime() ?? 0));
  }, [contactLogs, searchQuery, logTypeFilter, responsibleUserFilter, statusFilter]);

  const allColumns = useMemo<ColumnDef<ContactLog>[]>(() => [
    {
      accessorKey: 'Log ID',
      header: 'Log ID',
      isSortable: true,
      cell: (value: string) => <div className="text-muted-foreground">{value}</div>,
    },
    {
      accessorKey: 'Contact Date',
      header: 'Date',
      isSortable: true,
      cell: (value: string) => formatDisplayDate(value),
    },
    {
      accessorKey: 'Company Name',
      header: 'Company',
      cell: (value: string) => (
        <button
          onClick={(e) => { e.stopPropagation(); handleNavigation({ view: 'companies', filter: value }); }}
          className="group font-semibold text-foreground hover:underline text-left transition-colors inline-flex items-center gap-1.5"
        >
          {value} <ExternalLink className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      ),
    },
    {
      accessorKey: 'Contact Name',
      header: 'Contact',
      cell: (value: string) => (
        <button
          onClick={(e) => { e.stopPropagation(); handleNavigation({ view: 'contacts', filter: value }); }}
          className="group font-medium text-foreground hover:underline text-left transition-colors"
        >
          {value}
        </button>
      ),
    },
    { accessorKey: 'Position', header: 'Position', isSortable: true },
    { accessorKey: 'Phone Number', header: 'Phone Number', isSortable: true },
    { accessorKey: 'Type', header: 'Type', isSortable: true },
    { accessorKey: 'Responsible By', header: 'Logged By', isSortable: true },
    {
      accessorKey: 'Remarks',
      header: 'Remarks',
      cell: (value: string) => <p className="text-sm text-muted-foreground line-clamp-1 max-w-[200px] sm:max-w-sm md:max-w-md">{value}</p>,
    },
  ], [handleNavigation]);

  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
    try {
      const saved = localStorageGet(CONTACT_LOG_COLUMNS_VISIBILITY_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) {
          return new Set(parsed);
        }
      }
    } catch (e) {
      console.error("Failed to load visible columns from storage", e);
    }
    return new Set(allColumns.map(c => c.accessorKey as string).filter(Boolean));
  });

  useEffect(() => {
    const saved = localStorageGet(CONTACT_LOG_COLUMNS_VISIBILITY_KEY);
    if (!saved && allColumns.length > 0) {
      setVisibleColumns(new Set(allColumns.map(c => c.accessorKey as string).filter(Boolean)));
    }
  }, [allColumns]);

  const handleColumnToggle = (columnKey: string) => {
    setVisibleColumns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(columnKey)) {
        if (newSet.size > 1) { // Prevent hiding the last column
          newSet.delete(columnKey);
        }
      } else {
        newSet.add(columnKey);
      }
      try {
        localStorageSet(CONTACT_LOG_COLUMNS_VISIBILITY_KEY, JSON.stringify(Array.from(newSet)));
      } catch (e) {
        console.error("Failed to save visible columns to storage", e);
      }
      return newSet;
    });
  };

  const displayedColumns = useMemo(() => {
    return allColumns.filter(c => c.accessorKey && visibleColumns.has(c.accessorKey as string));
  }, [allColumns, visibleColumns]);


  if (error) {
    return (
      <div className="p-6 md:p-8">
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg" role="alert">
          <p className="font-bold">Error</p>
          <p>Could not load contact logs: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 lg:p-6 flex flex-col gap-4 bg-card border-b border-border flex-shrink-0">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <p className="text-base text-muted-foreground">
            <span className="font-bold text-foreground">{filteredData.length}</span> logs
          </p>

          <div className="flex flex-col lg:flex-row gap-3 w-full lg:w-auto items-start lg:items-center">
            <div className="flex flex-col md:flex-row gap-3 w-full lg:w-auto">
              <div className="relative w-full lg:w-56 flex-shrink-0">
                <label htmlFor="log-search" className="sr-only">Search</label>
                <input
                  id="log-search"
                  type="text"
                  placeholder="Search logs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-muted border-transparent text-foreground placeholder:text-muted-foreground text-sm rounded-lg focus:ring-2 focus:ring-brand-500/50 focus:bg-background focus:border-brand-500 block w-full pl-10 p-2.5 transition"
                />
                <svg className="w-5 h-5 text-gray-400 absolute top-1/2 left-3 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              </div>

              <select value={logTypeFilter} onChange={e => setLogTypeFilter(e.target.value)} className="bg-muted border-transparent text-foreground text-sm rounded-lg focus:ring-2 focus:ring-brand-500/50 focus:bg-background focus:border-brand-500 block p-2.5 transition w-full md:w-auto dark:[color-scheme:dark]">
                {logTypeOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>

              <select value={responsibleUserFilter} onChange={e => setResponsibleUserFilter(e.target.value)} className="bg-muted border-transparent text-foreground text-sm rounded-lg focus:ring-2 focus:ring-brand-500/50 focus:bg-background focus:border-brand-500 block p-2.5 transition w-full md:w-auto dark:[color-scheme:dark]">
                {userOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-2 w-full lg:w-auto overflow-x-auto no-scrollbar pb-1 lg:pb-0">
                  <div className="bg-muted p-1 rounded-lg flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => setCellWrapStyle('overflow')} title="Overflow" className={`flex items-center justify-center p-1.5 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:ring-offset-1 ${cellWrapStyle === 'overflow' ? 'bg-background shadow-sm text-brand-700' : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'}`} aria-pressed={cellWrapStyle === 'overflow'} >
                      <ArrowRightToLine className="w-4 h-4" />
                    </button>
                    <button onClick={() => setCellWrapStyle('wrap')} title="Wrap" className={`flex items-center justify-center p-1.5 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:ring-offset-1 ${cellWrapStyle === 'wrap' ? 'bg-background shadow-sm text-brand-700' : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'}`} aria-pressed={cellWrapStyle === 'wrap'} >
                      <WrapText className="w-4 h-4" />
                    </button>
                    <button onClick={() => setCellWrapStyle('clip')} title="Clip" className={`flex items-center justify-center p-1.5 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:ring-offset-1 ${cellWrapStyle === 'clip' ? 'bg-background shadow-sm text-brand-700' : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'}`} aria-pressed={cellWrapStyle === 'clip'} >
                      <Scissors className="w-4 h-4" />
                    </button>
                  </div>
                  <DataTableColumnToggle
                    allColumns={allColumns}
                    visibleColumns={visibleColumns}
                    onColumnToggle={handleColumnToggle}
                  />
              <PermissionGate module="contact_logs" action="create">
                <button
                  onClick={handleOpenNewLog}
                  className="flex-shrink-0 flex items-center justify-center bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2.5 px-4 rounded-lg transition duration-200 shadow-sm hover:shadow-md transform hover:-translate-y-px ml-auto lg:ml-0"
                >
                  <svg className="w-5 h-5 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                  <span className="hidden sm:inline">New Log</span>
                </button>
              </PermissionGate>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden bg-muted/30 p-4">
          <DataTable
            tableId="contact-logs-table"
            data={filteredData}
            columns={displayedColumns}
            loading={loading}
            onRowClick={handleViewLog}
            initialSort={{ key: 'Contact Date', direction: 'descending' }}
            mobilePrimaryColumns={['Contact Date', 'Company Name', 'Type']}
            cellWrapStyle={cellWrapStyle}
            renderRowActions={(row) => (
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditLog(row);
                  }}
                  className="p-2 text-muted-foreground hover:text-brand-500 transition hover:bg-brand-500/10 rounded-full"
                  title="Edit"
                >
                  <Pencil size={15} />
                </button>
                <PermissionGate module="contact_logs" action="delete">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteRequest(row);
                    }}
                    className="p-2 text-muted-foreground hover:text-rose-500 transition hover:bg-rose-500/10 rounded-full"
                    title="Delete"
                  >
                    <Trash2 size={15} />
                  </button>
                </PermissionGate>
              </div>
            )}
            renderRowContextMenu={(row) => (
              <RowActionMenuItems
                onView={() => handleViewLog(row)}
                onEdit={() => handleEditLog(row)}
                onDelete={can('contact_logs', 'delete') ? () => handleDeleteRequest(row) : undefined}
              />
            )}
          />
        </div>

      <footer className="flex-shrink-0 bg-card border-t border-border p-3 flex items-center gap-3">
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setStatusFilter(statusFilter === 'Call' ? null : 'Call')}
            className={`whitespace-nowrap px-6 py-2 rounded-md border text-sm font-semibold transition ${statusFilter === 'Call' ? 'bg-brand-600 text-white border-brand-600 shadow-sm' : 'border-border bg-background text-muted-foreground hover:bg-muted'}`}
          >
            Call
          </button>
          <button
            onClick={() => setStatusFilter(statusFilter === 'Message' ? null : 'Message')}
            className={`whitespace-nowrap px-6 py-2 rounded-md border text-sm font-semibold transition ${statusFilter === 'Message' ? 'bg-brand-600 text-white border-brand-600 shadow-sm' : 'border-border bg-background text-muted-foreground hover:bg-muted'}`}
          >
            Message
          </button>
          <button
            onClick={() => setStatusFilter(statusFilter === 'Email' ? null : 'Email')}
            className={`whitespace-nowrap px-6 py-2 rounded-md border text-sm font-semibold transition ${statusFilter === 'Email' ? 'bg-brand-600 text-white border-brand-600 shadow-sm' : 'border-border bg-background text-muted-foreground hover:bg-muted'}`}
          >
            Email
          </button>
        </div>
      </footer>

      <ConfirmationModal
        isOpen={!!logToDelete}
        onClose={() => setLogToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Contact Log"
        variant="danger"
      >
        Are you sure you want to delete this contact log with "{logToDelete?.['Company Name']}"? This cannot be undone.
      </ConfirmationModal>
    </div >
  );
};

export default React.memo(ContactLogsDashboard);
