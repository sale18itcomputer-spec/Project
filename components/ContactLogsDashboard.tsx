import React, { useState, useMemo } from 'react';
import { ContactLog } from '../types';
import { useData } from '../contexts/DataContext';
import { parseDate, formatDateAsMDY } from '../utils/time';
import NewContactLogModal from './NewContactLogModal';
import KanbanView, { KanbanColumn } from './KanbanView';
import Avatar from './Avatar';
import DataTable, { ColumnDef } from './DataTable';
import { useNavigation } from '../contexts/NavigationContext';
// FIX: Replaced non-modular local icon imports with icons from the 'lucide-react' library.
import { ExternalLink, Table, LayoutGrid } from 'lucide-react';
import ViewToggle from './ViewToggle';
import ItemActionsMenu from './ItemActionsMenu';
import ConfirmationModal from './ConfirmationModal';
import { deleteRecord } from '../services/api';

const KANBAN_COLUMN_IDS = ['Call', 'Message', 'Email', 'Meeting'] as const;
type KanbanColumnId = typeof KANBAN_COLUMN_IDS[number];

interface ContactLogsDashboardProps {
  initialFilter?: string;
}

type ViewMode = 'table' | 'board';

const VIEW_OPTIONS: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
    { id: 'table', label: 'Table', icon: <Table /> },
    { id: 'board', label: 'Board', icon: <LayoutGrid /> },
];

