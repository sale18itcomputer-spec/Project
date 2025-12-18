import React, { useState, useMemo, useEffect, useRef } from 'react';
import { PipelineProject } from '../types';
import { useData } from '../contexts/DataContext';
import DataTable, { ColumnDef } from './DataTable';
import { useNavigation } from '../contexts/NavigationContext';
import { ExternalLink, Table, LayoutGrid, AlertTriangle, Calendar, Briefcase, Tag, Clock, SlidersHorizontal, Search, ArrowRightToLine, WrapText, Scissors, Pencil, Columns, Info, Trash2 } from 'lucide-react';
import { deleteRecord, updateRecord } from '../services/api';
import ConfirmationModal from './ConfirmationModal';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { DataTableColumnToggle } from './DataTableColumnToggle';
import { useWindowSize } from '../hooks/useWindowSize';
import { ScrollArea } from './ui/scroll-area';
import Spinner from './Spinner';
import EmptyState from './EmptyState';
import { formatDateAsMDY, calculateDueDate, parseDate } from '../utils/time';
import { parseSheetValue, formatCurrencySmartly, determineCurrency } from '../utils/formatters';
import NewProjectModal from './NewProjectModal';
import Avatar from './Avatar';
import ViewToggle from './ViewToggle';
import KanbanView, { KanbanColumn } from './KanbanView';
import PipelineListContainer from './PipelineListContainer';

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
        <div className="absolute right-0 mt-1 w-36 bg-white rounded-md shadow-lg border z-10 animate-contentFadeIn" style={{ animationDuration: '0.15s' }}>
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

type ViewMode = 'table' | 'board' | 'detail';

const VIEW_OPTIONS: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
  { id: 'table', label: 'Table', icon: <Table /> },
  { id: 'board', label: 'Board', icon: <LayoutGrid /> },
  { id: 'detail', label: 'Detail', icon: <Columns /> },
];

const PIPELINE_COLUMNS_VISIBILITY_KEY = 'limperial-pipeline-columns-visibility';

const PipelineMobileCard: React.FC<{ project: ProcessedProject, onView: () => void }> = ({ project, onView }) => {
  let statusClass = 'mobile-status-default';
  if (project.Status === 'Quote Submitted') statusClass = 'mobile-status-info';
  if (project.Status === 'Close (win)') statusClass = 'mobile-status-success';
  if (project.Status === 'Close (lose)') statusClass = 'mobile-status-danger';

  return (
    <div className="mobile-card" onClick={onView} role="button" tabIndex={0}>
      <div className="mobile-card-header">
        <div>
          <div className="mobile-card-title">{project['Company Name']}</div>
          <div className="mobile-card-subtitle">{project.Require}</div>
        </div>
        <span className={`mobile-status ${statusClass}`}>
          <span className="mobile-status-dot"></span>
          {project.Status.replace('(win)', 'Won').replace('(lose)', 'Lost')}
        </span>
      </div>
      <div className="mobile-card-body">
        <div className="mobile-card-row">
          <span className="mobile-card-label">Bid Value</span>
          <span className="mobile-card-value">{formatCurrencySmartly(project['Bid Value'], project.Currency)}</span>
        </div>
        <div className="mobile-card-row">
          <span className="mobile-card-label">Sales Rep</span>
          <span className="mobile-card-value">{project['Responsible By']}</span>
        </div>
      </div>
    </div>
  );
};


