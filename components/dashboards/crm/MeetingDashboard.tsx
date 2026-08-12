'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Meeting } from "../../../types";
import { useData } from "../../../contexts/DataContext";
import { deleteRecord } from "../../../services/api";
import DataTable, { ColumnDef, CellWrapStyle } from "../../common/DataTable";
import { useNavigation } from "../../../contexts/NavigationContext";
import { ExternalLink, Table, CalendarDays, Clock, Users, Pencil, Trash2, Plus } from 'lucide-react';
import { parseDate, formatDateAsMDY } from "../../../utils/time";
import ViewToggle from "../../common/ViewToggle";
import AgendaView, { AgendaItem } from "../views/AgendaView";
import { DataTableColumnToggle } from "../../common/DataTableColumnToggle";
import { localStorageGet, localStorageSet } from '../../../utils/storage';
import { PermissionGate } from '../../common/PermissionGate';
import { usePermissions } from '../../../hooks/usePermissions';
import RowActionMenuItems from '../../common/RowActionMenuItems';
import { useWindowManager } from '../../../contexts/WindowManagerContext';
import { useToast } from '../../../contexts/ToastContext';
import MeetingWindowContent from '../../windows/content/MeetingWindowContent';
import ConfirmationModal from '../../modals/ConfirmationModal';
import DashboardHeader from '../../common/DashboardHeader';
import SearchInput from '../../common/SearchInput';
import CellWrapToggle from '../../common/CellWrapToggle';
import StatusFilterBar from '../../common/StatusFilterBar';
import ErrorState from '../../common/ErrorState';
import { IconButton } from '../../ui/icon-button';
import { Button } from '../../ui/button';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const statusColors: { [key: string]: string } = {
    'Close': 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
    'Open': 'bg-sky-500/15 text-sky-700 dark:text-sky-400',
    'Cancelled': 'bg-rose-500/15 text-rose-700 dark:text-rose-400',
  };

  return (
    <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${statusColors[status] || 'bg-muted text-muted-foreground'}`}>
      {status}
    </span>
  );
};

const TypeBadge: React.FC<{ type: string }> = ({ type }) => {
  const typeColors: { [key: string]: string } = {
    'Online': 'bg-sky-500/15 text-sky-700 dark:text-sky-400',
    'Onsite': 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  };
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-md ${typeColors[type] || 'bg-muted text-muted-foreground'}`}>
      {type}
    </span>
  );
};


interface MeetingDashboardProps {
  initialFilter?: string;
}

type ViewMode = 'table' | 'agenda';

const VIEW_OPTIONS: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
  { id: 'table', label: 'Table', icon: <Table /> },
  { id: 'agenda', label: 'Agenda', icon: <CalendarDays /> },
];

const MEETING_COLUMNS_VISIBILITY_KEY = 'limperial-meeting-columns-visibility';



