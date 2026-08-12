'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Company } from "../../../types";
import { useB2BData } from "../../../hooks/useB2BData";
import { useWindowManager } from "../../../contexts/WindowManagerContext";
import CompanyWindowContent from "../../windows/content/CompanyWindowContent";
import { Building2, Pencil, Plus } from 'lucide-react';
import { parseSheetValue, formatMixedCurrency, determineCurrency } from "../../../utils/formatters";
import DataTable, { ColumnDef, CellWrapStyle } from "../../common/DataTable";
import { parseDate, formatDisplayDate } from "../../../utils/time";
import { DataTableColumnToggle } from "../../common/DataTableColumnToggle";
import { localStorageGet, localStorageSet } from '../../../utils/storage';
import { PermissionGate } from '../../common/PermissionGate';
import RowActionMenuItems from '../../common/RowActionMenuItems';
import DashboardHeader from '../../common/DashboardHeader';
import SearchInput from '../../common/SearchInput';
import CellWrapToggle from '../../common/CellWrapToggle';
import ErrorState from '../../common/ErrorState';
import IconButton from '../../ui/icon-button';
import { Button } from '../../ui/button';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';


interface CompanyDashboardProps {
  initialFilter?: string;
}

const COMPANY_COLUMNS_VISIBILITY_KEY = 'limperial-company-columns-visibility';

type ProcessedCompany = Company & {
  totalValueUSD: number;
  totalValueKHR: number;
  status: 'Active' | 'Inactive';
};

const _CompanyMobileCard: React.FC<{ company: ProcessedCompany; onView: () => void }> = ({ company, onView }) => (
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
  const { companies: companyData, saleOrders, loading, error } = useB2BData();
  const { openWindow } = useWindowManager();
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebouncedValue(searchQuery);
  const autoOpenedRef = useRef<string | null>(null);
  const [cellWrapStyle, setCellWrapStyle] = useState<CellWrapStyle>('nowrap');

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
  }, [validCompanies, saleOrders]);

  const filteredData = useMemo(() => {
    if (!debouncedSearch) return processedData;
    const lowercasedQuery = debouncedSearch.toLowerCase();
    return processedData.filter(item =>
      ['Company Name', 'Company ID', 'Field', 'Phone Number'].some(key =>
        String(item[key as keyof Company] ?? '').toLowerCase().includes(lowercasedQuery)
      )
    );
  }, [processedData, debouncedSearch]);

  const openCompanyWindow = (companyId: string | null) => {
    const id = `company-${companyId ?? 'new'}`;
    openWindow({
      id,
      title: companyId ? 'Company' : 'Create New Company',
      content: <CompanyWindowContent windowId={id} companyId={companyId} />,
      initialWidth: 700,
      initialHeight: 750,
      minWidth: 500,
      minHeight: 400,
      detachUrl: companyId ? `/standalone/company/${encodeURIComponent(companyId)}` : undefined,
    });
  };

  // Auto-open when navigated here with an initialFilter
  useEffect(() => {
    if (!initialFilter || filteredData.length === 0) return;
    const found = filteredData.find(c => c['Company Name'] === initialFilter || c['Company ID'] === initialFilter);
    if (found && autoOpenedRef.current !== found['Company ID']) {
      autoOpenedRef.current = found['Company ID'];
      openCompanyWindow(found['Company ID']);
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
      cell: (value: string) => formatDisplayDate(value),
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
      const saved = localStorageGet(COMPANY_COLUMNS_VISIBILITY_KEY);
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
    const saved = localStorageGet(COMPANY_COLUMNS_VISIBILITY_KEY);
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
        localStorageSet(COMPANY_COLUMNS_VISIBILITY_KEY, JSON.stringify(Array.from(newSet)));
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
    return <ErrorState title="Could not load companies" message={error} />;
  }


  return (
    <div className="h-full flex flex-col">
      <DashboardHeader
        title="Companies"
        icon={<Building2 />}
        subtitle={`${filteredData.length} companies`}
      >
        <SearchInput
          id="company-search"
          value={searchQuery}
          onValueChange={setSearchQuery}
          placeholder="Search companies..."
          label="Search companies"
        />

        <CellWrapToggle value={cellWrapStyle} onChange={setCellWrapStyle} />

        <DataTableColumnToggle
          allColumns={allColumns}
          visibleColumns={visibleColumns}
          onColumnToggle={handleColumnToggle}
        />

        <PermissionGate module="companies" action="create">
          <Button onClick={() => openCompanyWindow(null)} aria-label="New company">
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">New</span>
          </Button>
        </PermissionGate>
      </DashboardHeader>

      <div className="flex-1 min-h-0 overflow-hidden p-4">
        <div className="h-full">
          <DataTable
            tableId="company-table"
            data={filteredData}
            columns={displayedColumns}
            loading={loading}
            onRowClick={(row) => openCompanyWindow(row['Company ID'])}
            initialSort={{ key: 'Company ID', direction: 'descending' }}
            mobilePrimaryColumns={['Company Name', 'Field', 'totalValueUSD', 'status']}
            cellWrapStyle={cellWrapStyle}
            emptyState={{
              title: 'No companies yet',
              description: 'Companies you add will appear here.',
            }}
            renderRowActions={(row) => (
              <IconButton
                label="Open company"
                tone="primary"
                onClick={(e) => {
                  e.stopPropagation();
                  openCompanyWindow(row['Company ID']);
                }}
              >
                <Pencil size={16} aria-hidden="true" />
              </IconButton>
            )}
            renderRowContextMenu={(row) => (
              <RowActionMenuItems
                onOpenWindow={() => openCompanyWindow(row['Company ID'])}
                onView={() => openCompanyWindow(row['Company ID'])}
                onEdit={() => openCompanyWindow(row['Company ID'])}
              />
            )}
          />
        </div>
      </div>

    </div>
  );
};

export default React.memo(CompanyDashboard);
