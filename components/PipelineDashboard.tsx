import React, { useState, useMemo, useEffect, useRef } from 'react';
import { PipelineProject } from '../types';
import { useData } from '../contexts/DataContext';
import DataTable, { ColumnDef } from './DataTable';
import { useNavigation } from '../contexts/NavigationContext';
// FIX: Replaced non-modular local icon imports with icons from the 'lucide-react' library.
import { ExternalLink, Table, LayoutGrid, AlertTriangle, Calendar, Briefcase, Tag, Clock } from 'lucide-react';
import { formatDateAsMDY, calculateDueDate, parseDate } from '../utils/time';
import { parseSheetValue } from '../utils/formatters';
import NewProjectModal from './NewProjectModal';
import Avatar from './Avatar';
import ViewToggle from './ViewToggle';
import KanbanView, { KanbanColumn } from './KanbanView';
import { updateRecord } from '../services/api';
import { useToast } from '../contexts/ToastContext';

type ProcessedProject = PipelineProject & {
  calculatedDueDate: Date | null;
};

const StatusBadge: React.FC<{ status: PipelineProject['Status'] }> = ({ status }) => {
  const statusConfig = {
    'Quote Submitted': {
      label: 'Quote Submitted',
      color: 'bg-sky-100 text-slate-800',
    },
    'Close (win)': {
      label: 'Won',
      color: 'bg-emerald-100 text-slate-800',
    },
    'Close (lose)': {
      label: 'Lost',
      color: 'bg-rose-100 text-slate-800',
    },
  };
  const config = statusConfig[status] || { label: status, color: 'bg-slate-100 text-slate-800' };

  return (
    <span className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full ${config.color}`}>
      {config.label}
    </span>
  );
};


const TypeBadge: React.FC<{ type: string }> = ({ type }) => {
  const typeColors: { [key: string]: string } = {
    'Maintenance': 'bg-indigo-100 text-slate-800',
    'Project': 'bg-fuchsia-100 text-slate-800',
    'Consultant': 'bg-cyan-100 text-slate-800',
  };

  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-md ${typeColors[type] || 'bg-slate-100 text-slate-800'}`}>
      {type}
    </span>
  );
};

const DueDate: React.FC<{ dueDate?: Date | null }> = ({ dueDate }) => {
    if (!dueDate) {
        return <span className="text-gray-400 italic">N/A</span>;
    }

    const now = new Date();
    const todayStrInUTC7 = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
    const todayAtMidnightUTC7 = new Date(`${todayStrInUTC7}T00:00:00.000+07:00`);

    const diffTime = dueDate.getTime() - todayAtMidnightUTC7.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let text, color;
    if (diffDays < 0) {
        text = `Overdue`;
        color = 'text-rose-600 font-semibold';
    } else if (diffDays === 0) {
        text = 'Today';
        color = 'text-amber-600 font-semibold';
    } else if (diffDays <= 7) {
        text = `in ${diffDays} day(s)`;
        color = 'text-sky-600';
    } else {
        text = `in ${diffDays} days`;
        color = 'text-gray-500';
    }

    return (
        <div>
            <div className={`font-medium ${color}`}>{text}</div>
            <div className="text-xs text-gray-400">{formatDateAsMDY(dueDate)}</div>
        </div>
    );
};

const CardDueDate: React.FC<{ dueDate: Date }> = ({ dueDate }) => {
    const now = new Date();
    const todayStrInUTC7 = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
    const todayAtMidnightUTC7 = new Date(`${todayStrInUTC7}T00:00:00.000+07:00`);

    const diffTime = dueDate.getTime() - todayAtMidnightUTC7.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let text, color, icon;
    if (diffDays < 0) {
        text = `Overdue`;
        color = 'text-rose-600 bg-rose-100';
        icon = <AlertTriangle className="w-3 h-3" />;
    } else if (diffDays === 0) {
        text = 'Today';
        color = 'text-amber-600 bg-amber-100';
        icon = <Calendar className="w-3 h-3" />;
    } else if (diffDays <= 7) {
        text = `${diffDays}d`;
        color = 'text-sky-600 bg-sky-100';
        icon = <Clock className="w-3 h-3" />;
    } else {
        return null; // Don't show if it's far out
    }

    return (
        <div 
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}
            title={`Due on ${formatDateAsMDY(dueDate)}`}
        >
            {icon}
            {text}
        </div>
    );
};