const ContactLogsDashboard: React.FC<ContactLogsDashboardProps> = ({ initialFilter }) => {
  const { contactLogs: logData, users, loading, error, refetchData } = useData();
  const [modalConfig, setModalConfig] = useState<{ log: ContactLog | null, isReadOnly: boolean, isOpen: boolean }>({ log: null, isReadOnly: false, isOpen: false });
  const [searchQuery, setSearchQuery] = useState(initialFilter || '');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [logTypeFilter, setLogTypeFilter] = useState('All Types');
  const [responsibleUserFilter, setResponsibleUserFilter] = useState('All Users');
  const [logToDelete, setLogToDelete] = useState<ContactLog | null>(null);
  const { handleNavigation } = useNavigation();
  
  const handleCloseModal = () => setModalConfig(prev => ({ ...prev, isOpen: false }));
  const handleOpenNewLog = () => setModalConfig({ log: null, isReadOnly: false, isOpen: true });
  const handleViewLog = (log: ContactLog) => setModalConfig({ log, isReadOnly: true, isOpen: true });
  const handleEditLog = (log: ContactLog) => setModalConfig({ log, isReadOnly: false, isOpen: true });
  const handleDeleteRequest = (log: ContactLog) => setLogToDelete(log);

  const handleConfirmDelete = async () => {
    if (!logToDelete || !logToDelete['Log ID']) return;
    try {
      await deleteRecord('Contact_Logs', logToDelete['Log ID']);
      await refetchData();
    } catch (err: any) {
      console.error("Failed to delete log:", err);
      alert(`Error: ${err.message}`);
    } finally {
      setLogToDelete(null);
    }
  };

  const logTypeOptions = useMemo(() => ['All Types', ...KANBAN_COLUMN_IDS], []);
  const userOptions = useMemo(() => {
    if (!users) return ['All Users'];
    const userNames = new Set(users.map(u => u.Name).filter(Boolean));
    return ['All Users', ...Array.from(userNames).sort()];
  }, [users]);

  const filteredData = useMemo(() => {
    let data = logData || [];

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
  }, [logData, searchQuery, logTypeFilter, responsibleUserFilter]);

  const kanbanColumns = useMemo<KanbanColumn<ContactLog>[]>(() => {
    const statusColors: Record<KanbanColumnId, string> = {
        'Call': 'sky',
        'Message': 'violet',
        'Email': 'amber',
        'Meeting': 'emerald'
    };

    return KANBAN_COLUMN_IDS.map(status => ({
        id: status,
        title: status,
        color: statusColors[status] as any,
        items: filteredData.filter(p => p.Type === status)
    }));
  }, [filteredData]);

  const columns = useMemo<ColumnDef<ContactLog>[]>(() => [
    {
      accessorKey: 'Log ID',
      header: 'Log ID',
      isSortable: true,
      cell: (value: string) => <div className="text-slate-600">{value}</div>,
    },
    {
      accessorKey: 'Contact Date',
      header: 'Date',
      isSortable: true,
      cell: (value: string) => formatDateAsMDY(parseDate(value)!) || '-',
    },
    {
      accessorKey: 'Company Name',
      header: 'Company',
      cell: (value: string) => (
        <button
          onClick={(e) => { e.stopPropagation(); handleNavigation({ view: 'companies', filter: value }); }}
          className="group font-semibold text-slate-800 hover:underline text-left transition-colors inline-flex items-center gap-1.5"
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
          className="group font-medium text-slate-800 hover:underline text-left transition-colors"
        >
          {value}
        </button>
      ),
    },
    { accessorKey: 'Type', header: 'Type', isSortable: true },
    { accessorKey: 'Responsible By', header: 'Logged By', isSortable: true },
    {
      accessorKey: 'Remarks',
      header: 'Remarks',
      cell: (value: string) => <p className="text-sm text-slate-600 line-clamp-1 max-w-sm">{value}</p>,
    },
  ], [handleNavigation]);

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
  
  const renderKanbanCard = (log: ContactLog) => (
    <>
      <div className="absolute top-1 right-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <ItemActionsMenu
            onView={() => handleViewLog(log)}
            onEdit={() => handleEditLog(log)}
            onDelete={() => handleDeleteRequest(log)}
        />
      </div>
      <div className="flex-grow">
        <h4 className="font-bold text-slate-800 pr-10">{log['Company Name']}</h4>
        <p className="text-sm text-slate-500">{log['Contact Name']}</p>
        {log.Remarks && <p className="text-sm text-slate-600 mt-2 leading-snug line-clamp-3">{log.Remarks}</p>}
      </div>
      <div className="flex justify-between items-end mt-4 pt-2">
          <span className="text-sm font-medium text-slate-500">{formatDateAsMDY(parseDate(log['Contact Date'])!)}</span>
          {log['Responsible By'] && (
              <Avatar name={log['Responsible By']} showName={false} className="w-8 h-8 text-sm" />
          )}
      </div>
    </>
  );

  return (
    <div className="h-full flex flex-col">
       <div className="p-4 sm:px-6 flex flex-col sm:flex-row justify-between sm:items-center flex-wrap gap-4 bg-white border-b border-slate-200">
        <p className="text-base text-slate-500">
          <span className="font-bold text-slate-800">{filteredData.length}</span> logs
        </p>
        <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
            <div className="relative flex-grow sm:w-56">
              <label htmlFor="log-search" className="sr-only">Search</label>
              <input
                id="log-search"
                type="text"
                placeholder="Search logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-100 border-transparent text-gray-800 placeholder-gray-400 text-sm rounded-lg focus:ring-2 focus:ring-brand-500/50 focus:bg-white focus:border-brand-500 block w-full pl-10 p-2.5 transition"
              />
              <svg className="w-5 h-5 text-gray-400 absolute top-1/2 left-3 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            </div>
            
            <select value={logTypeFilter} onChange={e => setLogTypeFilter(e.target.value)} className="bg-slate-100 border-transparent text-gray-800 text-sm rounded-lg focus:ring-2 focus:ring-brand-500/50 focus:bg-white focus:border-brand-500 block p-2.5 transition w-full sm:w-auto">
              {logTypeOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
            
            <select value={responsibleUserFilter} onChange={e => setResponsibleUserFilter(e.target.value)} className="bg-slate-100 border-transparent text-gray-800 text-sm rounded-lg focus:ring-2 focus:ring-brand-500/50 focus:bg-white focus:border-brand-500 block p-2.5 transition w-full sm:w-auto">
              {userOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>

            <ViewToggle<ViewMode> views={VIEW_OPTIONS} activeView={viewMode} onViewChange={setViewMode} />

            <button
              onClick={handleOpenNewLog}
              className="flex-shrink-0 flex items-center justify-center bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2.5 px-4 rounded-lg transition duration-200 shadow-sm hover:shadow-md transform hover:-translate-y-px"
            >
              <svg className="w-5 h-5 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
              <span className="hidden sm:inline">New Log</span>
            </button>
        </div>
      </div>
      
      {viewMode === 'board' ? (
        <KanbanView<ContactLog>
            columns={kanbanColumns}
            onCardClick={handleViewLog}
            renderCardContent={renderKanbanCard}
            loading={loading}
            getItemId={(item) => item['Log ID'] || ''}
          />
      ) : (
        <div className="flex-1 overflow-auto bg-white">
          <DataTable
            tableId="contact-logs-table"
            data={filteredData}
            columns={columns}
            loading={loading}
            onRowClick={handleViewLog}
            initialSort={{ key: 'Contact Date', direction: 'descending' }}
          />
        </div>
      )}

      <NewContactLogModal
        isOpen={modalConfig.isOpen}
        onClose={handleCloseModal}
        existingData={modalConfig.log}
        initialReadOnly={modalConfig.isReadOnly}
      />
       <ConfirmationModal
        isOpen={!!logToDelete}
        onClose={() => setLogToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Contact Log"
        confirmText="Delete"
      >
        Are you sure you want to delete this contact log? This action cannot be undone.
      </ConfirmationModal>
    </div>
  );
};

export default React.memo(ContactLogsDashboard);