const PipelineDashboard: React.FC<PipelineDashboardProps> = ({ initialFilter }) => {
  const { projects: pipelineData, setProjects, meetings, contactLogs, loading, error } = useData();
  const { addToast } = useToast();
  const { user } = useAuth();
  const [modalConfig, setModalConfig] = useState<{ project: ProcessedProject | null, isReadOnly: boolean, isOpen: boolean }>({ project: null, isReadOnly: false, isOpen: false });
  const [projectToDelete, setProjectToDelete] = useState<PipelineProject | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [selectedPipelineNo, setSelectedPipelineNo] = useState<string | null>(null);
  const [cellWrapStyle, setCellWrapStyle] = useState<'overflow' | 'wrap' | 'clip'>('overflow');
  const { handleNavigation } = useNavigation();
  const { width } = useWindowSize();
  const isMobile = width < 1024; // lg breakpoint

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
  const handleViewProject = (project: ProcessedProject) => {
    if (isMobile) {
      setModalConfig({ project, isReadOnly: true, isOpen: true });
    } else {
      setSelectedPipelineNo(project['Pipeline No.']);
      setViewMode('detail');
    }
  };
  const handleEditProject = (project: ProcessedProject) => setModalConfig({ project, isReadOnly: false, isOpen: true });

  const handleDeleteRequest = (project: PipelineProject) => {
    setProjectToDelete(project);
  };

  const handleConfirmDelete = async () => {
    if (!projectToDelete) return;
    const originalProjects = pipelineData ? [...pipelineData] : [];
    const projectId = projectToDelete['Pipeline No.'];
    setProjectToDelete(null);
    setProjects(prev => prev ? prev.filter(p => p['Pipeline No.'] !== projectId) : null);
    try {
      await deleteRecord('Pipelines', projectId);
      addToast('Project deleted!', 'success');
    } catch (err: any) {
      addToast('Failed to delete project.', 'error');
      setProjects(originalProjects);
    }
  };

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

  const selectedProject = useMemo(() => {
    if (!selectedPipelineNo) return null;
    return filteredData.find(p => p['Pipeline No.'] === selectedPipelineNo) || null;
  }, [selectedPipelineNo, filteredData]);

  useEffect(() => {
    if (viewMode === 'detail' && !selectedPipelineNo && filteredData.length > 0) {
      setSelectedPipelineNo(filteredData[0]['Pipeline No.']);
    }
  }, [viewMode, selectedPipelineNo, filteredData]);

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
        const { totalUSD, totalKHR } = items.reduce((acc, item) => {
          const value = parseSheetValue(item['Bid Value']);
          const determinedCurrency = determineCurrency(value, item.Currency);
          if (determinedCurrency === 'KHR') {
            acc.totalKHR += value;
          } else {
            acc.totalUSD += value;
          }
          return acc;
        }, { totalUSD: 0, totalKHR: 0 });

        const formatOptions = { minimumFractionDigits: 0, maximumFractionDigits: 0 };
        const usdStr = totalUSD > 0 ? totalUSD.toLocaleString('en-US', { style: 'currency', currency: 'USD', ...formatOptions }) : '';
        const khrStr = totalKHR > 0 ? `៛${totalKHR.toLocaleString('en-US', formatOptions)}` : '';

        if (usdStr && khrStr) {
          return (
            <div>
              <span className="text-xl font-bold text-slate-800 block">{usdStr}</span>
              <span className="text-lg font-bold text-slate-600 block">{khrStr}</span>
            </div>
          );
        }

        const singleValue = usdStr || khrStr || '$0';

        return (
          <span className="text-2xl font-bold text-slate-800">
            {singleValue}
          </span>
        );
      }
    }));
  }, [filteredData]);

  const allColumns = useMemo<ColumnDef<ProcessedProject>[]>(() => [
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
      cell: (value: string | undefined) => {
        if (!value) return '-';
        if (value === 'Yes') return 'VAT';
        if (value === 'No') return 'NON-VAT';
        return value;
      }
    },
    {
      accessorKey: 'Bid Value',
      header: 'Bid Value',
      isSortable: true,
      cell: (value: string, row: ProcessedProject) => {
        const formattedValue = formatCurrencySmartly(value, row.Currency);
        if (formattedValue === '-') {
          return <span className="text-slate-400 text-right block w-full">-</span>;
        }
        return (
          <span className="text-sm font-medium text-slate-800 text-right block w-full">
            {formattedValue}
          </span>
        )
      }
    },
    {
      accessorKey: 'Status',
      header: 'Status',
      isSortable: true,
      cell: (status: PipelineProject['Status']) => <StatusBadge status={status} />
    },
  ], [handleNavigation]);

  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(PIPELINE_COLUMNS_VISIBILITY_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) {
          return new Set(parsed);
        }
      }
    } catch (e) {
      console.error("Failed to load visible columns from storage", e);
    }
    // Default to all columns being visible
    return new Set(allColumns.map(c => c.accessorKey as string).filter(Boolean));
  });

  useEffect(() => {
    const saved = localStorage.getItem(PIPELINE_COLUMNS_VISIBILITY_KEY);
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
        localStorage.setItem(PIPELINE_COLUMNS_VISIBILITY_KEY, JSON.stringify(Array.from(newSet)));
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

    const formattedValue = formatCurrencySmartly(item['Bid Value'], item.Currency);

    return (
      <>
        <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
          <ActionsMenu onEdit={() => handleEditProject(item)} onView={() => handleViewProject(item)} onDelete={() => handleDeleteRequest(item)} />
        </div>

        <h4 className="font-bold text-slate-900 pr-8 text-base group-hover:text-brand-700 transition-colors">{item['Company Name']}</h4>
        <p className="text-lg font-semibold text-brand-800 mt-1">
          {formattedValue}
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

  const renderDetailView = () => (
    <div className="flex flex-col md:flex-row h-full">
      <aside className="w-full md:w-80 lg:w-96 border-r border-slate-200 bg-white flex flex-col">
        <PipelineListContainer
          projects={filteredData}
          selectedPipelineNo={selectedPipelineNo}
          onSelectProject={setSelectedPipelineNo}
          loading={loading && !pipelineData}
        />
      </aside>
      <main className="flex-1 p-6 sm:p-8 overflow-y-auto bg-slate-50">
        {loading && !selectedProject ? <Spinner /> : selectedProject ? (
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">{selectedProject['Company Name']}</h1>
                  <p className="text-slate-600 font-mono mt-1">{selectedProject['Pipeline No.']}</p>
                </div>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => handleEditProject(selectedProject)}
                    className="text-sm font-semibold text-brand-600 hover:underline flex items-center gap-1.5"
                  >
                    <Pencil className="w-4 h-4" /> Edit
                  </button>
                  <button
                    onClick={() => handleDeleteRequest(selectedProject)}
                    className="text-sm font-semibold text-rose-600 hover:underline flex items-center gap-1.5"
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="bg-slate-50 p-4 rounded-lg">
                  <dt className="text-sm font-medium text-gray-500">Bid Value</dt>
                  <dd className="mt-1 text-xl font-semibold text-gray-900">{formatCurrencySmartly(selectedProject['Bid Value'], selectedProject.Currency)}</dd>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <dt className="text-sm font-medium text-gray-500">Status</dt>
                  <dd className="mt-1"><StatusBadge status={selectedProject.Status} /></dd>
                </div>
              </div>

              <dl className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Sales Rep</dt>
                  <dd className="mt-1 text-sm text-gray-900">{selectedProject['Responsible By']}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Contact Person</dt>
                  <dd className="mt-1 text-sm text-gray-900">{selectedProject['Contact Name']}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Created Date</dt>
                  <dd className="mt-1 text-sm text-gray-900">{formatDateAsMDY(parseDate(selectedProject['Created Date']))}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Time Frame</dt>
                  <dd className="mt-1 text-sm text-gray-900">{selectedProject['Time Frame']}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Brand</dt>
                  <dd className="mt-1 text-sm text-gray-900">{selectedProject['Brand 1'] || 'N/A'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Type</dt>
                  <dd className="mt-1 text-sm text-gray-900">{selectedProject.Type}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-gray-500">Requirement</dt>
                  <dd className="mt-1 text-sm text-gray-900 break-words">{selectedProject.Require}</dd>
                </div>
              </dl>
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <EmptyState illustration={<Info className="w-16 h-16 text-slate-300" />}>
              <h3 className="mt-2 text-sm font-semibold text-gray-900">Select an Opportunity</h3>
              <p className="mt-1 text-sm text-gray-500">Choose an opportunity from the list to see its details.</p>
            </EmptyState>
          </div>
        )}
      </main>
    </div>
  );

  if (isMobile) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 space-y-4">
          <div className="mobile-search">
            <Search className="mobile-search-icon w-5 h-5" />
            <input
              type="text"
              className="mobile-search-input"
              placeholder="Search opportunities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <ScrollArea className="flex-1 px-4">
          {loading ? <Spinner /> : filteredData.length > 0 ? (
            filteredData.map(project => (
              <PipelineMobileCard key={project['Pipeline No.']} project={project} onView={() => handleViewProject(project)} />
            ))
          ) : (
            <EmptyState>No opportunities found.</EmptyState>
          )}
        </ScrollArea>
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
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-6 flex flex-col sm:flex-row justify-between sm:items-center flex-wrap gap-4 bg-white border-b border-slate-200">
        <div className="flex items-center">
          <span className="text-lg font-semibold text-gray-800">{filteredData.length}</span>
          <span className="ml-2 text-sm text-gray-500">opportunities</span>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
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
          {viewMode === 'table' && (
            <>
              <div className="bg-slate-100 p-1 rounded-lg flex items-center gap-1">
                <button
                  onClick={() => setCellWrapStyle('overflow')}
                  title="Overflow"
                  className={`flex items-center justify-center p-1.5 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:ring-offset-1 ${cellWrapStyle === 'overflow'
                    ? 'bg-white shadow-sm text-brand-700'
                    : 'text-slate-500 hover:bg-white/60 hover:text-slate-700'
                    }`}
                  aria-pressed={cellWrapStyle === 'overflow'}
                >
                  <ArrowRightToLine className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCellWrapStyle('wrap')}
                  title="Wrap"
                  className={`flex items-center justify-center p-1.5 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:ring-offset-1 ${cellWrapStyle === 'wrap'
                    ? 'bg-white shadow-sm text-brand-700'
                    : 'text-slate-500 hover:bg-white/60 hover:text-slate-700'
                    }`}
                  aria-pressed={cellWrapStyle === 'wrap'}
                >
                  <WrapText className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCellWrapStyle('clip')}
                  title="Clip"
                  className={`flex items-center justify-center p-1.5 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:ring-offset-1 ${cellWrapStyle === 'clip'
                    ? 'bg-white shadow-sm text-brand-700'
                    : 'text-slate-500 hover:bg-white/60 hover:text-slate-700'
                    }`}
                  aria-pressed={cellWrapStyle === 'clip'}
                >
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
            onClick={handleOpenNewProject}
            className="flex-shrink-0 flex items-center justify-center bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2.5 px-4 rounded-lg transition duration-200 shadow-sm hover:shadow-md transform hover:-translate-y-px"
          >
            <svg className="w-5 h-5 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
            <span className="hidden sm:inline">New</span>
          </button>
        </div>
      </div>

      {viewMode === 'table' ? (
        <div className="flex-1 overflow-y-auto overflow-x-hidden bg-white">
          <DataTable
            tableId="pipeline-table"
            data={filteredData}
            columns={displayedColumns}
            loading={loading}
            onRowClick={handleViewProject}
            mobilePrimaryColumns={['Pipeline No.', 'Company Name', 'Status']}
            cellWrapStyle={cellWrapStyle}
            renderRowActions={(row) => (
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditProject(row);
                  }}
                  className="p-2 text-slate-400 hover:text-brand-600 transition"
                  title="Edit"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteRequest(row);
                  }}
                  className="p-2 text-slate-400 hover:text-rose-600 transition"
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )}
          />
        </div>
      ) : viewMode === 'board' ? (
        <KanbanView<ProcessedProject>
          columns={kanbanColumns}
          onCardClick={handleViewProject}
          renderCardContent={renderKanbanCard}
          loading={loading}
          onItemMove={handleItemMove}
          getItemId={(item) => item['Pipeline No.']}
        />
      ) : (
        <div className="flex-1 min-h-0 bg-slate-50 overflow-hidden">
          {renderDetailView()}
        </div>
      )}

      <NewProjectModal
        isOpen={modalConfig.isOpen}
        onClose={handleCloseModal}
        existingData={modalConfig.project}
        initialReadOnly={modalConfig.isReadOnly}
        meetings={meetings || []}
        contactLogs={contactLogs || []}
        onSaveSuccess={(newProject) => {
          setSelectedPipelineNo(newProject['Pipeline No.']);
        }}
      />
      <ConfirmationModal
        isOpen={!!projectToDelete}
        onClose={() => setProjectToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Project"
        confirmText="Delete"
        variant="danger"
      >
        Are you sure you want to delete project {projectToDelete?.['Pipeline No.']}? This action cannot be undone.
      </ConfirmationModal>
    </div>
  );
};

export default React.memo(PipelineDashboard);