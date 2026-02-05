import React, { useState, useMemo, useEffect } from 'react';
import { SiteSurveyLog } from "../../types";
import { useData } from "../../contexts/DataContext";
import DataTable, { ColumnDef } from "../common/DataTable";
import { parseDate, formatDateAsMDY } from "../../utils/time";
import NewSiteSurveyModal from "../modals/NewSiteSurveyModal";
import { useNavigation } from "../../contexts/NavigationContext";
import { ExternalLink, Table, CalendarDays, MapPin, Clock, Search, ArrowRightToLine, WrapText, Scissors, Pencil } from 'lucide-react';
import ViewToggle from "../common/ViewToggle";
import AgendaView, { AgendaItem } from "../views/AgendaView";
import { DataTableColumnToggle } from "../common/DataTableColumnToggle";
import { useWindowSize } from "../../hooks/useWindowSize";
import { ScrollArea } from "../ui/scroll-area";
import Spinner from "../common/Spinner";
import EmptyState from "../common/EmptyState";

interface SiteSurveyDashboardProps {
  initialFilter?: string;
}

type ViewMode = 'table' | 'agenda';

const VIEW_OPTIONS: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
  { id: 'table', label: 'Table', icon: <Table /> },
  { id: 'agenda', label: 'Agenda', icon: <CalendarDays /> },
];

const SITE_SURVEY_COLUMNS_VISIBILITY_KEY = 'limperial-site-survey-columns-visibility';

const SiteSurveyMobileCard: React.FC<{ survey: SiteSurveyLog, onView: () => void }> = ({ survey, onView }) => (
  <div className="mobile-card" onClick={onView} role="button" tabIndex={0}>
    <div className="mobile-card-header">
      <div>
        <div className="mobile-card-title">{survey.Location}</div>
        <div className="mobile-card-subtitle">{formatDateAsMDY(parseDate(survey.Date)!)}</div>
      </div>
    </div>
    <div className="mobile-card-body">
      <div className="mobile-card-row">
        <span className="mobile-card-label">Time</span>
        <span className="mobile-card-value">{survey['Start Time']} - {survey['End Time']}</span>
      </div>
      <div className="mobile-card-row">
        <span className="mobile-card-label">Responsible By</span>
        <span className="mobile-card-value">{survey['Responsible By']}</span>
      </div>
    </div>
  </div>
);

const SiteSurveyDashboard: React.FC<SiteSurveyDashboardProps> = ({ initialFilter }) => {
  const { siteSurveys: surveyData, loading, error } = useData();
  const [modalConfig, setModalConfig] = useState<{ survey: SiteSurveyLog | null, isReadOnly: boolean, isOpen: boolean }>({ survey: null, isReadOnly: false, isOpen: false });
  const [searchQuery, setSearchQuery] = useState(initialFilter || '');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [cellWrapStyle, setCellWrapStyle] = useState<'overflow' | 'wrap' | 'clip'>('wrap');
  const { handleNavigation } = useNavigation();
  const { width } = useWindowSize();
  const isMobile = width < 1024;

  const handleCloseModal = () => setModalConfig(prev => ({ ...prev, isOpen: false }));
  const handleOpenNewSurvey = () => setModalConfig({ survey: null, isReadOnly: false, isOpen: true });
  const handleViewSurvey = (survey: SiteSurveyLog) => setModalConfig({ survey, isReadOnly: true, isOpen: true });

  const filteredData = useMemo(() => {
    let dataToFilter = surveyData ?? [];
    if (!searchQuery) return dataToFilter;

    return dataToFilter.filter(item =>
      ['Location', 'Responsible By', 'Remark', 'Site ID'].some(key =>
        String(item[key as keyof SiteSurveyLog] ?? '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    );
  }, [surveyData, searchQuery]);

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
      cell: (value: string) => <div className="text-slate-600">{value}</div>
    },
    {
      accessorKey: 'Location',
      header: 'Location',
      isSortable: true,
      cell: (value: string) => <span className="font-semibold text-sm text-slate-800">{value}</span>
    },
    {
      accessorKey: 'Responsible By',
      header: 'Responsible By',
      isSortable: true,
      cell: (value: string) => <span className="font-medium text-slate-800">{value}</span>
    },
    {
      accessorKey: 'Date',
      header: 'Date',
      isSortable: true,
      cell: (value: string) => {
        const date = parseDate(value);
        return date ? formatDateAsMDY(date) : <span className="text-gray-400 italic">N/A</span>;
      }
    },
    {
      accessorKey: 'Start Time',
      header: 'Start Time',
      isSortable: true,
      cell: (value: string) => <span className="text-sm text-slate-800">{value}</span>
    },
    {
      accessorKey: 'End Time',
      header: 'End Time',
      isSortable: true,
      cell: (value: string) => <span className="text-sm text-slate-800">{value}</span>
    },
    {
      accessorKey: 'Remark',
      header: 'Remark',
      isSortable: false,
      cell: (value: string) => (
        <p className="line-clamp-2 max-w-md text-sm text-slate-800">
          {value}
        </p>
      )
    },
  ], [handleNavigation]);

  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(SITE_SURVEY_COLUMNS_VISIBILITY_KEY);
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
    const saved = localStorage.getItem(SITE_SURVEY_COLUMNS_VISIBILITY_KEY);
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
        localStorage.setItem(SITE_SURVEY_COLUMNS_VISIBILITY_KEY, JSON.stringify(Array.from(newSet)));
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
          <p>Could not load site survey logs: {error}</p>
        </div>
      </div>
    );
  }

  const renderAgendaCard = (survey: SiteSurveyLog) => (
    <>
      <div className="mt-3 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-x-4 gap-y-2 text-sm text-slate-600">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-slate-400" />
          <span className="font-medium">{survey.Location}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-400" />
          <span>{survey['Start Time']} - {survey['End Time']}</span>
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
            <span className="ml-2 text-sm text-muted-foreground">surveys</span>
          </div>

          <div className="flex flex-col lg:flex-row gap-3 w-full lg:w-auto items-start lg:items-center">
            <div className="relative w-full lg:w-64 flex-shrink-0">
              <label htmlFor="survey-search" className="sr-only">Search</label>
              <input
                id="survey-search"
                type="text"
                placeholder="Search surveys..."
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
                onClick={handleOpenNewSurvey}
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
              tableId="site-survey-table"
              data={filteredData}
              columns={displayedColumns}
              loading={loading}
              onRowClick={handleViewSurvey}
              initialSort={{ key: 'Date', direction: 'descending' }}
              mobilePrimaryColumns={['Date', 'Location', 'Responsible By']}
              cellWrapStyle={cellWrapStyle}
              renderRowActions={(row) => (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setModalConfig({ survey: row, isReadOnly: false, isOpen: true });
                  }}
                  className="p-2 text-slate-400 hover:text-brand-600 transition"
                >
                  <Pencil size={16} />
                </button>
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

      <NewSiteSurveyModal
        isOpen={modalConfig.isOpen}
        onClose={handleCloseModal}
        existingData={modalConfig.survey}
        initialReadOnly={modalConfig.isReadOnly}
      />
      <footer className="flex-shrink-0 bg-card border-t border-border p-3">
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar w-full custom-scrollbar-hide">
          <button
            className="flex-shrink-0 whitespace-nowrap px-4 lg:px-6 py-2 rounded-md border text-sm font-semibold transition bg-brand-600 text-white border-brand-600 shadow-sm"
          >
            All Surveys
          </button>
        </div>
      </footer>
    </div>
  );
};

export default React.memo(SiteSurveyDashboard);