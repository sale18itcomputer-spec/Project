'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { SiteSurveyLog } from "../../../types";
import { useData } from "../../../contexts/DataContext";
import { deleteRecord } from "../../../services/api";
import DataTable, { ColumnDef, CellWrapStyle } from "../../common/DataTable";
import { parseDate, formatDateAsMDY } from "../../../utils/time";
import { Table, CalendarDays, MapPin, Clock, Pencil, Trash2, Plus, Map as MapIcon } from 'lucide-react';
import ViewToggle from "../../common/ViewToggle";
import AgendaView, { AgendaItem } from "../views/AgendaView";
import { DataTableColumnToggle } from "../../common/DataTableColumnToggle";
import { localStorageGet, localStorageSet } from '../../../utils/storage';
import { PermissionGate } from '../../common/PermissionGate';
import { usePermissions } from '../../../hooks/usePermissions';
import RowActionMenuItems from '../../common/RowActionMenuItems';
import { useWindowManager } from '../../../contexts/WindowManagerContext';
import { useToast } from '../../../contexts/ToastContext';
import SiteSurveyWindowContent from '../../windows/content/SiteSurveyWindowContent';
import ConfirmationModal from '../../modals/ConfirmationModal';
import DashboardHeader from '../../common/DashboardHeader';
import SearchInput from '../../common/SearchInput';
import CellWrapToggle from '../../common/CellWrapToggle';
import StatusFilterBar from '../../common/StatusFilterBar';
import ErrorState from '../../common/ErrorState';
import { IconButton } from '../../ui/icon-button';
import { Button } from '../../ui/button';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';

interface SiteSurveyDashboardProps {
  initialFilter?: string;
}

type ViewMode = 'table' | 'agenda';

const VIEW_OPTIONS: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
  { id: 'table', label: 'Table', icon: <Table /> },
  { id: 'agenda', label: 'Agenda', icon: <CalendarDays /> },
];

const SITE_SURVEY_COLUMNS_VISIBILITY_KEY = 'limperial-site-survey-columns-visibility';


