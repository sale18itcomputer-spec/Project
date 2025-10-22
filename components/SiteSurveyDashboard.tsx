import React, { useState, useMemo } from 'react';
import { SiteSurveyLog } from '../types';
import { useData } from '../contexts/DataContext';
import DataTable, { ColumnDef } from './DataTable';
import { parseDate, formatDateAsMDY } from '../utils/time';
import NewSiteSurveyModal from './NewSiteSurveyModal';
import { useNavigation } from '../contexts/NavigationContext';
// FIX: Replaced non-modular local icon imports with icons from the 'lucide-react' library.
import { ExternalLink, Table, CalendarDays, MapPin, Clock } from 'lucide-react';
import ViewToggle from './ViewToggle';
import AgendaView, { AgendaItem } from './AgendaView';

interface SiteSurveyDashboardProps {
  initialFilter?: string;
}

type ViewMode = 'table' | 'agenda';

const VIEW_OPTIONS: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
    { id: 'table', label: 'Table', icon: <Table /> },
    { id: 'agenda', label: 'Agenda', icon: <CalendarDays /> },
];

const SiteSurveyDashboard: React.FC<SiteSurveyDashboardProps> = ({ initialFilter }) => {
  const { siteSurveys: surveyData, loading, error } = useData();
  const [modalConfig, setModalConfig] = useState<{ survey: SiteSurveyLog | null, isReadOnly: boolean, isOpen: boolean }>({ survey: null, isReadOnly: false, isOpen: false });
  const [searchQuery, setSearchQuery] = useState(initialFilter || '');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const { handleNavigation } = useNavigation();

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


  const columns = useMemo<ColumnDef<SiteSurveyLog>[]>(() => [
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
              <MapPin className="w-4 h-4 text-slate-400"/>
              <span className="font-medium">{survey.Location}</span>
          </div>
          <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400"/>
              <span>{survey['Start Time']} - {survey['End Time']}</span>
          </div>
      </div>
    </>
  );

  return (
    <div className="h-full flex flex-col">
       <div className="p-6 flex flex-col sm:flex-row justify-between sm:items-center flex-wrap gap-4 bg-white border-b border-slate-200">
        <div className="flex items-center">
          <span className="text-lg font-semibold text-gray-800">{filteredData.length}</span>
          <span className="ml-2 text-sm text-gray-500">surveys</span>
        </div>
        <div className="flex items-center gap-4 w-full sm:w-auto">
            <div className="relative flex-grow">
              <label htmlFor="survey-search" className="sr-only">Search</label>
              <input
                id="survey-search"
                type="text"
                placeholder="Search surveys..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-100 border-transparent text-gray-800 placeholder-gray-400 text-sm rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 block w-full pl-10 p-2.5 transition"
              />
              <svg className="w-5 h-5 text-gray-400 absolute top-1/2 left-3 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            </div>
            <ViewToggle<ViewMode> views={VIEW_OPTIONS} activeView={viewMode} onViewChange={setViewMode} />
            <button
              onClick={handleOpenNewSurvey}
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
              tableId="site-survey-table"
              data={filteredData}
              columns={columns}
              loading={loading}
              onRowClick={handleViewSurvey}
              initialSort={{ key: 'Date', direction: 'descending' }}
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
    </div>
  );
};

export default React.memo(SiteSurveyDashboard);