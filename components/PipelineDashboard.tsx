import React, { useState, useMemo, useEffect, useRef } from 'react';
import { PipelineProject } from '../types';
import { useB2BData } from '../hooks/useB2BData';
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
  const statusConfig: Record<string, { label: string; color: string }> = {
    'Qualification': { label: 'Qualification', color: 'bg-slate-500/10 text-slate-500' },
    'Price Request': { label: 'Price Request', color: 'bg-rose-600/10 text-rose-600' },
    'Presentation': { label: 'Presentation', color: 'bg-slate-500/10 text-slate-500' },
    'Quote Submitted': { label: 'Quote Submitted', color: 'bg-slate-500/10 text-slate-500' },
    'Revising Specs': { label: 'Revising Specs', color: 'bg-rose-600/10 text-rose-600' },
    'Bid Evaluation': { label: 'Bid Evaluation', color: 'bg-slate-500/10 text-slate-500' },
    'Pass Evaluation': { label: 'Pass Evaluation', color: 'bg-slate-500/10 text-slate-500' },
    'Pending PO': { label: 'Pending PO', color: 'bg-blue-600/10 text-blue-600' },
    'Ordering': { label: 'Ordering', color: 'bg-blue-600/10 text-blue-600' },
    'Close (win)': { label: 'Close (win)', color: 'bg-emerald-600/10 text-emerald-600' },
    'Close (lose)': { label: 'Close (lose)', color: 'bg-slate-500/10 text-slate-500' },
  };
  const config = statusConfig[status] || { label: status, color: 'bg-muted text-muted-foreground' };

  return (
    <span className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full ${config.color}`}>
      {config.label}
    </span>
  );
};


const TypeBadge: React.FC<{ type: string }> = ({ type }) => {
  const typeColors: { [key: string]: string } = {
    'Maintenance': 'bg-indigo-500/10 text-indigo-500',
    'Project': 'bg-fuchsia-500/10 text-fuchsia-500',
    'Consultant': 'bg-cyan-500/10 text-cyan-500',
  };

  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-md ${typeColors[type] || 'bg-muted text-muted-foreground'}`}>
      {type}
    </span>
  );
};

