import React, { useState, useMemo, useEffect } from 'react';
import { Company, PipelineProject, SaleOrder } from '../types';
import { useB2BData } from '../hooks/useB2BData';
import { useNavigation } from '../contexts/NavigationContext';
import NewCompanyModal from './NewCompanyModal';
import { Info, Briefcase, Users, DollarSign, Table, Columns, ExternalLink, Search, ArrowRightToLine, WrapText, Scissors, Pencil } from 'lucide-react';
import Spinner from './Spinner';
import { parseSheetValue, formatMixedCurrency, determineCurrency } from '../utils/formatters';
import EmptyState from './EmptyState';
import CompanyListContainer from './CompanyListContainer';
import ViewToggle from './ViewToggle';
import DataTable, { ColumnDef } from './DataTable';
import { formatDateAsMDY, parseDate } from '../utils/time';
import { DataTableColumnToggle } from './DataTableColumnToggle';
import { useWindowSize } from '../hooks/useWindowSize';
import { ScrollArea } from './ui/scroll-area';


interface CompanyDashboardProps {
  initialFilter?: string;
}

type ViewMode = 'table' | 'detail';

const VIEW_OPTIONS: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
  { id: 'table', label: 'Table', icon: <Table /> },
  { id: 'detail', label: 'Detail', icon: <Columns /> },
];

const COMPANY_COLUMNS_VISIBILITY_KEY = 'limperial-company-columns-visibility';

type ProcessedCompany = Company & {
  totalValueUSD: number;
  totalValueKHR: number;
  status: 'Active' | 'Inactive';
};

const CompanyMobileCard: React.FC<{ company: ProcessedCompany; onView: () => void }> = ({ company, onView }) => (
  <div className="mobile-card" onClick={onView} role="button" tabIndex={0}>
    <div className="mobile-card-header">
      <div>
        <div className="mobile-card-title">{company['Company Name']}</div>
        <div className="mobile-card-subtitle">{company.Field}</div>
      </div>
      <span className={`mobile-status ${company.status === 'Active' ? 'mobile-status-success' : 'mobile-status-default'}`}>
        <span className="mobile-status-dot"></span>
        {company.status}
      </span>
    </div>
    <div className="mobile-card-body">
      <div className="mobile-card-row">
        <span className="mobile-card-label">Total Value</span>
        <span className="mobile-card-value">{formatMixedCurrency(company.totalValueUSD, company.totalValueKHR)}</span>
      </div>
      <div className="mobile-card-row">
        <span className="mobile-card-label">Phone</span>
        <span className="mobile-card-value">{company['Phone Number'] || 'N/A'}</span>
      </div>
      <div className="mobile-card-row">
        <span className="mobile-card-label">Created By</span>
        <span className="mobile-card-value">{company['Created By'] || 'N/A'}</span>
      </div>
    </div>
  </div>
);

