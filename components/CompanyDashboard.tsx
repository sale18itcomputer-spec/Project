import React, { useState, useMemo, useEffect } from 'react';
import { Company, PipelineProject, SaleOrder } from '../types';
import { useData } from '../contexts/DataContext';
import { useNavigation } from '../contexts/NavigationContext';
import NewCompanyModal from './NewCompanyModal';
// FIX: Replaced non-modular local icon imports with icons from the 'lucide-react' library.
import { Info, Briefcase, Users, DollarSign, Table, Columns, ExternalLink } from 'lucide-react';
import Spinner from './Spinner';
import { parseSheetValue } from '../utils/formatters';
import EmptyState from './EmptyState';
import CompanyListContainer from './CompanyListContainer';
import ViewToggle from './ViewToggle';
import DataTable, { ColumnDef } from './DataTable';
import { formatDateAsMDY, parseDate } from '../utils/time';


interface CompanyDashboardProps {
  initialFilter?: string;
}

type ViewMode = 'table' | 'detail';

const VIEW_OPTIONS: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
    { id: 'table', label: 'Table', icon: <Table /> },
    { id: 'detail', label: 'Detail', icon: <Columns /> },
];

type ProcessedCompany = Company & {
  totalValue: number;
  status: 'Active' | 'Inactive';
};