const DueDate: React.FC<{ dueDate?: Date | null }> = ({ dueDate }) => {
  if (!dueDate) {
    return <span className="text-muted-foreground/30 italic">N/A</span>;
  }

  const now = new Date();
  const todayStrInUTC7 = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
  const todayAtMidnightUTC7 = new Date(`${todayStrInUTC7}T00:00:00.000+07:00`);

  const diffTime = dueDate.getTime() - todayAtMidnightUTC7.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let text, color;
  if (diffDays < 0) {
    text = `Overdue`;
    color = 'text-rose-500 font-semibold';
  } else if (diffDays === 0) {
    text = 'Today';
    color = 'text-amber-500 font-semibold';
  } else if (diffDays <= 7) {
    text = `in ${diffDays} day(s)`;
    color = 'text-sky-500';
  } else {
    text = `in ${diffDays} days`;
    color = 'text-muted-foreground';
  }

  return (
    <div>
      <div className={`font-medium ${color}`}>{text}</div>
      <div className="text-xs text-muted-foreground/60">{formatDateAsMDY(dueDate)}</div>
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
    color = 'text-rose-500 bg-rose-500/10';
    icon = <AlertTriangle className="w-3 h-3" />;
  } else if (diffDays === 0) {
    text = 'Today';
    color = 'text-amber-500 bg-amber-500/10';
    icon = <Calendar className="w-3 h-3" />;
  } else if (diffDays <= 7) {
    text = `${diffDays}d`;
    color = 'text-sky-500 bg-sky-500/10';
    icon = <Clock className="w-3 h-3" />;
  } else {
    return null; // Don't show if it's far out
  }

  return (
    <div
      className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${color} dark:bg-opacity-20`}
      title={`Due on ${formatDateAsMDY(dueDate)}`}
    >
      {icon}
      {text}
    </div>
  );
};

const ActionsMenu: React.FC<{ onEdit: () => void; onView: () => void; onDelete: () => void }> = ({ onEdit, onView, onDelete }) => {
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
      <button onClick={(e) => { e.stopPropagation(); setIsOpen(prev => !prev); }} className="p-2 rounded-full text-muted-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-brand-500">
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
      </button>
      {isOpen && (
        <div className="absolute right-0 mt-1 w-36 bg-card rounded-md shadow-lg border border-border z-10 animate-contentFadeIn" style={{ animationDuration: '0.15s' }}>
          <button onClick={handleAction(onView)} className="block w-full text-left px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors">View Details</button>
          <button onClick={handleAction(onEdit)} className="block w-full text-left px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors">Edit</button>
          <button onClick={handleAction(onDelete)} className="block w-full text-left px-4 py-2.5 text-sm text-rose-500 hover:bg-rose-50 transition-colors">Delete</button>
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
  if (['Price Request', 'Revising Specs'].includes(project.Status)) statusClass = 'mobile-status-danger';
  if (['Pending PO', 'Ordering'].includes(project.Status)) statusClass = 'mobile-status-info';
  if (project.Status === 'Close (win)') statusClass = 'mobile-status-success';

  return (
    <div className="mobile-card" onClick={onView} role="button" tabIndex={0}>
      <div className="mobile-card-header">
        <div>
          <div className="mobile-card-title">{project['Company Name']}</div>
          <div className="mobile-card-subtitle">{project.Require}</div>
        </div>
        <span className={`mobile-status ${statusClass}`}>
          <span className="mobile-status-dot"></span>
          {project.Status === 'Close (win)' ? 'Won' : project.Status === 'Close (lose)' ? 'Lost' : project.Status}
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
  const { projects: pipelineData, setProjects, meetings, contactLogs, loading, error, isB2B } = useB2BData();
  const { addToast } = useToast();
  const { currentUser } = useAuth();
  const [modalConfig, setModalConfig] = useState<{ project: ProcessedProject | null, isReadOnly: boolean, isOpen: boolean }>({ project: null, isReadOnly: false, isOpen: false });
  const [projectToDelete, setProjectToDelete] = useState<PipelineProject | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [selectedPipelineNo, setSelectedPipelineNo] = useState<string | null>(null);
  const [cellWrapStyle, setCellWrapStyle] = useState<'overflow' | 'wrap' | 'clip'>('wrap');
  const { handleNavigation } = useNavigation();

  useEffect(() => {
    if (initialFilter) {
      setSearchQuery(initialFilter);
      setViewMode('table'); // Default to table for search

      // If the filter looks like a project ID, select it and show detail
      if (initialFilter.startsWith('PL') || initialFilter.startsWith('BPL')) {
        setSelectedPipelineNo(initialFilter);
        setViewMode('detail');
        setSearchQuery(''); // Clear search query to show all in list but focus on this one
      }
    } else {
      setSearchQuery('');
    }
  }, [initialFilter]);

  const handleCloseModal = () => setModalConfig(prev => ({ ...prev, isOpen: false }));
  const handleOpenNewProject = () => setModalConfig({ project: null, isReadOnly: false, isOpen: true });
  const handleViewProject = (project: ProcessedProject) => {
    setSelectedPipelineNo(project['Pipeline No.']);
    setViewMode('detail');
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
      const tableName = isB2B ? 'b2b_pipelines' : 'Pipelines';
      await deleteRecord(tableName, projectId);
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
      const tableName = isB2B ? 'b2b_pipelines' : 'Pipelines';
      await updateRecord(tableName, pipelineNo, { 'Status': newStatus });
      addToast('Pipeline moved successfully!', 'success');
    } catch (err) {
      console.error("Failed to update status:", err);
      addToast('Failed to move pipeline. Reverting change.', 'error');
      // Revert UI on error
      setProjects(originalProjects);
    }
  };

  const [statusFilter, setStatusFilter] = useState<string | null>('Active');

  const validPipelineData = useMemo(() => {
    if (!pipelineData) return [];
    return pipelineData.filter(project => project['Pipeline No.'] && (project['Pipeline No.'].startsWith('PL') || project['Pipeline No.'].startsWith('BPL')))
  }, [pipelineData]);

  const processedData: ProcessedProject[] = useMemo(() => {
    return validPipelineData.map(project => ({
      ...project,
      calculatedDueDate: calculateDueDate(project['Created Date'], project['Time Frame'])
    }));
  }, [validPipelineData]);

  const filteredData = useMemo(() => {
    let dataToFilter = processedData;

    if (statusFilter) {
      if (statusFilter === 'Active') {
        dataToFilter = dataToFilter.filter(item => !(item.Status || '').toLowerCase().includes('close'));
      } else if (statusFilter === 'Won') {
        dataToFilter = dataToFilter.filter(item => (item.Status || '').toLowerCase() === 'close (win)');
      } else if (statusFilter === 'Lost') {
        dataToFilter = dataToFilter.filter(item => (item.Status || '').toLowerCase() === 'close (lose)');
      } else {
        dataToFilter = dataToFilter.filter(item => item.Status === statusFilter);
      }
    }

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
  }, [processedData, searchQuery, statusFilter]);

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
    const statuses: PipelineProject['Status'][] = ['Qualification', 'Price Request', 'Presentation', 'Quote Submitted', 'Revising Specs', 'Bid Evaluation', 'Pass Evaluation', 'Pending PO', 'Ordering', 'Close (win)', 'Close (lose)'];
    const statusColors = {
      'Qualification': 'slate',
      'Price Request': 'rose',
      'Presentation': 'slate',
      'Quote Submitted': 'slate',
      'Revising Specs': 'rose',
      'Bid Evaluation': 'slate',
      'Pass Evaluation': 'slate',
      'Pending PO': 'sky',
      'Ordering': 'sky',
      'Close (win)': 'emerald',
      'Close (lose)': 'slate',
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
              <span className="text-xl font-bold text-foreground block">{usdStr}</span>
              <span className="text-lg font-bold text-muted-foreground block">{khrStr}</span>
            </div>
          );
        }

        const singleValue = usdStr || khrStr || '$0';

        return (
          <span className="text-2xl font-bold text-foreground">
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
        <div className="font-semibold text-muted-foreground/80">{value}</div>
      )
    },
    {
      accessorKey: 'Responsible By',
      header: 'Sales Rep',
      isSortable: true,
      cell: (value: string) => <span className="font-medium text-foreground">{value}</span>
    },
    {
      accessorKey: 'Company Name',
      header: 'Company Name',
      isSortable: true,
      cell: (value: string) => (
        <button
          onClick={(e) => { e.stopPropagation(); handleNavigation({ view: 'companies', filter: value }); }}
          className="group font-semibold text-sm text-foreground hover:underline text-left transition-colors inline-flex items-center gap-1.5"
          aria-label={`View company: ${value}`}
        >
          {value}
          <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
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
          className="group font-medium text-foreground hover:underline text-left transition-colors"
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
        if (!value) return <span className="text-muted-foreground">-</span>;
        const display = value === 'Yes' ? 'VAT' : value === 'No' ? 'NON-VAT' : value;
        return <span className="font-medium text-foreground">{display}</span>;
      }
    },
    {
      accessorKey: 'Bid Value',
      header: 'Bid Value',
      isSortable: true,
      cell: (value: string, row: ProcessedProject) => {
        const formattedValue = formatCurrencySmartly(value, row.Currency);
        if (formattedValue === '-') {
          return <span className="text-muted-foreground/30 text-right block w-full">-</span>;
        }
        return (
          <span className="text-sm font-medium text-foreground text-right block w-full">
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
    {
      accessorKey: 'Require',
      header: 'Requirement',
      isSortable: true,
      cell: (value: string) => (
        <div className="max-w-[200px] truncate" title={value}>{value}</div>
      )
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

        <h4 className="font-bold text-foreground pr-8 text-base group-hover:text-brand-700 transition-colors">{item['Company Name']}</h4>
        <p className="text-lg font-semibold text-brand-600 dark:text-brand-400 mt-1">
          {formattedValue}
        </p>

        <p className="text-sm text-muted-foreground mt-2.5 line-clamp-2">{item.Require}</p>

        <div className="text-xs text-muted-foreground mt-3 flex items-center gap-4">
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

        <div className="flex justify-between items-end mt-4 pt-3 border-t border-border">
          <div className="flex items-center gap-3">
            {item['Responsible By'] && (
              <Avatar name={item['Responsible By']} showName={false} className="w-7 h-7 text-xs" />
            )}
            <div className="flex items-center gap-1 text-xs text-muted-foreground" title={`Created on ${createdDate?.toLocaleDateString()}`}>
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
      <aside className="w-full md:w-80 border-r border-border bg-card flex flex-col">
        <PipelineListContainer
          projects={filteredData}
          selectedPipelineNo={selectedPipelineNo}
          onSelectProject={setSelectedPipelineNo}
          loading={loading && !pipelineData}
        />
      </aside>
      <main className="flex-1 overflow-hidden bg-background p-4">
        {loading && !selectedProject ? <Spinner /> : selectedProject ? (
          <div className="max-w-4xl mx-auto space-y-8 h-full overflow-y-auto pr-2">
            <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-2xl font-bold text-foreground">{selectedProject['Company Name']}</h1>
                  <p className="text-muted-foreground font-mono mt-1">{selectedProject['Pipeline No.']}</p>
                </div>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setModalConfig({ project: selectedProject, isReadOnly: false, isOpen: true })}
                    className="text-sm font-semibold text-brand-500 hover:underline flex items-center gap-1.5"
                  >
                    <Pencil className="w-4 h-4" /> Edit
                  </button>
                  <button
                    onClick={() => handleDeleteRequest(selectedProject)}
                    className="text-sm font-semibold text-rose-500 hover:underline flex items-center gap-1.5"
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="bg-muted/50 p-4 rounded-lg">
                <dt className="text-sm font-medium text-muted-foreground/60">Bid Value</dt>
                <dd className="mt-1 text-xl font-semibold text-brand-500">{formatCurrencySmartly(selectedProject['Bid Value'], selectedProject.Currency)}</dd>
              </div>
              <div className="bg-muted/50 p-4 rounded-lg">
                <dt className="text-sm font-medium text-muted-foreground/60">Status</dt>
                <dd className="mt-1"><StatusBadge status={selectedProject.Status} /></dd>
              </div>
            </div>

            <dl className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <dt className="text-sm font-medium text-muted-foreground/60">Sales Rep</dt>
                <dd className="mt-1 text-sm text-foreground">{selectedProject['Responsible By']}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground/60">Contact Person</dt>
                <dd className="mt-1 text-sm text-foreground">{selectedProject['Contact Name']}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground/60">Created Date</dt>
                <dd className="mt-1 text-sm text-foreground">{formatDateAsMDY(parseDate(selectedProject['Created Date']))}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground/60">Time Frame</dt>
                <dd className="mt-1 text-sm text-foreground">{selectedProject['Time Frame']}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground/60">Brand</dt>
                <dd className="mt-1 text-sm text-foreground">{selectedProject['Brand 1'] || 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground/60">Type</dt>
                <dd className="mt-1 text-sm text-foreground">{selectedProject.Type}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-muted-foreground/60">Requirement</dt>
                <dd className="mt-1 text-sm text-foreground break-words">{selectedProject.Require}</dd>
              </div>
            </dl>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <EmptyState illustration={<Info className="w-16 h-16 text-muted-foreground/20" />}>
              <h3 className="mt-2 text-sm font-semibold text-foreground">Select an Opportunity</h3>
              <p className="mt-1 text-sm text-muted-foreground">Choose an opportunity from the list to see its details.</p>
            </EmptyState>
          </div>
        )}
      </main>
    </div>
  );


  return (
    <div className="h-full flex flex-col">
      <div className="p-4 lg:p-6 flex flex-col gap-4 bg-card border-b border-border">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center">
            <span className="text-lg font-semibold text-foreground">{filteredData.length}</span>
            <span className="ml-2 text-sm text-muted-foreground">opportunities</span>
          </div>

          <div className="flex flex-col lg:flex-row gap-3 w-full lg:w-auto items-start lg:items-center">
            <div className="relative w-full lg:w-64 flex-shrink-0">
              <label htmlFor="pipeline-search" className="sr-only">Search</label>
              <input
                id="pipeline-search"
                type="text"
                placeholder="Search opportunities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-muted border-transparent text-foreground placeholder-muted-foreground text-sm rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 block w-full pl-10 p-2.5 transition"
              />
              <svg className="w-5 h-5 text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            </div>

            <div className="flex items-center gap-2 w-full lg:w-auto overflow-x-auto no-scrollbar pb-1 lg:pb-0">
              <div className="flex-shrink-0">
                <ViewToggle<ViewMode> views={VIEW_OPTIONS} activeView={viewMode} onViewChange={setViewMode} />
              </div>
              {viewMode === 'table' && (
                <>
                  <div className="bg-muted p-1 rounded-lg flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => setCellWrapStyle('overflow')}
                      title="Overflow"
                      className={`flex items-center justify-center p-1.5 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:ring-offset-1 ${cellWrapStyle === 'overflow'
                        ? 'bg-background shadow-sm text-brand-500'
                        : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'
                        }`}
                      aria-pressed={cellWrapStyle === 'overflow'}
                    >
                      <ArrowRightToLine className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setCellWrapStyle('wrap')}
                      title="Wrap"
                      className={`flex items-center justify-center p-1.5 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:ring-offset-1 ${cellWrapStyle === 'wrap'
                        ? 'bg-background shadow-sm text-brand-500'
                        : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'
                        }`}
                      aria-pressed={cellWrapStyle === 'wrap'}
                    >
                      <WrapText className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setCellWrapStyle('clip')}
                      title="Clip"
                      className={`flex items-center justify-center p-1.5 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:ring-offset-1 ${cellWrapStyle === 'clip'
                        ? 'bg-background shadow-sm text-brand-500'
                        : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'
                        }`}
                      aria-pressed={cellWrapStyle === 'clip'}
                    >
                      <Scissors className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex-shrink-0">
                    <DataTableColumnToggle
                      allColumns={allColumns}
                      visibleColumns={visibleColumns}
                      onColumnToggle={handleColumnToggle}
                    />
                  </div>
                </>
              )}
              <button
                onClick={handleOpenNewProject}
                className="flex-shrink-0 flex items-center justify-center bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2.5 px-4 rounded-lg transition duration-200 shadow-sm hover:shadow-md transform hover:-translate-y-px ml-auto lg:ml-0"
              >
                <svg className="w-5 h-5 md:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                <span className="hidden md:inline">New</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {viewMode === 'table' ? (
        <div className="flex-1 min-h-0 overflow-hidden bg-background p-4">
          <DataTable
            tableId="pipeline-table"
            data={filteredData}
            columns={displayedColumns}
            loading={loading}
            onRowClick={handleViewProject}
            mobilePrimaryColumns={['Pipeline No.', 'Company Name', 'Bid Value', 'Status']}
            cellWrapStyle={cellWrapStyle}
            renderRowActions={(row) => (
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditProject(row);
                  }}
                  className="p-2 text-muted-foreground hover:text-brand-500 transition"
                  title="Edit"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteRequest(row);
                  }}
                  className="p-2 text-muted-foreground hover:text-rose-500 transition"
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
        <div className="flex-1 min-h-0 bg-background overflow-hidden">
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
      <footer className="flex-shrink-0 bg-card border-t border-border p-3">
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar w-full custom-scrollbar-hide">
          <button
            onClick={() => setStatusFilter(statusFilter === 'Active' ? null : 'Active')}
            className={`flex-shrink-0 whitespace-nowrap px-4 lg:px-6 py-2 rounded-md border text-sm font-semibold transition ${statusFilter === 'Active' ? 'bg-brand-600 text-white border-brand-600 shadow-sm' : 'border-border bg-background text-muted-foreground hover:bg-muted'}`}
          >
            Active
          </button>
          <button
            onClick={() => setStatusFilter(statusFilter === 'Won' ? null : 'Won')}
            className={`flex-shrink-0 whitespace-nowrap px-4 lg:px-6 py-2 rounded-md border text-sm font-semibold transition ${statusFilter === 'Won' ? 'bg-brand-600 text-white border-brand-600 shadow-sm' : 'border-border bg-background text-muted-foreground hover:bg-muted'}`}
          >
            Won
          </button>
          <button
            onClick={() => setStatusFilter(statusFilter === 'Lost' ? null : 'Lost')}
            className={`flex-shrink-0 whitespace-nowrap px-4 lg:px-6 py-2 rounded-md border text-sm font-semibold transition ${statusFilter === 'Lost' ? 'bg-brand-600 text-white border-brand-600 shadow-sm' : 'border-border bg-background text-muted-foreground hover:bg-muted'}`}
          >
            Lost
          </button>
        </div>
      </footer>
    </div>
  );
};

export default React.memo(PipelineDashboard);