const CompanyDashboard: React.FC<CompanyDashboardProps> = ({ initialFilter }) => {
  const { companies: companyData, projects, contacts, quotations, saleOrders, loading, error } = useB2BData();
  const [modalConfig, setModalConfig] = useState<{ company: ProcessedCompany | null, isReadOnly: boolean, isOpen: boolean }>({ company: null, isReadOnly: false, isOpen: false });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [cellWrapStyle, setCellWrapStyle] = useState<'overflow' | 'wrap' | 'clip'>('overflow');
  const { handleNavigation } = useNavigation();
  const { width } = useWindowSize();
  const isMobile = width < 1024; // lg breakpoint

  const handleCloseModal = () => setModalConfig(prev => ({ ...prev, isOpen: false }));
  const handleOpenNewCompany = () => setModalConfig({ company: null, isReadOnly: false, isOpen: true });
  const handleViewCompany = (company: ProcessedCompany) => {
    if (isMobile) {
      setModalConfig({ company, isReadOnly: true, isOpen: true });
    } else {
      setSelectedCompanyId(company['Company ID']);
      setViewMode('detail');
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

      // Calculate total from completed Sale Orders, excluding VAT
      const { totalValueUSD, totalValueKHR } = saleOrders
        ? saleOrders
          .filter(so => so['Company Name'] === companyName && so.Status === 'Completed')
          .reduce((acc, so) => {
            const totalAmount = parseSheetValue(so['Total Amount']);
            const determinedCurrency = determineCurrency(totalAmount, so.Currency);

            // Exclude VAT from the total
            let subtotal = totalAmount;
            if (so['Bill Invoice'] === 'VAT') {
              // If there's a Tax field, use it; otherwise calculate 10% VAT
              const taxAmount = so.Tax ? parseSheetValue(so.Tax) : (totalAmount / 1.1) * 0.1;
              subtotal = totalAmount - taxAmount;
            }

            if (determinedCurrency === 'KHR') {
              acc.totalValueKHR += subtotal;
            } else {
              acc.totalValueUSD += subtotal;
            }
            return acc;
          }, { totalValueUSD: 0, totalValueKHR: 0 })
        : { totalValueUSD: 0, totalValueKHR: 0 };

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
        totalValueUSD,
        totalValueKHR,
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

    // Calculate total from completed Sale Orders, excluding VAT
    const relatedSaleOrders = saleOrders?.filter(so => so['Company Name'] === companyName) || [];
    const { totalValueUSD, totalValueKHR } = relatedSaleOrders
      .filter(so => so.Status === 'Completed')
      .reduce((sum, so) => {
        const totalAmount = parseSheetValue(so['Total Amount']);
        const determinedCurrency = determineCurrency(totalAmount, so.Currency);

        // Exclude VAT from the total
        let subtotal = totalAmount;
        if (so['Bill Invoice'] === 'VAT') {
          const taxAmount = so.Tax ? parseSheetValue(so.Tax) : (totalAmount / 1.1) * 0.1;
          subtotal = totalAmount - taxAmount;
        }

        if (determinedCurrency === 'KHR') {
          sum.totalValueKHR += subtotal;
        } else {
          sum.totalValueUSD += subtotal;
        }
        return sum;
      }, { totalValueUSD: 0, totalValueKHR: 0 });

    return { relatedProjects, relatedContacts, totalValueUSD, totalValueKHR };
  }, [selectedCompany, projects, contacts, saleOrders]);

  const allColumns = useMemo<ColumnDef<ProcessedCompany>[]>(() => [
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
      accessorKey: 'totalValueUSD', // Sort by USD value
      header: 'Total Amount',
      isSortable: true,
      cell: (_, row) => (
        <span className="text-sm font-medium text-slate-800 text-right block w-full">
          {formatMixedCurrency(row.totalValueUSD, row.totalValueKHR)}
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

  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(COMPANY_COLUMNS_VISIBILITY_KEY);
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
    const saved = localStorage.getItem(COMPANY_COLUMNS_VISIBILITY_KEY);
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
        localStorage.setItem(COMPANY_COLUMNS_VISIBILITY_KEY, JSON.stringify(Array.from(newSet)));
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
                  <dt className="text-sm font-medium text-gray-500 flex items-center justify-center gap-2"><DollarSign className="w-5 h-5" /> Total Value</dt>
                  <dd className="mt-1 text-xl font-semibold text-gray-900">{formatMixedCurrency(companyDetails.totalValueUSD, companyDetails.totalValueKHR)}</dd>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <dt className="text-sm font-medium text-gray-500 flex items-center justify-center gap-2"><Briefcase className="w-5 h-5" /> Pipelines</dt>
                  <dd className="mt-1 text-xl font-semibold text-gray-900">{companyDetails.relatedProjects.length}</dd>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <dt className="text-sm font-medium text-gray-500 flex items-center justify-center gap-2"><Users className="w-5 h-5" /> Contacts</dt>
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

  if (isMobile) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 space-y-4">
          <div className="mobile-search">
            <Search className="mobile-search-icon w-5 h-5" />
            <input
              type="text"
              className="mobile-search-input"
              placeholder="Search companies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button
            onClick={() => handleOpenNewCompany()}
            className="w-full flex items-center justify-center bg-brand-600 hover:bg-brand-700 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 shadow-sm"
          >
            + New Company
          </button>
        </div>

        <ScrollArea className="flex-1 px-4">
          {loading ? <Spinner /> : filteredData.length > 0 ? (
            filteredData.map(company => (
              <CompanyMobileCard key={company['Company ID']} company={company} onView={() => handleViewCompany(company)} />
            ))
          ) : (
            <EmptyState>No companies found.</EmptyState>
          )}
        </ScrollArea>
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
  }

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
            {viewMode === 'table' && (
              <>
                <div className="bg-slate-100 p-1 rounded-lg flex items-center gap-1">
                  <button onClick={() => setCellWrapStyle('overflow')} title="Overflow" className={`flex items-center justify-center p-1.5 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:ring-offset-1 ${cellWrapStyle === 'overflow' ? 'bg-white shadow-sm text-brand-700' : 'text-slate-500 hover:bg-white/60 hover:text-slate-700'}`} aria-pressed={cellWrapStyle === 'overflow'} >
                    <ArrowRightToLine className="w-4 h-4" />
                  </button>
                  <button onClick={() => setCellWrapStyle('wrap')} title="Wrap" className={`flex items-center justify-center p-1.5 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:ring-offset-1 ${cellWrapStyle === 'wrap' ? 'bg-white shadow-sm text-brand-700' : 'text-slate-500 hover:bg-white/60 hover:text-slate-700'}`} aria-pressed={cellWrapStyle === 'wrap'} >
                    <WrapText className="w-4 h-4" />
                  </button>
                  <button onClick={() => setCellWrapStyle('clip')} title="Clip" className={`flex items-center justify-center p-1.5 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:ring-offset-1 ${cellWrapStyle === 'clip' ? 'bg-white shadow-sm text-brand-700' : 'text-slate-500 hover:bg-white/60 hover:text-slate-700'}`} aria-pressed={cellWrapStyle === 'clip'} >
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
              columns={displayedColumns}
              loading={loading && !companyData}
              onRowClick={handleViewCompany}
              initialSort={{ key: 'Company ID', direction: 'ascending' }}
              mobilePrimaryColumns={['Company Name', 'status']}
              cellWrapStyle={cellWrapStyle}
              renderRowActions={(row) => (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setModalConfig({ company: row, isReadOnly: false, isOpen: true });
                  }}
                  className="p-2 text-slate-400 hover:text-brand-600 transition"
                >
                  <Pencil size={16} />
                </button>
              )}
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