const SiteSurveyDashboard: React.FC<SiteSurveyDashboardProps> = ({ initialFilter }) => {
  const { siteSurveys: surveyData, setSiteSurveys, loading, error } = useData();
  const [searchQuery, setSearchQuery] = useState(initialFilter || '');
  const debouncedSearch = useDebouncedValue(searchQuery);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [cellWrapStyle, setCellWrapStyle] = useState<CellWrapStyle>('wrap');
  const { openWindow } = useWindowManager();
  const { addToast } = useToast();
  const { can } = usePermissions();
  const [surveyToDelete, setSurveyToDelete] = useState<SiteSurveyLog | null>(null);

  const openSurveyWindow = (siteId: string | null) => {
    const id = `site-survey-${siteId ?? 'new'}`;
    openWindow({
      id,
      title: siteId ? `Survey: ${siteId}` : 'New Site Survey',
      content: <SiteSurveyWindowContent windowId={id} siteId={siteId} />,
      draggable: true,
      initialWidth: 800,
      initialHeight: 700,
      minWidth: 600,
      minHeight: 500,
    });
  };

  const handleOpenNewSurvey = () => openSurveyWindow(null);
  const handleViewSurvey = (survey: SiteSurveyLog) => openSurveyWindow(survey['Site ID'] || null);
  const handleEditSurvey = (survey: SiteSurveyLog) => openSurveyWindow(survey['Site ID'] || null);
  const handleDeleteRequest = (survey: SiteSurveyLog) => setSurveyToDelete(survey);
  const handleConfirmDelete = async () => {
    if (!surveyToDelete?.['Site ID']) return;
    const id = surveyToDelete['Site ID'];
    const originalSurveys = surveyData ? [...surveyData] : [];
    setSiteSurveys(cur => cur ? cur.filter(s => s['Site ID'] !== id) : null);
    setSurveyToDelete(null);
    try {
      await deleteRecord('Site_Survey_Logs', id);
      addToast('Survey deleted!', 'success');
    } catch (err: any) {
      addToast(`Failed to delete: ${err.message}`, 'error');
      setSiteSurveys(originalSurveys);
    }
  };

  const filteredData = useMemo(() => {
    let dataToFilter = surveyData ?? [];
    if (!debouncedSearch) return dataToFilter;

    return dataToFilter.filter(item =>
      ['Location', 'Responsible By', 'Remark', 'Site ID'].some(key =>
        String(item[key as keyof SiteSurveyLog] ?? '').toLowerCase().includes(debouncedSearch.toLowerCase())
      )
    );
  }, [surveyData, debouncedSearch]);

  const agendaItems = useMemo<AgendaItem<SiteSurveyLog>[]>(() => {
    return filteredData.map(survey => ({
      id: survey['Site ID'] || `survey-${Math.random()}`,
      date: parseDate(survey.Date),
      title: survey.Location,
      data: survey
    }));
  }, [filteredData]);


  const allColumns = useMemo<ColumnDef<SiteSurveyLog>[]>(() => [
    {
      accessorKey: 'Site ID',
      header: 'Site ID',
      isSortable: true,
      cell: (value: string) => <div className="text-muted-foreground">{value}</div>
    },
    {
      accessorKey: 'Location',
      header: 'Location',
      isSortable: true,
      cell: (value: string) => <span className="font-semibold text-sm text-foreground">{value}</span>
    },
    {
      accessorKey: 'Responsible By',
      header: 'Responsible By',
      isSortable: true,
      cell: (value: string) => <span className="font-medium text-foreground">{value}</span>
    },
    {
      accessorKey: 'Date',
      header: 'Date',
      isSortable: true,
      cell: (value: string) => {
        const date = parseDate(value);
        return date ? formatDateAsMDY(date) : <span className="text-muted-foreground/50 italic">N/A</span>;
      }
    },
    {
      accessorKey: 'Start Time',
      header: 'Start Time',
      isSortable: true,
      cell: (value: string) => <span className="text-sm text-foreground">{value}</span>
    },
    {
      accessorKey: 'End Time',
      header: 'End Time',
      isSortable: true,
      cell: (value: string) => <span className="text-sm text-foreground">{value}</span>
    },
    {
      accessorKey: 'Remark',
      header: 'Remark',
      isSortable: false,
      cell: (value: string) => (
        <p className="text-sm text-muted-foreground">
          {value}
        </p>
      )
    },
  ], []);

  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
    try {
      const saved = localStorageGet(SITE_SURVEY_COLUMNS_VISIBILITY_KEY);
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
    const saved = localStorageGet(SITE_SURVEY_COLUMNS_VISIBILITY_KEY);
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
        localStorageSet(SITE_SURVEY_COLUMNS_VISIBILITY_KEY, JSON.stringify(Array.from(newSet)));
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
    return <ErrorState title="Could not load site survey logs" message={error} />;
  }

  const renderAgendaCard = (survey: SiteSurveyLog) => (
    <>
      <div className="mt-3 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-muted-foreground/50" />
          <span className="font-medium">{survey.Location}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground/50" />
          <span>{survey['Start Time']} - {survey['End Time']}</span>
        </div>
      </div>
    </>
  );



  return (
    <div className="h-full flex flex-col">
      <DashboardHeader title="Site Surveys" icon={<MapIcon />}>
        <SearchInput
          id="survey-search"
          value={searchQuery}
          onValueChange={setSearchQuery}
          placeholder="Search surveys..."
          label="Search surveys"
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

        <PermissionGate module="site_surveys" action="create">
          <Button onClick={handleOpenNewSurvey} aria-label="New site survey">
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">New</span>
          </Button>
        </PermissionGate>
      </DashboardHeader>

      <div className="flex-1 min-h-0 overflow-hidden p-4">
        {viewMode === 'table' ? (
          <div className="h-full">
            <DataTable
              tableId="site-survey-table"
              data={filteredData}
              columns={displayedColumns}
              loading={loading}
              onRowClick={handleViewSurvey}
              initialSort={{ key: 'Date', direction: 'descending' }}
              mobilePrimaryColumns={['Date', 'Location', 'Responsible By']}
              cellWrapStyle={cellWrapStyle}
              emptyState={{
                title: 'No site surveys yet',
                description: 'Site visits you log will appear here.',
              }}
              renderRowActions={(row) => (
                <div className="flex items-center gap-1">
                  <PermissionGate module="site_surveys" action="edit">
                    <IconButton
                      label="Edit survey"
                      tone="primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditSurvey(row);
                      }}
                    >
                      <Pencil size={15} aria-hidden="true" />
                    </IconButton>
                  </PermissionGate>
                  <PermissionGate module="site_surveys" action="delete">
                    <IconButton
                      label="Delete survey"
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
                  onOpenWindow={() => openSurveyWindow(row['Site ID'] || null)}
                  onView={() => handleViewSurvey(row)}
                  onEdit={can('site_surveys', 'edit') ? () => handleEditSurvey(row) : undefined}
                  onDelete={can('site_surveys', 'delete') ? () => handleDeleteRequest(row) : undefined}
                />
              )}
            />
          </div>
        ) : (
          <AgendaView<SiteSurveyLog>
            items={agendaItems}
            onItemClick={handleViewSurvey}
            renderCardContent={renderAgendaCard}
            loading={loading}
          />
        )}
      </div>

      {/* This module has no status filter — the single chip is a label for the
          full set, so its value stays null and selecting it is a no-op. */}
      <StatusFilterBar
        options={[{ value: null, label: 'All Surveys' }]}
        active={null}
        onChange={() => { }}
        summary={`${filteredData.length} surveys`}
      />

      <ConfirmationModal
        isOpen={!!surveyToDelete}
        onClose={() => setSurveyToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Site Survey"
        variant="danger"
      >
        Are you sure you want to delete survey "{surveyToDelete?.['Site ID']}" for "{surveyToDelete?.Location}"? This cannot be undone.
      </ConfirmationModal>
    </div>
  );
};

export default React.memo(SiteSurveyDashboard);
