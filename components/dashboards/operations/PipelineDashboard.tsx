'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { PipelineProject } from "../../../types";
import { useB2BData } from "../../../hooks/useB2BData";
import DataTable, { ColumnDef, CellWrapStyle } from "../../common/DataTable";
import { useNavigation } from "../../../contexts/NavigationContext";
import { ExternalLink, Table, Pencil, Columns, Info, Trash2, Plus, Filter } from 'lucide-react';
import { deleteRecord } from "../../../services/api";
import ConfirmationModal from "../../modals/ConfirmationModal";
import { useToast } from "../../../contexts/ToastContext";
import { DataTableColumnToggle } from "../../common/DataTableColumnToggle";
import Spinner from "../../common/Spinner";
import EmptyState from "../../common/EmptyState";
import { formatDateAsMDY, calculateDueDate, formatDisplayDate } from "../../../utils/time";
import { formatCurrencySmartly } from "../../../utils/formatters";
import { useWindowManager } from "../../../contexts/WindowManagerContext";
import PipelineWindowContent from "../../windows/content/PipelineWindowContent";
import ViewToggle from "../../common/ViewToggle";
import PipelineListContainer from "../lists/PipelineListContainer";
import { localStorageGet, localStorageSet } from '../../../utils/storage';
import { PermissionGate } from '../../common/PermissionGate';
import RowActionMenuItems from '../../common/RowActionMenuItems';
import DashboardHeader from '../../common/DashboardHeader';
import SearchInput from '../../common/SearchInput';
import CellWrapToggle from '../../common/CellWrapToggle';
import StatusFilterBar from '../../common/StatusFilterBar';
import ErrorState from '../../common/ErrorState';
import { IconButton } from '../../ui/icon-button';
import { Button } from '../../ui/button';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';

type ProcessedProject = PipelineProject & { calculatedDueDate: Date | null };

