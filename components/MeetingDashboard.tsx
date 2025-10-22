import React, { useState, useMemo } from 'react';
import { Meeting } from '../types';
import { useData } from '../contexts/DataContext';
import DataTable, { ColumnDef } from './DataTable';
import { useNavigation } from '../contexts/NavigationContext';
// FIX: Replaced non-modular local icon imports with icons from the 'lucide-react' library.
import { ExternalLink, Table, CalendarDays, Clock, Users } from 'lucide-react';
import { parseDate, formatDateAsMDY } from '../utils/time';
import NewMeetingModal from './NewMeetingModal';
import ViewToggle from './ViewToggle';
import AgendaView, { AgendaItem } from './AgendaView';

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const statusColors: { [key: string]: string } = {
      'Close': 'bg-emerald-100 text-slate-800',
      'Open': 'bg-sky-100 text-slate-800',
      'Pending': 'bg-amber-100 text-slate-800',
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


const MeetingDashboard: React.FC<MeetingDashboardProps> = ({ initialFilter }) => {
  const { meetings: meetingData, loading, error } = useData();
  const [modalConfig, setModalConfig] = useState<{ meeting: Meeting | null, isReadOnly: boolean, isOpen: boolean }>({ meeting: null, isReadOnly: false, isOpen: false });
  const [searchQuery, setSearchQuery] = useState(initialFilter || '');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const { handleNavigation } = useNavigation();

  const handleCloseModal = () => setModalConfig(prev => ({ ...prev, isOpen: false }));
  const handleOpenNewMeeting = () => setModalConfig({ meeting: null, isReadOnly: false, isOpen: true });
  const handleViewMeeting = (meeting: Meeting) => setModalConfig({ meeting, isReadOnly: true, isOpen: true });
  
  const filteredData = useMemo(() => {
    let filtered = [...(meetingData || [])];

    if (searchQuery) {
        filtered = filtered.filter(item =>
            ['Company Name', 'Participants', 'Responsible By', 'Remarks', 'Pipeline_ID'].some(key =>
                String(item[key as keyof Meeting] ?? '').toLowerCase().includes(searchQuery.toLowerCase())
            )
        );
    }
    
    return filtered;
  }, [meetingData, searchQuery]);

  const agendaItems = useMemo<AgendaItem<Meeting>[]>(() => {
    return filteredData.map(meeting => ({
      id: meeting['Meeting ID'] || `meeting-${Math.random()}`,
      date: parseDate(meeting['Meeting Date']),
      title: meeting['Company Name'],
      data: meeting
    }));
  }, [filteredData]);

  const columns = useMemo<ColumnDef<Meeting>[]>(() => [
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
              <Users className="w-4 h-4 text-slate-400"/>
              <span className="font-medium truncate">{meeting.Participants}</span>
          </div>
          <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400"/>
              <span>{meeting['Start Time']} - {meeting['End Time']}</span>
          </div>
      </div>
    </>
  );

  return (
    <div className="h-full flex flex-col">
       <div className="p-6 flex flex-col sm:flex-row justify-between sm:items-center flex-wrap gap-4 bg-white border-b border-slate-200">
        <div className="flex items-center">
          <span className="text-lg font-semibold text-gray-800">{filteredData.length}</span>
          <span className="ml-2 text-sm text-gray-500">meetings</span>
        </div>
        <div className="flex items-center gap-4 w-full sm:w-auto">
            <div className="relative flex-grow">
              <label htmlFor="meeting-search" className="sr-only">Search</label>
              <input
                id="meeting-search"
                type="text"
                placeholder="Search meetings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-100 border-transparent text-gray-800 placeholder-gray-400 text-sm rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 block w-full pl-10 p-2.5 transition"
              />
              <svg className="w-5 h-5 text-gray-400 absolute top-1/2 left-3 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            </div>
            <ViewToggle<ViewMode> views={VIEW_OPTIONS} activeView={viewMode} onViewChange={setViewMode} />
            <button
              onClick={handleOpenNewMeeting}
              className="flex-shrink-0 flex items-center justify-center bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2.5 px-4 rounded-lg transition duration-200 shadow-sm hover:shadow-md transform hover:-translate-y-px"
            >
              <svg className="w-5 h-5 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
              <span className="hidden sm:inline">New</span>
            </button>
        </div>
      </div>

       <div className="flex-1 overflow-auto bg-white">
         {viewMode === 'table' ? (
          <div className="bg-white h-full">
            <DataTable
              tableId="meeting-table"
              data={filteredData}
              columns={columns}
              loading={loading}
              onRowClick={handleViewMeeting}
              initialSort={{ key: 'Meeting Date', direction: 'descending' }}
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
    </div>
  );
};

export default React.memo(MeetingDashboard);