const CompanyDashboard: React.FC<CompanyDashboardProps> = ({ initialFilter }) => {
  const { companies: companyData, projects, contacts, quotations, saleOrders, loading, error } = useData();
  const [modalConfig, setModalConfig] = useState<{ company: ProcessedCompany | null, isReadOnly: boolean, isOpen: boolean }>({ company: null, isReadOnly: false, isOpen: false });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const { handleNavigation } = useNavigation();

  const handleCloseModal = () => setModalConfig(prev => ({ ...prev, isOpen: false }));
  const handleOpenNewCompany = () => setModalConfig({ company: null, isReadOnly: false, isOpen: true });
  const handleViewCompany = (company: ProcessedCompany) => {
    if (viewMode === 'table') {
        setModalConfig({ company, isReadOnly: true, isOpen: true })
    } else {
        setSelectedCompanyId(company['Company ID']);
    }
  };

  const validCompanies = useMemo(() => {
    if (!companyData) return [];
    return companyData.filter(company => company['Company Name'] && company['Company Name'].trim() !== '');
  }, [companyData]);

  const processedData = useMemo<ProcessedCompany[]>(() => {
    if (!validCompanies) return [];

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    return validCompanies.map(company => {
        const companyName = company['Company Name'];
        
        const totalValue = projects
            ? projects
                .filter(p => p['Company Name'] === companyName && p.Status === 'Close (win)')
                .reduce((sum, p) => sum + parseSheetValue(p['Bid Value']), 0)
            : 0;
            
        const isActive = saleOrders
            ? saleOrders.some(so => {
                const soDate = parseDate(so['SO Date']);
                return so['Company Name'] === companyName &&
                       so.Status === 'Completed' &&
                       soDate && soDate >= ninetyDaysAgo;
            })
            : false;
        
        return {
            ...company,
            totalValue,
            status: isActive ? 'Active' as const : 'Inactive' as const
        };
    });
  }, [validCompanies, projects, saleOrders]);

  useEffect(() => {
    if (initialFilter && processedData.length > 0) {
      const found = processedData.find(c => c['Company Name'] === initialFilter || c['Company ID'] === initialFilter);
      setSelectedCompanyId(found ? found['Company ID'] : processedData[0]?.['Company ID'] || null);
      if (viewMode !== 'detail') setViewMode('detail');
    } else if (!selectedCompanyId && processedData.length > 0) {
      setSelectedCompanyId(processedData[0]['Company ID']);
    }
  }, [initialFilter, processedData, selectedCompanyId]);


  const filteredData = useMemo(() => {
    if (!searchQuery) return processedData;
    const lowercasedQuery = searchQuery.toLowerCase();
    return processedData.filter(item =>
        ['Company Name', 'Company ID', 'Field', 'Phone Number'].some(key =>
            String(item[key as keyof Company] ?? '').toLowerCase().includes(lowercasedQuery)
        )
    );
  }, [processedData, searchQuery]);

  const selectedCompany = useMemo(() => {
    if (!selectedCompanyId) return null;
    return processedData.find(c => c['Company ID'] === selectedCompanyId) || null;
  }, [selectedCompanyId, processedData]);
  
  const companyDetails = useMemo(() => {
    if (!selectedCompany) return null;
    const companyName = selectedCompany['Company Name'];
    const relatedProjects = projects?.filter(p => p['Company Name'] === companyName) || [];
    const relatedContacts = contacts?.filter(c => c['Company Name'] === companyName) || [];
    const totalValue = relatedProjects.reduce((sum, p) => sum + parseSheetValue(p['Bid Value']), 0);

    return { relatedProjects, relatedContacts, totalValue };
  }, [selectedCompany, projects, contacts]);

  const columns = useMemo<ColumnDef<ProcessedCompany>[]>(() => [
    {
      accessorKey: 'Company ID',
      header: 'Company ID',
      isSortable: true,
    },
    {
      accessorKey: 'Created Date',
      header: 'Create Date',
      isSortable: true,
      cell: (value: string) => formatDateAsMDY(parseDate(value)),
    },
    {
      accessorKey: 'Created By',
      header: 'Created By',
      isSortable: true,
    },
    {
      accessorKey: 'Company Name',
      header: 'Company Name',
      isSortable: true,
      cell: (value: string) => (
        <span className="font-semibold text-slate-800">{value}</span>
      )
    },
    { accessorKey: 'Payment Term', header: 'Payment Term', isSortable: true },
    { accessorKey: 'Field', header: 'Industry', isSortable: true },
    {
      accessorKey: 'totalValue',
      header: 'Total Amount',
      isSortable: true,
      cell: (value: number) => (
        <span className="text-sm font-medium text-slate-800 text-right block w-full">
          {value > 0 ? value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '-'}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      isSortable: true,
      cell: (value: 'Active' | 'Inactive') => {
        const statusColor = value === 'Active' ? 'bg-emerald-100 text-slate-800' : 'bg-slate-100 text-slate-800';
        return (
          <span className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full ${statusColor}`}>
            {value}
          </span>
        );
      },
    },
  ], []);


  if (error) {
    return (
       <div className="p-6 md:p-8">
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg" role="alert">
          <p className="font-bold">Error</p>
          <p>Could not load company data: {error}</p>
        </div>
      </div>
    );
  }

  const DetailItem: React.FC<{ label: string; value: string | React.ReactNode }> = ({ label, value }) => {
    if (!value) return null;
    return (
      <div>
        <dt className="text-sm font-medium text-gray-500">{label}</dt>
        <dd className="mt-1 text-sm text-gray-900">{value}</dd>
      </div>
    );
  };

  const renderDetailView = () => (
     <div className="flex flex-col md:flex-row h-full">
        <aside className="w-full md:w-80 lg:w-96 border-r border-slate-200 bg-white flex flex-col">
            <CompanyListContainer
                companies={filteredData}
                selectedCompanyId={selectedCompanyId}
                onSelectCompany={setSelectedCompanyId}
                loading={loading && !companyData}
            />
        </aside>
        <main className="flex-1 p-6 sm:p-8 overflow-y-auto bg-slate-50">
            {loading && !selectedCompany ? <Spinner /> : selectedCompany && companyDetails ? (
            <div className="max-w-4xl mx-auto space-y-8">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">{selectedCompany['Company Name']}</h1>
                        <p className="text-slate-600 mt-1">{selectedCompany.Field}</p>
                    </div>
                    <button 
                        onClick={() => setModalConfig({ company: selectedCompany, isReadOnly: false, isOpen: true })}
                        className="text-sm font-semibold text-brand-600 hover:underline"
                    >
                        Edit
                    </button>
                    </div>

                    <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
                    <div className="bg-slate-50 p-4 rounded-lg">
                        <dt className="text-sm font-medium text-gray-500 flex items-center justify-center gap-2"><DollarSign className="w-5 h-5"/> Total Value</dt>
                        <dd className="mt-1 text-xl font-semibold text-gray-900">{companyDetails.totalValue.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</dd>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-lg">
                        <dt className="text-sm font-medium text-gray-500 flex items-center justify-center gap-2"><Briefcase className="w-5 h-5"/> Pipelines</dt>
                        <dd className="mt-1 text-xl font-semibold text-gray-900">{companyDetails.relatedProjects.length}</dd>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-lg">
                        <dt className="text-sm font-medium text-gray-500 flex items-center justify-center gap-2"><Users className="w-5 h-5"/> Contacts</dt>
                        <dd className="mt-1 text-xl font-semibold text-gray-900">{companyDetails.relatedContacts.length}</dd>
                    </div>
                    </div>

                    <dl className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                    <DetailItem label="Phone" value={selectedCompany['Phone Number']} />
                    <DetailItem label="Email" value={selectedCompany.Email} />
                    <DetailItem label="Website" value={selectedCompany.Website && <a href={selectedCompany.Website} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">{selectedCompany.Website}</a>} />
                    <DetailItem label="Payment Term" value={selectedCompany['Payment Term']} />
                    <DetailItem label="Patent File" value={selectedCompany['Patent File'] && <a href={selectedCompany['Patent File']} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-brand-600 hover:underline">View File <ExternalLink className="w-4 h-4" /></a>} />
                    <div className="sm:col-span-2">
                        <DetailItem label="Address" value={<p className="whitespace-pre-wrap">{selectedCompany['Address (English)']}</p>} />
                    </div>
                    </dl>
                </div>

                {/* Related Contacts */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Contacts ({companyDetails.relatedContacts.length})</h3>
                    {companyDetails.relatedContacts.length > 0 ? (
                        <ul className="divide-y divide-slate-100">
                        {companyDetails.relatedContacts.map(contact => (
                            <li key={contact['Customer ID']} className="py-3">
                            <button onClick={() => handleNavigation({ view: 'contacts', filter: contact.Name })} className="w-full text-left group">
                                <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-semibold text-slate-800 group-hover:text-brand-600">{contact.Name}</p>
                                    <p className="text-sm text-slate-600">{contact.Role}</p>
                                </div>
                                <p className="text-sm text-slate-600">{contact['Tel (1)']}</p>
                                </div>
                            </button>
                            </li>
                        ))}
                        </ul>
                    ) : <p className="text-sm text-slate-600">No contacts found for this company.</p>}
                </div>

                {/* Related Pipelines */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Pipelines ({companyDetails.relatedProjects.length})</h3>
                    {companyDetails.relatedProjects.length > 0 ? (
                        <ul className="divide-y divide-slate-100">
                        {companyDetails.relatedProjects.map(project => (
                            <li key={project['Pipeline No.']} className="py-3">
                            <button onClick={() => handleNavigation({ view: 'projects', filter: project['Pipeline No.'] })} className="w-full text-left group">
                                <div className="flex items-center justify-between">
                                    <div>
                                    <p className="font-semibold text-slate-800 group-hover:text-brand-600">{project.Require}</p>
                                    <p className="text-sm text-slate-600">{project['Pipeline No.']}</p>
                                    </div>
                                    <p className="text-sm font-semibold text-slate-600">{parseSheetValue(project['Bid Value']).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</p>
                                </div>
                            </button>
                            </li>
                        ))}
                        </ul>
                    ) : <p className="text-sm text-slate-600">No pipelines found for this company.</p>}
                </div>
            </div>
            ) : (
            <div className="h-full flex items-center justify-center">
                <EmptyState illustration={<Info className="w-16 h-16 text-slate-300" />}>
                    <h3 className="mt-2 text-sm font-semibold text-gray-900">Select a Company</h3>
                    <p className="mt-1 text-sm text-gray-500">Choose a company from the list to see its details.</p>
                </EmptyState>
            </div>
            )}
        </main>
     </div>
  );

  return (
    <div className="h-full flex flex-col bg-white">
       <div className="p-4 sm:px-6 bg-white border-b border-slate-200 flex-shrink-0">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div className="flex items-center">
                <span className="text-lg font-semibold text-gray-800">{filteredData.length}</span>
                <span className="ml-2 text-sm text-slate-600">companies</span>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
                <div className="relative flex-grow sm:w-64">
                    <label htmlFor="company-search" className="sr-only">Search</label>
                    <input
                        id="company-search"
                        type="text"
                        placeholder="Search companies..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-slate-100 border-transparent text-gray-800 placeholder-gray-400 text-sm rounded-lg focus:ring-2 focus:ring-brand-500/50 focus:bg-white focus:border-brand-500 block w-full pl-10 p-2.5 transition"
                    />
                    <svg className="w-5 h-5 text-gray-400 absolute top-1/2 left-3 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                </div>
                <ViewToggle<ViewMode> views={VIEW_OPTIONS} activeView={viewMode} onViewChange={setViewMode} />
                <button
                    onClick={() => handleOpenNewCompany()}
                    className="flex-shrink-0 flex items-center justify-center bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2.5 px-4 rounded-lg transition duration-200 shadow-sm hover:shadow-md transform hover:-translate-y-px"
                >
                    <svg className="w-5 h-5 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                    <span className="hidden sm:inline">New</span>
                </button>
            </div>
        </div>
      </div>
      
      <div className="flex-1 min-h-0">
        {viewMode === 'table' ? (
             <div className="h-full overflow-auto">
                <DataTable
                    tableId="company-table"
                    data={filteredData}
                    columns={columns}
                    loading={loading && !companyData}
                    onRowClick={handleViewCompany}
                    initialSort={{ key: 'Company ID', direction: 'ascending' }}
                />
            </div>
        ) : (
            renderDetailView()
        )}
      </div>

      <NewCompanyModal
        isOpen={modalConfig.isOpen}
        onClose={handleCloseModal}
        existingData={modalConfig.company}
        initialReadOnly={modalConfig.isReadOnly}
        projects={projects || []}
        contacts={contacts || []}
        quotations={quotations || []}
        saleOrders={saleOrders || []}
        onSaveSuccess={(newCompany) => {
          setSelectedCompanyId(newCompany['Company ID']);
        }}
      />
    </div>
  );
};

export default React.memo(CompanyDashboard);