import React, { useState, useMemo } from 'react';
import { Quotation } from '../types';
import { useData } from '../contexts/DataContext';
import DataTable, { ColumnDef } from './DataTable';
import { parseDate, formatDateAsMDY } from '../utils/time';
import QuotationCreator from './QuotationCreator';
import { useNavigation } from '../contexts/NavigationContext';
import { QUOTATION_SHEET_ID } from '../constants';
import MetricCard from './MetricCard';
import { parseSheetValue } from '../utils/formatters';
// FIX: Replaced non-modular local icon imports with icons from the 'lucide-react' library.
import { FileText, DollarSign, CheckCircle, ShoppingCart } from 'lucide-react';
import FileLinkCell from './FileLinkCell';
import QuotationDetailModal from './QuotationDetailModal';

const StatusBadge: React.FC<{ status: Quotation['Status'] }> = ({ status }) => {
  const statusConfig: { [key in Quotation['Status'] | string]: { bg: string; text: string } } = {
    'Open': { bg: 'bg-brand-100', text: 'text-slate-800' },
    'Close (Win)': { bg: 'bg-emerald-100', text: 'text-slate-800' },
    'Close (Lose)': { bg: 'bg-rose-100', text: 'text-slate-800' },
    'Cancel': { bg: 'bg-red-100', text: 'text-slate-800' },
  };

  const config = statusConfig[status] || { bg: 'bg-slate-100', text: 'text-slate-800' };

  return (
    <span className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded-md ${config.bg} ${config.text}`}>
      {status}
    </span>
  );
};


const QuotationDashboard: React.FC = () => {
  const { quotations, loading, error } = useData();
  const [isCreating, setIsCreating] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [viewedQuotation, setViewedQuotation] = useState<Quotation | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { handleNavigation } = useNavigation();

  const quotationSheetId = QUOTATION_SHEET_ID;

  const handleNewQuotation = () => {
    setSelectedQuotation(null);
    setIsCreating(true);
  };

  const handleEditQuotation = (quotation: Quotation) => {
    setViewedQuotation(null);
    setSelectedQuotation(quotation);
    setIsCreating(true);
  };
  
  const handleViewQuotation = (quotation: Quotation) => {
    setViewedQuotation(quotation);
  };

  const handleBackToDashboard = () => {
    setIsCreating(false);
    setSelectedQuotation(null);
  };

  const metrics = useMemo(() => {
    if (!quotations) return { total: 0, totalValue: 0, approvalRate: 0 };

    const totalValue = quotations.reduce((sum, q) => sum + parseSheetValue(q.Amount), 0);
    const approvedCount = quotations.filter(q => q.Status === 'Close (Win)').length;
    const consideredQuotes = quotations.filter(q => ['Close (Win)', 'Close (Lose)', 'Cancel'].includes(q.Status)).length;
    const approvalRate = consideredQuotes > 0 ? (approvedCount / consideredQuotes) * 100 : 0;
    
    return {
        total: quotations.length,
        totalValue,
        approvalRate,
    };
  }, [quotations]);

  const filteredData = useMemo(() => {
    const dataToFilter = quotations || [];
    if (!searchQuery) return dataToFilter;

    return dataToFilter.filter(item =>
        ['Quote No.', 'Company Name', 'Contact Name', 'Status', 'Reason'].some(key =>
            String(item[key as keyof Quotation] ?? '').toLowerCase().includes(searchQuery.toLowerCase())
        )
    );
  }, [quotations, searchQuery]);

  const columns = useMemo<ColumnDef<Quotation>[]>(() => [
    {
      accessorKey: 'Quote No.',
      header: 'Quote No.',
      isSortable: true,
      cell: (value: string, row) => (
        <div className="font-semibold text-slate-800">
           <FileLinkCell
              fileFormula={row.File}
              sheetId={quotationSheetId}
              label={value}
            />
        </div>
      )
    },
    {
      accessorKey: 'Quote Date',
      header: 'Quote Date',
      isSortable: true,
      cell: (value: string) => {
        const date = parseDate(value);
        return date ? formatDateAsMDY(date) : <span className="text-slate-400 italic">N/A</span>;
      }
    },
    {
      accessorKey: 'Company Name',
      header: 'Company Name',
      isSortable: true,
      cell: (value: string) => (
         <button
          onClick={(e) => {
            e.stopPropagation();
            if(value) handleNavigation({ view: 'companies', filter: value });
          }}
          className="group font-semibold text-base text-slate-800 hover:underline transition-colors inline-flex items-center gap-1.5 text-left"
          aria-label={`View company: ${value}`}
        >
          {value}
        </button>
      )
    },
     {
      accessorKey: 'Contact Name',
      header: 'Contact Name',
      isSortable: true,
      cell: (value: string) => (
         <button
          onClick={(e) => {
            e.stopPropagation();
            if(value) handleNavigation({ view: 'contacts', filter: value });
          }}
          className="group font-medium text-slate-800 hover:underline transition-colors inline-flex items-center gap-1.5 text-left"
          aria-label={`View contact: ${value}`}
        >
          {value}
        </button>
      )
    },
    { 
      accessorKey: 'Amount', 
      header: 'Amount', 
      isSortable: true, 
      cell: (value: string) => {
        const num = parseSheetValue(value);
        return (
            <span className="text-sm font-medium text-slate-800 text-right block w-full">
                {num > 0 ? num.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : '-'}
            </span>
        )
    }},
    { accessorKey: 'Status', header: 'Status', isSortable: true, cell: (value: Quotation['Status']) => <StatusBadge status={value} /> },
    {
      accessorKey: 'Created By',
      header: 'Created By',
      isSortable: true,
      cell: (value: string) => <span className="font-medium text-slate-800">{value}</span>
    },
  ], [handleNavigation, quotationSheetId]);

  if (isCreating) {
    return <QuotationCreator onBack={handleBackToDashboard} existingQuotation={selectedQuotation} />;
  }

  if (error) {
    return (
      <div className="p-6 md:p-8">
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg" role="alert">
          <p className="font-bold">Error</p>
          <p>Could not load quotations data: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <MetricCard title="Total Quotations" value={metrics.total.toString()} change="" changeType="increase" icon={<FileText />} isCompact/>
        <MetricCard title="Total Quoted Value" value={metrics.totalValue.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 })} change="" changeType="increase" icon={<DollarSign />} isCompact/>
        <MetricCard title="Approval Rate" value={`${metrics.approvalRate.toFixed(0)}%`} change="" changeType="increase" icon={<CheckCircle />} isCompact/>
      </div>
      <div className="bg-white rounded-xl border border-slate-200/70 shadow-sm">
        <div className="p-4 sm:p-6 flex flex-col sm:flex-row justify-between sm:items-center flex-wrap gap-4">
            <div className="flex items-center gap-4">
                <h2 className="text-xl font-semibold text-gray-900">All Quotations</h2>
                <button
                    onClick={handleNewQuotation}
                    className="flex items-center justify-center bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2 px-3 rounded-lg transition duration-200 shadow-sm hover:shadow-md transform hover:-translate-y-px"
                >
                    <svg className="w-5 h-5 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                    <span className="hidden sm:inline">New Quotation</span>
                </button>
            </div>
             <div className="relative w-full sm:w-auto">
                <label htmlFor="datatable-search" className="sr-only">Search</label>
                <input
                  id="datatable-search"
                  type="text"
                  placeholder="Search quotations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-white border border-gray-300 text-gray-800 placeholder-gray-400 text-sm rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 block w-full pl-10 p-2.5 transition"
                />
                <svg className="w-5 h-5 text-gray-400 absolute top-1/2 left-3 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            </div>
        </div>
        <DataTable
          tableId="quotation-table"
          data={filteredData}
          columns={columns}
          loading={loading}
          onRowClick={handleViewQuotation}
          initialSort={{ key: 'Quote Date', direction: 'descending' }}
        />
      </div>
       <QuotationDetailModal
        quotation={viewedQuotation}
        onClose={() => setViewedQuotation(null)}
        onEditRequest={handleEditQuotation}
      />
    </div>
  );
};

export default QuotationDashboard;