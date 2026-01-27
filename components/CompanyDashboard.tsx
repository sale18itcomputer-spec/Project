import React, { useState, useMemo, useEffect } from 'react';
import { Company, PipelineProject, SaleOrder } from '../types';
import { useB2BData } from '../hooks/useB2BData';
import { useNavigation } from '../contexts/NavigationContext';
import NewCompanyModal from './NewCompanyModal';
import { Info, Briefcase, Users, DollarSign, Table, Columns, ExternalLink, Search, ArrowRightToLine, WrapText, Scissors, Pencil } from 'lucide-react';
import Spinner from './Spinner';
import { parseSheetValue, formatMixedCurrency, determineCurrency } from '../utils/formatters';
import EmptyState from './EmptyState';
import ViewToggle from './ViewToggle';
import DataTable, { ColumnDef } from './DataTable';
import { formatDateAsMDY, parseDate } from '../utils/time';
import { DataTableColumnToggle } from './DataTableColumnToggle';
import { useWindowSize } from '../hooks/useWindowSize';
import { ScrollArea } from './ui/scroll-area';


interface CompanyDashboardProps {
  initialFilter?: string;
}

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
  const [cellWrapStyle, setCellWrapStyle] = useState<'overflow' | 'wrap' | 'clip'>('overflow');
  const { width } = useWindowSize();
  const isMobile = width < 1024; // lg breakpoint

  const handleCloseModal = () => setModalConfig(prev => ({ ...prev, isOpen: false }));
  const handleOpenNewCompany = () => setModalConfig({ company: null, isReadOnly: false, isOpen: true });
  const handleViewCompany = (company: ProcessedCompany) => {
    setModalConfig({ company, isReadOnly: true, isOpen: true });
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
        status: isActive ? 'Active' : 'Inactive'
      };
    });
  }, [validCompanies, projects, saleOrders]);

  const filteredData = useMemo(() => {
    if (!searchQuery) return processedData;
    const lowercasedQuery = searchQuery.toLowerCase();
    return processedData.filter(item =>
      ['Company Name', 'Company ID', 'Field', 'Phone Number'].some(key =>
        String(item[key as keyof Company] ?? '').toLowerCase().includes(lowercasedQuery)
      )
    );
  }, [processedData, searchQuery]);

  // Handle initial filter by opening modal if a match is found
  useEffect(() => {
    if (initialFilter && filteredData.length > 0) {
      const found = filteredData.find(c => c['Company Name'] === initialFilter || c['Company ID'] === initialFilter);
      if (found) {
        setModalConfig({ company: found, isReadOnly: true, isOpen: true });
      }
    }
  }, [initialFilter, filteredData]);

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
        <span className="font-semibold text-foreground">{value}</span>
      )
    },
    { accessorKey: 'Payment Term', header: 'Payment Term', isSortable: true },
    { accessorKey: 'Field', header: 'Industry', isSortable: true },
    {
      accessorKey: 'totalValueUSD', // Sort by USD value
      header: 'Total Amount',
      isSortable: true,
      cell: (_, row) => (
        <span className="text-sm font-medium text-foreground text-right block w-full">
          {formatMixedCurrency(row.totalValueUSD, row.totalValueKHR)}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      isSortable: true,
      cell: (value: 'Active' | 'Inactive') => {
        const statusColor = value === 'Active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted text-muted-foreground';
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
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="p-4 sm:px-6 bg-card border-b border-border flex-shrink-0">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div className="flex items-center">
            <span className="text-lg font-semibold text-foreground">{filteredData.length}</span>
            <span className="ml-2 text-sm text-muted-foreground">companies</span>
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
                className="bg-muted border-transparent text-foreground placeholder-muted-foreground/50 text-sm rounded-lg focus:ring-2 focus:ring-brand-500/50 focus:bg-background focus:border-brand-500 block w-full pl-10 p-2.5 transition"
              />
              <svg className="w-5 h-5 text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            </div>

            <div className="bg-muted p-1 rounded-lg flex items-center gap-1">
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

      <div className="flex-1 min-h-0 overflow-hidden bg-background p-4">
        <div className="h-full">
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
                className="p-2 text-muted-foreground hover:text-brand-500 transition"
              >
                <Pencil size={16} />
              </button>
            )}
          />
        </div>
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
      />
    </div>
  );
};

export default React.memo(CompanyDashboard);