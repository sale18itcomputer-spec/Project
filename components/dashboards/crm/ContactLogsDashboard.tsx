'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { ContactLog } from "../../../types";
import { useData } from "../../../contexts/DataContext";
import { deleteRecord } from "../../../services/api";
import { parseDate, formatDisplayDate } from "../../../utils/time";
import DataTable, { ColumnDef, CellWrapStyle } from "../../common/DataTable";
import { useNavigation } from "../../../contexts/NavigationContext";
import { ExternalLink, MessageSquare, Plus, Pencil, Trash2 } from 'lucide-react';
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
import DashboardHeader from '../../common/DashboardHeader';
import SearchInput from '../../common/SearchInput';
import CellWrapToggle from '../../common/CellWrapToggle';
import StatusFilterBar from '../../common/StatusFilterBar';
import ErrorState from '../../common/ErrorState';
import { IconButton } from '../../ui/icon-button';
import { Button } from '../../ui/button';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';

const KANBAN_COLUMN_IDS = ['Call', 'Message', 'Email'] as const;

interface ContactLogsDashboardProps {
  initialFilter?: string;
}

const CONTACT_LOG_COLUMNS_VISIBILITY_KEY = 'limperial-contact-log-columns-visibility';



const ContactLogsDashboard: React.FC<ContactLogsDashboardProps> = ({ initialFilter }) => {
  const { contactLogs, setContactLogs, loading, error } = useData();
  const { users } = useAuth();
  const [searchQuery, setSearchQuery] = useState(initialFilter || '');
  const debouncedSearch = useDebouncedValue(searchQuery);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [cellWrapStyle, setCellWrapStyle] = useState<CellWrapStyle>('nowrap');
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

    if (debouncedSearch) {
      data = data.filter(log => Object.values(log).some(val => String(val).toLowerCase().includes(debouncedSearch.toLowerCase())));
    }
    // Sort by date descending
    return data.sort((a, b) => (parseDate(b['Contact Date'])?.getTime() ?? 0) - (parseDate(a['Contact Date'])?.getTime() ?? 0));
  }, [contactLogs, debouncedSearch, logTypeFilter, responsibleUserFilter, statusFilter]);

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
          {value} <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
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
    return <ErrorState title="Could not load contact logs" message={error} />;
  }

  return (
    <div className="h-full flex flex-col">
      <DashboardHeader title="Contact Logs" icon={<MessageSquare />}>
        <SearchInput
          id="log-search"
          value={searchQuery}
          onValueChange={setSearchQuery}
          placeholder="Search logs..."
          label="Search contact logs"
          containerClassName="lg:w-56"
        />

        <select
          value={logTypeFilter}
          onChange={e => setLogTypeFilter(e.target.value)}
          aria-label="Filter by log type"
          className="h-9 flex-shrink-0 rounded-md border border-border bg-muted px-2 text-sm text-foreground shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring dark:[color-scheme:dark]"
        >
          {logTypeOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>

        <select
          value={responsibleUserFilter}
          onChange={e => setResponsibleUserFilter(e.target.value)}
          aria-label="Filter by logged-by user"
          className="h-9 flex-shrink-0 rounded-md border border-border bg-muted px-2 text-sm text-foreground shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring dark:[color-scheme:dark]"
        >
          {userOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>

        <CellWrapToggle value={cellWrapStyle} onChange={setCellWrapStyle} />

        <DataTableColumnToggle
          allColumns={allColumns}
          visibleColumns={visibleColumns}
          onColumnToggle={handleColumnToggle}
        />

        <PermissionGate module="contact_logs" action="create">
          <Button onClick={handleOpenNewLog} aria-label="New Log">
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">New Log</span>
          </Button>
        </PermissionGate>
      </DashboardHeader>

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
            emptyState={{
              title: 'No contact logs yet',
              description: 'Calls, messages and emails you log against a contact will appear here.',
            }}
            renderRowActions={(row) => (
              <div className="flex items-center gap-1">
                <IconButton
                  label="Edit log"
                  tone="primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditLog(row);
                  }}
                >
                  <Pencil size={15} aria-hidden="true" />
                </IconButton>
                <PermissionGate module="contact_logs" action="delete">
                  <IconButton
                    label="Delete log"
                    tone="danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteRequest(row);
                    }}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </IconButton>
                </PermissionGate>
              </div>
            )}
            renderRowContextMenu={(row) => (
              <RowActionMenuItems
                onOpenWindow={() => openLogWindow(row['Log ID'] || null)}
                onView={() => handleViewLog(row)}
                onEdit={() => handleEditLog(row)}
                onDelete={can('contact_logs', 'delete') ? () => handleDeleteRequest(row) : undefined}
              />
            )}
          />
        </div>

      <StatusFilterBar
        options={['Call', 'Message', 'Email']}
        active={statusFilter}
        onChange={setStatusFilter}
        summary={`${filteredData.length} logs`}
        label="Filter by log type"
      />

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