const ActionsMenu: React.FC<{ onEdit: () => void; onView: () => void }> = ({ onEdit, onView }) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleAction = (action: () => void) => (e: React.MouseEvent) => {
        e.stopPropagation();
        action();
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={menuRef}>
            <button onClick={(e) => { e.stopPropagation(); setIsOpen(prev => !prev); }} className="p-2 rounded-full text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
            </button>
            {isOpen && (
                <div className="absolute right-0 mt-1 w-36 bg-white rounded-md shadow-lg border z-10 animate-contentFadeIn" style={{animationDuration: '0.15s'}}>
                    <button onClick={handleAction(onView)} className="block w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors">View Details</button>
                    <button onClick={handleAction(onEdit)} className="block w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors">Edit</button>
                </div>
            )}
        </div>
    );
};


interface PipelineDashboardProps {
  initialFilter?: string;
}

type ViewMode = 'table' | 'board';

const VIEW_OPTIONS: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
    { id: 'table', label: 'Table', icon: <Table /> },
    { id: 'board', label: 'Board', icon: <LayoutGrid /> },
];

const PipelineDashboard: React.FC<PipelineDashboardProps> = ({ initialFilter }) => {
  const { projects: pipelineData, setProjects, meetings, contactLogs, users, loading, error } = useData();
  const [modalConfig, setModalConfig] = useState<{ project: ProcessedProject | null, isReadOnly: boolean, isOpen: boolean }>({ project: null, isReadOnly: false, isOpen: false });
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const { handleNavigation } = useNavigation();
  const { addToast } = useToast();

  useEffect(() => {
    if (initialFilter) {
      setSearchQuery(initialFilter);
      setViewMode('table'); // Switch to table view when filtering from another page
    } else {
      setSearchQuery('');
    }
  }, [initialFilter]);
  
  const handleCloseModal = () => setModalConfig(prev => ({ ...prev, isOpen: false }));
  const handleOpenNewProject = () => setModalConfig({ project: null, isReadOnly: false, isOpen: true });
  const handleViewProject = (project: ProcessedProject) => setModalConfig({ project, isReadOnly: true, isOpen: true });
  const handleEditProject = (project: ProcessedProject) => setModalConfig({ project, isReadOnly: false, isOpen: true });

  const handleItemMove = async (item: PipelineProject, newStatus: string) => {
    const pipelineNo = item['Pipeline No.'];
    if (!pipelineNo) return;

    const originalProjects = pipelineData ? [...pipelineData] : [];

    // Optimistic UI Update
    setProjects(currentProjects => {
      if (!currentProjects) return null;
      return currentProjects.map(p =>
        p['Pipeline No.'] === pipelineNo ? { ...p, Status: newStatus as PipelineProject['Status'] } : p
      );
    });

    try {
      await updateRecord('Pipelines', pipelineNo, { 'Status': newStatus });
      addToast('Pipeline moved successfully!', 'success');
    } catch (err) {
      console.error("Failed to update status:", err);
      addToast('Failed to move pipeline. Reverting change.', 'error');
      // Revert UI on error
      setProjects(originalProjects);
    }
  };

  const validPipelineData = useMemo(() => {
    if (!pipelineData) return [];
    return pipelineData.filter(project => project['Pipeline No.'] && project['Pipeline No.'].startsWith('PL'))
  }, [pipelineData]);
  
  const processedData: ProcessedProject[] = useMemo(() => {
    return validPipelineData.map(project => ({
      ...project,
      calculatedDueDate: calculateDueDate(project['Created Date'], project['Time Frame'])
    }));
  }, [validPipelineData]);

  const filteredData = useMemo(() => {
    let dataToFilter = processedData;

    if (searchQuery) {
        const lowercasedQuery = searchQuery.toLowerCase();
        const searchKeys = ['Company Name', 'Pipeline No.', 'Responsible By', 'Contact Name', 'Require'];
        dataToFilter = dataToFilter.filter(item =>
            searchKeys.some(key =>
                String(item[key as keyof ProcessedProject] ?? '').toLowerCase().includes(lowercasedQuery)
            )
        );
    }

    return dataToFilter;
  }, [processedData, searchQuery]);

  const kanbanColumns = useMemo<KanbanColumn<ProcessedProject>[]>(() => {
    const statuses: PipelineProject['Status'][] = ['Quote Submitted', 'Close (win)', 'Close (lose)'];
    const statusColors = {
        'Quote Submitted': 'sky',
        'Close (win)': 'emerald',
        'Close (lose)': 'rose',
    };

    return statuses.map(status => ({
        id: status,
        title: status,
        color: statusColors[status] as any,
        items: filteredData.filter(p => p.Status === status),
        renderHeader: (items: ProcessedProject[]) => {
            const totalValue = items.reduce((sum, item) => sum + parseSheetValue(item['Bid Value']), 0);
            return (
                <span className="text-2xl font-bold text-slate-800">
                    {totalValue.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
            );
        }
    }));
  }, [filteredData]);
  
  const columns = useMemo<ColumnDef<ProcessedProject>[]>(() => [
    {
      accessorKey: 'Pipeline No.',
      header: 'Pipeline No.',
      isSortable: true,
      cell: (value: string) => (
          <div className="font-semibold text-slate-600">{value}</div>
      )
    },
    {
      accessorKey: 'Responsible By',
      header: 'Sales Rep',
      isSortable: true,
      cell: (value: string) => <span className="font-medium text-slate-800">{value}</span>
    },
    {
      accessorKey: 'Company Name',
      header: 'Company Name',
      isSortable: true,
      cell: (value: string) => (
        <button
          onClick={(e) => { e.stopPropagation(); handleNavigation({ view: 'companies', filter: value }); }}
          className="group font-semibold text-sm text-slate-800 hover:underline text-left transition-colors inline-flex items-center gap-1.5"
          aria-label={`View company: ${value}`}
        >
          {value}
          <ExternalLink className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      )
    },
    {
      accessorKey: 'Contact Name',
      header: 'Contact Name',
      isSortable: true,
      cell: (value: string) => (
        <button
            onClick={(e) => { e.stopPropagation(); handleNavigation({ view: 'contacts', filter: value }); }}
            className="group font-medium text-slate-800 hover:underline text-left transition-colors"
        >
            {value}
        </button>
      )
    },
    {
        accessorKey: 'Created Date',
        header: 'Created Date',
        isSortable: true,
        cell: (value: string) => formatDateAsMDY(parseDate(value))
    },
    {
        accessorKey: 'Time Frame',
        header: 'Time Frame',
        isSortable: true,
    },
    {
      accessorKey: 'calculatedDueDate',
      header: 'Due Date',
      isSortable: true,
      cell: (value: Date | null) => <DueDate dueDate={value} />
    },
    {
        accessorKey: 'Taxable',
        header: 'Taxable',
        isSortable: true,
    },
    {
      accessorKey: 'Bid Value',
      header: 'Bid Value',
      isSortable: true,
      cell: (value: string) => {
        const num = parseSheetValue(value);
        if (num === 0) return <span className="text-slate-400 text-right block w-full">-</span>;
        return (
            <span className="text-sm font-medium text-slate-800 text-right block w-full">
                {num.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits:0 })}
            </span>
        )
    }},
    {
        accessorKey: 'Status',
        header: 'Status',
        isSortable: true,
        cell: (status: PipelineProject['Status']) => <StatusBadge status={status} />
    },
  ], [handleNavigation]);


  if (error) {
    return (
      <div className="p-6 md:p-8">
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg" role="alert">
          <p className="font-bold">Error</p>
          <p>Could not load pipeline data: {error}</p>
        </div>
      </div>
    );
  }

  const renderKanbanCard = (item: ProcessedProject) => {
    const createdDate = parseDate(item['Created Date']);
    let ageText = '';
    if (createdDate) {
        const diffTime = new Date().getTime() - createdDate.getTime();
        const diffDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
        ageText = `${diffDays}d ago`;
    }

    return (
        <>
            <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                <ActionsMenu onEdit={() => handleEditProject(item)} onView={() => handleViewProject(item)} />
            </div>

            <h4 className="font-bold text-slate-900 pr-8 text-base group-hover:text-brand-700 transition-colors">{item['Company Name']}</h4>
            <p className="text-lg font-semibold text-brand-800 mt-1">
                {parseSheetValue(item['Bid Value']).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits:0 })}
            </p>

            <p className="text-sm text-slate-600 mt-2.5 line-clamp-2">{item.Require}</p>
            
            <div className="text-xs text-slate-500 mt-3 flex items-center gap-4">
                <div className="flex items-center gap-1.5" title={`Type: ${item.Type}`}>
                    <Briefcase className="w-3.5 h-3.5" />
                    <span>{item.Type}</span>
                </div>
                {item['Brand 1'] && item['Brand 1'].trim() && item['Brand 1'] !== 'N/A' && (
                    <div className="flex items-center gap-1.5" title={`Brand: ${item['Brand 1']}`}>
                        <Tag className="w-3.5 h-3.5" />
                        <span>{item['Brand 1']}</span>
                    </div>
                )}
            </div>

            <div className="flex justify-between items-end mt-4 pt-3 border-t border-slate-100">
                <div className="flex items-center gap-3">
                    {item['Responsible By'] && (
                        <Avatar name={item['Responsible By']} showName={false} className="w-7 h-7 text-xs" />
                    )}
                    <div className="flex items-center gap-1 text-xs text-slate-500" title={`Created on ${createdDate?.toLocaleDateString()}`}>
                        <Clock className="w-3.5 h-3.5" />
                        <span>{ageText}</span>
                    </div>
                </div>
                {item.calculatedDueDate && <CardDueDate dueDate={item.calculatedDueDate} />}
            </div>
        </>
    );
  };

  return (
    <div className="h-full flex flex-col">
       <div className="p-6 flex flex-col sm:flex-row justify-between sm:items-center flex-wrap gap-4 bg-white border-b border-slate-200">
        <div className="flex items-center">
          <span className="text-lg font-semibold text-gray-800">{filteredData.length}</span>
          <span className="ml-2 text-sm text-gray-500">opportunities</span>
        </div>
        <div className="flex items-center gap-4 w-full sm:w-auto">
            <div className="relative flex-grow">
              <label htmlFor="pipeline-search" className="sr-only">Search</label>
              <input
                id="pipeline-search"
                type="text"
                placeholder="Search opportunities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-100 border-transparent text-gray-800 placeholder-gray-400 text-sm rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 block w-full pl-10 p-2.5 transition"
              />
              <svg className="w-5 h-5 text-gray-400 absolute top-1/2 left-3 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            </div>
            <ViewToggle<ViewMode> views={VIEW_OPTIONS} activeView={viewMode} onViewChange={setViewMode} />
            <button
              onClick={handleOpenNewProject}
              className="flex-shrink-0 flex items-center justify-center bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2.5 px-4 rounded-lg transition duration-200 shadow-sm hover:shadow-md transform hover:-translate-y-px"
            >
              <svg className="w-5 h-5 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
              <span className="hidden sm:inline">New</span>
            </button>
        </div>
      </div>

       {viewMode === 'table' ? (
        <div className="flex-1 overflow-auto bg-white">
          <DataTable
              tableId="pipeline-table"
              data={filteredData}
              columns={columns}
              loading={loading}
              onRowClick={handleViewProject}
          />
        </div>
       ) : (
        <KanbanView<ProcessedProject>
          columns={kanbanColumns}
          onCardClick={handleViewProject}
          renderCardContent={renderKanbanCard}
          loading={loading}
          onItemMove={handleItemMove}
          getItemId={(item) => item['Pipeline No.']}
        />
       )}
      
      <NewProjectModal
        isOpen={modalConfig.isOpen}
        onClose={handleCloseModal}
        existingData={modalConfig.project}
        initialReadOnly={modalConfig.isReadOnly}
        meetings={meetings || []}
        contactLogs={contactLogs || []}
      />
    </div>
  );
};

export default React.memo(PipelineDashboard);