const MeetingDashboard: React.FC<MeetingDashboardProps> = ({ initialFilter }) => {
  const { meetings: meetingData, setMeetings, loading, error } = useData();
  const [searchQuery, setSearchQuery] = useState(initialFilter || '');
  const debouncedSearch = useDebouncedValue(searchQuery);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [cellWrapStyle, setCellWrapStyle] = useState<CellWrapStyle>('nowrap');
  const { handleNavigation } = useNavigation();
  const { openWindow } = useWindowManager();
  const { addToast } = useToast();
  const { can } = usePermissions();
  const [meetingToDelete, setMeetingToDelete] = useState<Meeting | null>(null);

  const openMeetingWindow = (meetingId: string | null) => {
    const id = `meeting-${meetingId ?? 'new'}`;
    openWindow({
      id,
      title: meetingId ? `Meeting: ${meetingId}` : 'New Meeting',
      content: <MeetingWindowContent windowId={id} meetingId={meetingId} />,
      draggable: true,
      initialWidth: 800,
      initialHeight: 640,
      minWidth: 600,
      minHeight: 480,
    });
  };

  const handleOpenNewMeeting = () => openMeetingWindow(null);
  const handleViewMeeting = (meeting: Meeting) => openMeetingWindow(meeting['Meeting ID'] || null);
  const handleEditMeeting = (meeting: Meeting) => openMeetingWindow(meeting['Meeting ID'] || null);
  const handleDeleteRequest = (meeting: Meeting) => setMeetingToDelete(meeting);
  const handleConfirmDelete = async () => {
    if (!meetingToDelete?.['Meeting ID']) return;
    const id = meetingToDelete['Meeting ID'];
    const originalMeetings = meetingData ? [...meetingData] : [];
    setMeetings(cur => cur ? cur.filter(m => m['Meeting ID'] !== id) : null);
    setMeetingToDelete(null);
    try {
      await deleteRecord('Meeting_Logs', id);
      addToast('Meeting deleted!', 'success');
    } catch (err: any) {
      addToast(`Failed to delete: ${err.message}`, 'error');
      setMeetings(originalMeetings);
    }
  };

  const [statusFilter, setStatusFilter] = useState<string | null>('Open');

  const filteredData = useMemo(() => {
    let filtered = [...(meetingData || [])];

    if (statusFilter) {
      filtered = filtered.filter(item => item.Status === statusFilter);
    }

    if (debouncedSearch) {
      filtered = filtered.filter(item =>
        ['Company Name', 'Participants', 'Responsible By', 'Remarks', 'Pipeline_ID'].some(key =>
          String(item[key as keyof Meeting] ?? '').toLowerCase().includes(debouncedSearch.toLowerCase())
        )
      );
    }

    return filtered;
  }, [meetingData, debouncedSearch, statusFilter]);

  const agendaItems = useMemo<AgendaItem<Meeting>[]>(() => {
    return filteredData.map(meeting => ({
      id: meeting['Meeting ID'] || `meeting-${Math.random()}`,
      date: parseDate(meeting['Meeting Date']),
      title: meeting['Company Name'],
      data: meeting
    }));
  }, [filteredData]);

  const allColumns = useMemo<ColumnDef<Meeting>[]>(() => [
    {
      accessorKey: 'Meeting ID',
      header: 'Meeting ID',
      isSortable: true,
      cell: (value: string) => <div className="text-muted-foreground">{value}</div>,
    },
    {
      accessorKey: 'Company Name',
      header: 'Company Name',
      isSortable: true,
      cell: (value: string) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleNavigation({ view: 'companies', filter: value });
          }}
          className="group font-semibold text-base text-foreground hover:underline text-left transition-colors inline-flex items-center gap-1.5"
          aria-label={`View company: ${value}`}
        >
          {value}
          <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      )
    },
    {
      accessorKey: 'Pipeline_ID',
      header: 'Pipeline ID',
      isSortable: true,
      cell: (value: string) => (
        value ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleNavigation({ view: 'projects', filter: value });
            }}
            className="group text-sm text-muted-foreground hover:underline block inline-flex items-center gap-1.5"
            aria-label={`View project: ${value}`}
          >
            {value}
            <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        ) : null
      )
    },
    {
      accessorKey: 'Meeting Date',
      header: 'Meeting Date',
      isSortable: true,
      cell: (value: string) => {
        const date = parseDate(value);
        return date ? formatDateAsMDY(date) : <span className="text-muted-foreground/50 italic">N/A</span>;
      }
    },
    { accessorKey: 'Participants', header: 'Participants', isSortable: false, cell: (value: string) => <span className="text-foreground truncate block max-w-xs">{value}</span> },
    { accessorKey: 'Type', header: 'Type', isSortable: true, cell: (value: string) => <TypeBadge type={value} /> },
    { accessorKey: 'Responsible By', header: 'Responsible By', isSortable: true, cell: (value: string) => <span className="font-medium text-foreground">{value}</span> },
    { accessorKey: 'Status', header: 'Status', isSortable: true, cell: (value: string) => <StatusBadge status={value} /> },
  ], [handleNavigation]);

  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
    try {
      const saved = localStorageGet(MEETING_COLUMNS_VISIBILITY_KEY);
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
    const saved = localStorageGet(MEETING_COLUMNS_VISIBILITY_KEY);
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
        localStorageSet(MEETING_COLUMNS_VISIBILITY_KEY, JSON.stringify(Array.from(newSet)));
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
    return <ErrorState title="Could not load meetings" message={error} />;
  }

  const renderAgendaCard = (meeting: Meeting) => (
    <>
      <div className="flex justify-between items-start">
        <p className="text-sm text-muted-foreground font-medium line-clamp-1 pr-16">{meeting.Type} Meeting</p>
        <StatusBadge status={meeting.Status} />
      </div>
      <div className="mt-3 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground/50" />
          <span className="font-medium truncate">{meeting.Participants}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground/50" />
          <span>{meeting['Start Time']} - {meeting['End Time']}</span>
        </div>
      </div>
    </>
  );



  return (
    <div className="h-full flex flex-col">
      <DashboardHeader title="Meetings" icon={<CalendarDays />}>
        <SearchInput
          id="meeting-search"
          value={searchQuery}
          onValueChange={setSearchQuery}
          placeholder="Search meetings..."
          label="Search meetings"
        />

        <ViewToggle<ViewMode> views={VIEW_OPTIONS} activeView={viewMode} onViewChange={setViewMode} />

        {viewMode === 'table' && (
          <>
            <CellWrapToggle value={cellWrapStyle} onChange={setCellWrapStyle} />

            <DataTableColumnToggle
              allColumns={allColumns}
              visibleColumns={visibleColumns}
              onColumnToggle={handleColumnToggle}
            />
          </>
        )}

        <PermissionGate module="meetings" action="create">
          <Button onClick={handleOpenNewMeeting} aria-label="New meeting">
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">New</span>
          </Button>
        </PermissionGate>
      </DashboardHeader>

      <div className="flex-1 min-h-0 overflow-hidden p-4">
        {viewMode === 'table' ? (
          <div className="h-full">
            <DataTable
              tableId="meeting-table"
              data={filteredData}
              columns={displayedColumns}
              loading={loading}
              onRowClick={handleViewMeeting}
              initialSort={{ key: 'Meeting Date', direction: 'descending' }}
              mobilePrimaryColumns={['Meeting Date', 'Company Name', 'Status']}
              cellWrapStyle={cellWrapStyle}
              emptyState={{
                title: 'No meetings yet',
                description: 'Meetings you log will appear here.',
              }}
              renderRowActions={(row) => (
                <div className="flex items-center gap-1">
                  <PermissionGate module="meetings" action="edit">
                    <IconButton
                      label="Edit meeting"
                      tone="primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditMeeting(row);
                      }}
                    >
                      <Pencil size={15} aria-hidden="true" />
                    </IconButton>
                  </PermissionGate>
                  <PermissionGate module="meetings" action="delete">
                    <IconButton
                      label="Delete meeting"
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
                  onOpenWindow={() => openMeetingWindow(row['Meeting ID'] || null)}
                  onView={() => handleViewMeeting(row)}
                  onEdit={can('meetings', 'edit') ? () => handleEditMeeting(row) : undefined}
                  onDelete={can('meetings', 'delete') ? () => handleDeleteRequest(row) : undefined}
                />
              )}
            />
          </div>
        ) : (
          <AgendaView<Meeting>
            items={agendaItems}
            onItemClick={handleViewMeeting}
            renderCardContent={renderAgendaCard}
            loading={loading}
          />
        )}
      </div>

      <StatusFilterBar
        options={['Open', 'Close', 'Cancelled']}
        active={statusFilter}
        onChange={setStatusFilter}
        summary={`${filteredData.length} meetings`}
      />

      <ConfirmationModal
        isOpen={!!meetingToDelete}
        onClose={() => setMeetingToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Meeting"
        variant="danger"
      >
        Are you sure you want to delete the meeting with "{meetingToDelete?.['Company Name']}" on {meetingToDelete?.['Meeting Date']}? This cannot be undone.
      </ConfirmationModal>
    </div>
  );
};

export default React.memo(MeetingDashboard);
