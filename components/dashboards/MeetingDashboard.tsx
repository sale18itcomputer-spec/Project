import React, { useState, useMemo, useEffect } from 'react';
import { Meeting } from "../../types";
import { useData } from "../../contexts/DataContext";
import DataTable, { ColumnDef } from "../common/DataTable";
import { useNavigation } from "../../contexts/NavigationContext";
import { ExternalLink, Table, CalendarDays, Clock, Users, Search, ArrowRightToLine, WrapText, Scissors, Pencil } from 'lucide-react';
import { parseDate, formatDateAsMDY } from "../../utils/time";
import NewMeetingModal from "../modals/NewMeetingModal";
import ViewToggle from "../common/ViewToggle";
import AgendaView, { AgendaItem } from "../views/AgendaView";
import { DataTableColumnToggle } from "../common/DataTableColumnToggle";
import { useWindowSize } from "../../hooks/useWindowSize";
import { ScrollArea } from "../ui/scroll-area";
import Spinner from "../common/Spinner";
import EmptyState from "../common/EmptyState";

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const statusColors: { [key: string]: string } = {
    'Close': 'bg-emerald-100 text-slate-800',
    'Open': 'bg-sky-100 text-slate-800',
    'Cancelled': 'bg-rose-100 text-slate-800',
  };

  return (
    <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${statusColors[status] || 'bg-slate-100 text-slate-800'}`}>
      {status}
    </span>
  );
};

const TypeBadge: React.FC<{ type: string }> = ({ type }) => {
  const typeColors: { [key: string]: string } = {
    'Online': 'bg-sky-100 text-slate-800',
    'Onsite': 'bg-emerald-100 text-slate-800',
  };
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-md ${typeColors[type] || 'bg-slate-100 text-slate-800'}`}>
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

const MeetingMobileCard: React.FC<{ meeting: Meeting, onView: () => void }> = ({ meeting, onView }) => {
  let statusClass = 'mobile-status-default';
  if (meeting.Status === 'Open') statusClass = 'mobile-status-info';
  if (meeting.Status === 'Close') statusClass = 'mobile-status-success';
  if (meeting.Status === 'Cancelled') statusClass = 'mobile-status-danger';

  return (
    <div className="mobile-card" onClick={onView} role="button" tabIndex={0}>
      <div className="mobile-card-header">
        <div>
          <div className="mobile-card-title">{meeting['Company Name']}</div>
          <div className="mobile-card-subtitle">{meeting.Type} Meeting</div>
        </div>
        <span className={`mobile-status ${statusClass}`}>
          <span className="mobile-status-dot"></span>
          {meeting.Status}
        </span>
      </div>
      <div className="mobile-card-body">
        <div className="mobile-card-row">
          <span className="mobile-card-label">Date</span>
          <span className="mobile-card-value">{formatDateAsMDY(parseDate(meeting['Meeting Date'])!)}</span>
        </div>
        <div className="mobile-card-row">
          <span className="mobile-card-label">Participants</span>
          <span className="mobile-card-value">{meeting.Participants}</span>
        </div>
        <div className="mobile-card-row">
          <span className="mobile-card-label">Time</span>
          <span className="mobile-card-value">{meeting['Start Time']} - {meeting['End Time']}</span>
        </div>
      </div>
    </div>
  );
};