const StatusBadge: React.FC<{ status: PipelineProject['Status'] }> = ({ status }) => {
  const statusConfig: Record<string, { label: string; color: string }> = {
    'New Deal': { label: 'New Deal', color: 'bg-sky-500/10 text-sky-600' },
    'Requirements': { label: 'Requirements', color: 'bg-violet-500/10 text-violet-600' },
    'Study Spec | Survey': { label: 'Study Spec | Survey', color: 'bg-indigo-500/10 text-indigo-600' },
    'Price Request': { label: 'Price Request', color: 'bg-rose-500/10 text-rose-600' },
    'Proposal Submission': { label: 'Proposal Submission', color: 'bg-amber-500/10 text-amber-600' },
    'Negotiation | Revision': { label: 'Negotiation | Revision', color: 'bg-orange-500/10 text-orange-600' },
    'Contract | PO': { label: 'Contract | PO', color: 'bg-blue-600/10 text-blue-600' },
    'Order Processing': { label: 'Order Processing', color: 'bg-cyan-500/10 text-cyan-600' },
    'Delivery Processing': { label: 'Delivery Processing', color: 'bg-teal-500/10 text-teal-600' },
    'Closure (Win)': { label: 'Closure (Win)', color: 'bg-emerald-600/10 text-emerald-600' },
    'Closure (Lose)': { label: 'Closure (Lose)', color: 'bg-muted text-muted-foreground' },
  };
  const config = statusConfig[status] || { label: status, color: 'bg-muted text-muted-foreground' };

  return (
    <span className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full ${config.color}`}>
      {config.label}
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

interface PipelineDashboardProps {
  initialFilter?: string;
}

type ViewMode = 'table' | 'detail';

const VIEW_OPTIONS: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
  { id: 'table', label: 'Table', icon: <Table /> },
  { id: 'detail', label: 'Detail', icon: <Columns /> },
];

const PIPELINE_COLUMNS_VISIBILITY_KEY = 'limperial-pipeline-columns-visibility-v2';



const PipelineDashboard: React.FC<PipelineDashboardProps> = ({ initialFilter }) => {
  const { projects: pipelineData, setProjects, meetings, contactLogs, loading, error, isB2B } = useB2BData();
  const { addToast } = useToast();
  const { handleNavigation, navigation } = useNavigation();
  const { openWindow } = useWindowManager();
  const [projectToDelete, setProjectToDelete] = useState<PipelineProject | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebouncedValue(searchQuery);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [selectedPipelineNo, setSelectedPipelineNo] = useState<string | null>(null);
  const [cellWrapStyle, setCellWrapStyle] = useState<CellWrapStyle>('nowrap');

  const openPipelineWindow = useCallback((pipelineNo: string | null, initialReadOnly = false) => {
    const id = pipelineNo ? `pipeline-${pipelineNo}` : 'pipeline-new';
    openWindow({
      id,
      title: pipelineNo ? `Pipeline Details: ${pipelineNo}` : 'Create New Pipeline',
      content: <PipelineWindowContent windowId={id} pipelineNo={pipelineNo} initialReadOnly={initialReadOnly} />,
      draggable: true,
      initialWidth: 1100,
      initialHeight: 720,
      minWidth: 800,
      minHeight: 500,
    });
  }, [openWindow]);

  // Handle URL navigation actions (e.g. from external links)
  useEffect(() => {
    if (navigation.action && ['create', 'edit', 'view'].includes(navigation.action)) {
      const isReadOnly = navigation.action === 'view';
      const pNo = navigation.id || null;
      openPipelineWindow(pNo, isReadOnly);
      // Clean up URL parameters so it doesn't reopen on every navigation change
      handleNavigation({ view: 'projects', filter: navigation.filter });
    }
  }, [navigation.action, navigation.id, navigation.filter, handleNavigation, openPipelineWindow]);

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

  const handleOpenNewProject = () => openPipelineWindow(null, false);
  const handleViewProject = (project: ProcessedProject) => {
    setSelectedPipelineNo(project['Pipeline No']);
    setViewMode('detail');
  };
  const handleEditProject = (project: ProcessedProject) => openPipelineWindow(project['Pipeline No'], false);

  const handleDeleteRequest = (project: PipelineProject) => {
    setProjectToDelete(project);
  };

  const handleConfirmDelete = async () => {
    if (!projectToDelete) return;
    const originalProjects = pipelineData ? [...pipelineData] : [];
    const projectId = projectToDelete['Pipeline No'];
    setProjectToDelete(null);
    setProjects(prev => prev ? prev.filter(p => p['Pipeline No'] !== projectId) : null);
    try {
      await deleteRecord('Pipelines', projectId, isB2B);
      addToast('Project deleted!', 'success');
    } catch {
      addToast('Failed to delete project.', 'error');
      setProjects(originalProjects);
    }
  };

  const [statusFilter, setStatusFilter] = useState<string | null>('Active');

  const validPipelineData = useMemo(() => {
    if (!pipelineData) return [];
    return pipelineData.filter(project => project['Pipeline No'] && (project['Pipeline No'].startsWith('PL') || project['Pipeline No'].startsWith('BPL')))
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
        dataToFilter = dataToFilter.filter(item => !['Closure (Win)', 'Closure (Lose)'].includes(item.Status));
      } else if (statusFilter === 'Won') {
        dataToFilter = dataToFilter.filter(item => item.Status === 'Closure (Win)');
      } else if (statusFilter === 'Lost') {
        dataToFilter = dataToFilter.filter(item => item.Status === 'Closure (Lose)');
      } else {
        dataToFilter = dataToFilter.filter(item => item.Status === statusFilter);
      }
    }

    if (debouncedSearch) {
      const lowercasedQuery = debouncedSearch.toLowerCase();
      const searchKeys = ['Company Name', 'Pipeline No', 'Responsible By', 'Contact Name', 'Requirements'];
      dataToFilter = dataToFilter.filter(item =>
        searchKeys.some(key =>
          String(item[key as keyof ProcessedProject] ?? '').toLowerCase().includes(lowercasedQuery)
        )
      );
    }

    return dataToFilter;
  }, [processedData, debouncedSearch, statusFilter]);

  const selectedProject = useMemo(() => {
    if (!selectedPipelineNo) return null;
    return filteredData.find(p => p['Pipeline No'] === selectedPipelineNo) || null;
  }, [selectedPipelineNo, filteredData]);

  useEffect(() => {
    if (viewMode === 'detail' && !selectedPipelineNo && filteredData.length > 0) {
      setSelectedPipelineNo(filteredData[0]['Pipeline No']);
    }
  }, [viewMode, selectedPipelineNo, filteredData]);

  const allColumns = useMemo<ColumnDef<ProcessedProject>[]>(() => [
    {
      accessorKey: 'Pipeline No',
      header: 'Pipeline No',
      isSortable: true,
      cell: (value: string) => (
        <div className="font-semibold text-muted-foreground/80">{value}</div>
      )
    },
    {
      accessorKey: 'Responsible By',
      header: 'Sale Respond',
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
      accessorKey: 'Created Date',
      header: 'Create Date',
      isSortable: true,
      cell: (value: string) => formatDisplayDate(value)
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
      accessorKey: 'Requirements',
      header: 'Requirements',
      isSortable: true,
      cell: (value: string) => (
        <div className="max-w-[200px] truncate" title={value}>{value}</div>
      )
    },
    {
      accessorKey: 'Total Amount',
      header: 'Total Amount',
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
      accessorKey: 'Win Rate',
      header: 'Win Rate (%)',
      isSortable: true,
      cell: (value: number | null) => (
        value != null
          ? <span className="font-medium text-foreground">{value}%</span>
          : <span className="text-muted-foreground/30">-</span>
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
  ], [handleNavigation]);

  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
    try {
      const saved = localStorageGet(PIPELINE_COLUMNS_VISIBILITY_KEY);
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
    const saved = localStorageGet(PIPELINE_COLUMNS_VISIBILITY_KEY);
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
        localStorageSet(PIPELINE_COLUMNS_VISIBILITY_KEY, JSON.stringify(Array.from(newSet)));
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
    return <ErrorState title="Could not load pipeline data" message={error} />;
  }

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
      <main className="flex-1 overflow-hidden p-4">
        {loading && !selectedProject ? <Spinner /> : selectedProject ? (
          <div className="max-w-4xl mx-auto space-y-8 h-full overflow-y-auto pr-2">
            <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-2xl font-bold text-foreground">{selectedProject['Company Name']}</h1>
                  <p className="text-muted-foreground font-mono mt-1">{selectedProject['Pipeline No']}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => handleEditProject(selectedProject)}
                    className="font-semibold"
                  >
                    <Pencil className="w-4 h-4" aria-hidden="true" /> Edit
                  </Button>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => handleDeleteRequest(selectedProject)}
                    className="font-semibold text-rose-500"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" /> Delete
                  </Button>
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="bg-muted/50 p-4 rounded-lg">
                <dt className="text-sm font-medium text-muted-foreground/60">Total Amount</dt>
                <dd className="mt-1 text-xl font-semibold text-primary">{formatCurrencySmartly(selectedProject['Total Amount'], selectedProject.Currency)}</dd>
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
                <dd className="mt-1 text-sm text-foreground">{formatDisplayDate(selectedProject['Created Date'])}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground/60">Time Frame</dt>
                <dd className="mt-1 text-sm text-foreground">{selectedProject['Time Frame']} days</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground/60">Win Rate</dt>
                <dd className="mt-1 text-sm text-foreground">{selectedProject['Win Rate'] != null ? `${selectedProject['Win Rate']}%` : 'N/A'}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-muted-foreground/60">Requirements</dt>
                <dd className="mt-1 text-sm text-foreground break-words">{selectedProject.Requirements}</dd>
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
      <DashboardHeader title="Pipelines" icon={<Filter />}>
        <SearchInput
          id="pipeline-search"
          value={searchQuery}
          onValueChange={setSearchQuery}
          placeholder="Search opportunities..."
          label="Search opportunities"
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

        <PermissionGate module="pipelines" action="create">
          <Button onClick={handleOpenNewProject} aria-label="New pipeline">
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">New</span>
          </Button>
        </PermissionGate>
      </DashboardHeader>

      {viewMode === 'table' ? (
        <div className="flex-1 min-h-0 overflow-hidden p-4">
          <DataTable
            tableId="pipeline-table"
            data={filteredData}
            columns={displayedColumns}
            loading={loading}
            onRowClick={handleViewProject}
            mobilePrimaryColumns={['Pipeline No', 'Company Name', 'Total Amount', 'Status']}
            cellWrapStyle={cellWrapStyle}
            emptyState={{
              title: 'No opportunities yet',
              description: 'Pipeline opportunities you create will appear here.',
            }}
            renderRowActions={(row) => (
              <div className="flex items-center gap-1">
                <IconButton
                  label="Edit pipeline"
                  tone="primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditProject(row);
                  }}
                >
                  <Pencil size={16} aria-hidden="true" />
                </IconButton>
                <IconButton
                  label="Delete pipeline"
                  tone="danger"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteRequest(row);
                  }}
                >
                  <Trash2 size={16} aria-hidden="true" />
                </IconButton>
              </div>
            )}
            renderRowContextMenu={(row) => (
              <RowActionMenuItems
                onOpenWindow={() => openPipelineWindow(row['Pipeline No'], false)}
                onView={() => handleViewProject(row)}
                onEdit={() => handleEditProject(row)}
                onDelete={() => handleDeleteRequest(row)}
              />
            )}
          />
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-hidden">
          {renderDetailView()}
        </div>
      )}


      <ConfirmationModal
        isOpen={!!projectToDelete}
        onClose={() => setProjectToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Project"
        confirmText="Delete"
        variant="danger"
      >
        Are you sure you want to delete project {projectToDelete?.['Pipeline No']}? This action cannot be undone.
      </ConfirmationModal>
      <StatusFilterBar
        options={['Active', 'Won', 'Lost']}
        active={statusFilter}
        onChange={setStatusFilter}
        summary={`${filteredData.length} opportunities`}
      />
    </div>
  );
};

export default React.memo(PipelineDashboard);