const MeetingDashboard: React.FC<MeetingDashboardProps> = ({ initialFilter }) => {
  const { meetings: meetingData, loading, error } = useData();
  const [modalConfig, setModalConfig] = useState<{ meeting: Meeting | null, isReadOnly: boolean, isOpen: boolean }>({ meeting: null, isReadOnly: false, isOpen: false });
  const [searchQuery, setSearchQuery] = useState(initialFilter || '');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [cellWrapStyle, setCellWrapStyle] = useState<'overflow' | 'wrap' | 'clip'>('wrap');
  const { handleNavigation } = useNavigation();
  const { width } = useWindowSize();
  const isMobile = width < 1024;

  useEffect(() => {
    if (initialFilter) {
      setSearchQuery(initialFilter);
      // Auto-open meeting if direct ID match
      const match = meetingData?.find(m => m['Meeting ID'] === initialFilter);
      if (match) {
        handleViewMeeting(match);
      }
    }
  }, [initialFilter, meetingData]);

  const handleCloseModal = () => setModalConfig(prev => ({ ...prev, isOpen: false }));
  const handleOpenNewMeeting = () => setModalConfig({ meeting: null, isReadOnly: false, isOpen: true });
  const handleViewMeeting = (meeting: Meeting) => setModalConfig({ meeting, isReadOnly: true, isOpen: true });

  const [statusFilter, setStatusFilter] = useState<string | null>('Open');

  const filteredData = useMemo(() => {
    let filtered = [...(meetingData || [])];

    if (statusFilter) {
      filtered = filtered.filter(item => item.Status === statusFilter);
    }

    if (searchQuery) {
      filtered = filtered.filter(item =>
        ['Company Name', 'Participants', 'Responsible By', 'Remarks', 'Pipeline_ID'].some(key =>
          String(item[key as keyof Meeting] ?? '').toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    }

    return filtered;
  }, [meetingData, searchQuery, statusFilter]);

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
      cell: (value: string) => <div className="text-slate-600">{value}</div>,
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
          className="group font-semibold text-base text-slate-800 hover:underline text-left transition-colors inline-flex items-center gap-1.5"
          aria-label={`View company: ${value}`}
        >
          {value}
          <ExternalLink className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
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
            className="group text-sm text-slate-600 hover:underline block inline-flex items-center gap-1.5"
            aria-label={`View project: ${value}`}
          >
            {value}
            <ExternalLink className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
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
        return date ? formatDateAsMDY(date) : <span className="text-slate-400 italic">N/A</span>;
      }
    },
    { accessorKey: 'Participants', header: 'Participants', isSortable: false, cell: (value: string) => <span className="text-slate-800 truncate block max-w-xs">{value}</span> },
    { accessorKey: 'Type', header: 'Type', isSortable: true, cell: (value: string) => <TypeBadge type={value} /> },
    { accessorKey: 'Responsible By', header: 'Responsible By', isSortable: true, cell: (value: string) => <span className="font-medium text-slate-800">{value}</span> },
    { accessorKey: 'Status', header: 'Status', isSortable: true, cell: (value: string) => <StatusBadge status={value} /> },
  ], [handleNavigation]);

  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(MEETING_COLUMNS_VISIBILITY_KEY);
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
    const saved = localStorage.getItem(MEETING_COLUMNS_VISIBILITY_KEY);
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
        localStorage.setItem(MEETING_COLUMNS_VISIBILITY_KEY, JSON.stringify(Array.from(newSet)));
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
          <p>Could not load meetings: {error}</p>
        </div>
      </div>
    );
  }

  const renderAgendaCard = (meeting: Meeting) => (
    <>
      <div className="flex justify-between items-start">
        <p className="text-sm text-slate-500 font-medium line-clamp-1 pr-16">{meeting.Type} Meeting</p>
        <StatusBadge status={meeting.Status} />
      </div>
      <div className="mt-3 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-x-4 gap-y-2 text-sm text-slate-600">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-slate-400" />
          <span className="font-medium truncate">{meeting.Participants}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-400" />
          <span>{meeting['Start Time']} - {meeting['End Time']}</span>
        </div>
      </div>
    </>
  );



  return (
    <div className="h-full flex flex-col">
      <div className="p-4 lg:p-6 flex flex-col gap-4 bg-card border-b border-border">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center">
            <span className="text-lg font-semibold text-foreground">{filteredData.length}</span>
            <span className="ml-2 text-sm text-muted-foreground">meetings</span>
          </div>

          <div className="flex flex-col lg:flex-row gap-3 w-full lg:w-auto items-start lg:items-center">
            <div className="relative w-full lg:w-64 flex-shrink-0">
              <label htmlFor="meeting-search" className="sr-only">Search</label>
              <input
                id="meeting-search"
                type="text"
                placeholder="Search meetings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-muted border-transparent text-foreground placeholder-muted-foreground text-sm rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 block w-full pl-10 p-2.5 transition"
              />
              <svg className="w-5 h-5 text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            </div>

            <div className="flex items-center gap-2 w-full lg:w-auto overflow-x-auto no-scrollbar pb-1 lg:pb-0">
              <ViewToggle<ViewMode> views={VIEW_OPTIONS} activeView={viewMode} onViewChange={setViewMode} />
              {viewMode === 'table' && (
                <>
                  <div className="bg-muted p-1 rounded-lg flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => setCellWrapStyle('overflow')} title="Overflow" className={`flex items-center justify-center p-1.5 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:ring-offset-1 ${cellWrapStyle === 'overflow' ? 'bg-background shadow-sm text-brand-500' : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'}`} aria-pressed={cellWrapStyle === 'overflow'} >
                      <ArrowRightToLine className="w-4 h-4" />
                    </button>
                    <button onClick={() => setCellWrapStyle('wrap')} title="Wrap" className={`flex items-center justify-center p-1.5 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:ring-offset-1 ${cellWrapStyle === 'wrap' ? 'bg-background shadow-sm text-brand-500' : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'}`} aria-pressed={cellWrapStyle === 'wrap'} >
                      <WrapText className="w-4 h-4" />
                    </button>
                    <button onClick={() => setCellWrapStyle('clip')} title="Clip" className={`flex items-center justify-center p-1.5 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:ring-offset-1 ${cellWrapStyle === 'clip' ? 'bg-background shadow-sm text-brand-500' : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'}`} aria-pressed={cellWrapStyle === 'clip'} >
                      <Scissors className="w-4 h-4" />
                    </button>
                  </div>
                  <DataTableColumnToggle
                    allColumns={allColumns}
                    visibleColumns={visibleColumns}
                    onColumnToggle={handleColumnToggle}
                  />
                </>
              )}
              <button
                onClick={handleOpenNewMeeting}
                className="flex-shrink-0 flex items-center justify-center bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2.5 px-4 rounded-lg transition duration-200 shadow-sm hover:shadow-md transform hover:-translate-y-px ml-auto lg:ml-0"
              >
                <svg className="w-5 h-5 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                <span className="hidden sm:inline">New</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden bg-background p-4">
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
              renderRowActions={(row) => (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setModalConfig({ meeting: row, isReadOnly: false, isOpen: true });
                  }}
                  className="p-2 text-slate-400 hover:text-brand-600 transition"
                >
                  <Pencil size={16} />
                </button>
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

      <NewMeetingModal
        isOpen={modalConfig.isOpen}
        onClose={handleCloseModal}
        existingData={modalConfig.meeting}
        initialReadOnly={modalConfig.isReadOnly}
      />
      <footer className="flex-shrink-0 bg-card border-t border-border p-3">
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar w-full custom-scrollbar-hide">
          <button
            onClick={() => setStatusFilter(statusFilter === 'Open' ? null : 'Open')}
            className={`flex-shrink-0 whitespace-nowrap px-4 lg:px-6 py-2 rounded-md border text-sm font-semibold transition ${statusFilter === 'Open' ? 'bg-brand-600 text-white border-brand-600 shadow-sm' : 'border-border bg-background text-muted-foreground hover:bg-muted'}`}
          >
            Open
          </button>
          <button
            onClick={() => setStatusFilter(statusFilter === 'Close' ? null : 'Close')}
            className={`flex-shrink-0 whitespace-nowrap px-4 lg:px-6 py-2 rounded-md border text-sm font-semibold transition ${statusFilter === 'Close' ? 'bg-brand-600 text-white border-brand-600 shadow-sm' : 'border-border bg-background text-muted-foreground hover:bg-muted'}`}
          >
            Close
          </button>
          <button
            onClick={() => setStatusFilter(statusFilter === 'Cancelled' ? null : 'Cancelled')}
            className={`flex-shrink-0 whitespace-nowrap px-4 lg:px-6 py-2 rounded-md border text-sm font-semibold transition ${statusFilter === 'Cancelled' ? 'bg-brand-600 text-white border-brand-600 shadow-sm' : 'border-border bg-background text-muted-foreground hover:bg-muted'}`}
          >
            Cancelled
          </button>
        </div>
      </footer>
    </div>
  );
};

export default React.memo(MeetingDashboard);