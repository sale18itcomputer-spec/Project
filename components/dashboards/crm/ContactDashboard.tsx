'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Contact } from "../../../types";
import { useData } from "../../../contexts/DataContext";
import { useWindowManager } from "../../../contexts/WindowManagerContext";
import ContactWindowContent from "../../windows/content/ContactWindowContent";
import Spinner from "../../common/Spinner";
import EmptyState from "../../common/EmptyState";
import { Users, LayoutGrid, Table, Pencil, Plus } from 'lucide-react';
import ViewToggle from "../../common/ViewToggle";
import DataTable, { ColumnDef, CellWrapStyle } from "../../common/DataTable";
import ItemActionsMenu from "../../common/ItemActionsMenu";
import ConfirmationModal from "../../modals/ConfirmationModal";
import { deleteRecord } from "../../../services/api";
import { formatDisplayDate } from "../../../utils/time";
import { parseSheetValue, formatMixedCurrency, determineCurrency } from "../../../utils/formatters";
import { useToast } from "../../../contexts/ToastContext";
import { DataTableColumnToggle } from "../../common/DataTableColumnToggle";
import { localStorageGet, localStorageSet } from '../../../utils/storage';
import { PermissionGate } from '../../common/PermissionGate';
import RowActionMenuItems from '../../common/RowActionMenuItems';
import DashboardHeader from '../../common/DashboardHeader';
import SearchInput from '../../common/SearchInput';
import CellWrapToggle from '../../common/CellWrapToggle';
import ErrorState from '../../common/ErrorState';
import { IconButton } from '../../ui/icon-button';
import { Button } from '../../ui/button';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';

interface ContactDashboardProps {
  initialFilter?: string;
}

type ViewMode = 'grid' | 'list';

const VIEW_OPTIONS: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
  { id: 'list', label: 'Table', icon: <Table /> },
  { id: 'grid', label: 'Grid', icon: <LayoutGrid /> },
];

const CONTACT_COLUMNS_VISIBILITY_KEY = 'limperial-contact-columns-visibility';

type ProcessedContact = Contact & {
  status: 'Active' | 'Inactive';
  totalAmountUSD: number;
  totalAmountKHR: number;
};

const _ContactMobileCard: React.FC<{ contact: ProcessedContact, onView: () => void }> = ({ contact, onView }) => (
  <div className="mobile-card" onClick={onView} role="button" tabIndex={0}>
    <div className="mobile-card-header">
      <div>
        <div className="mobile-card-title">{contact.Name}</div>
        <div className="mobile-card-subtitle">{contact.Role}</div>
      </div>
      <span className={`mobile-status ${contact.status === 'Active' ? 'mobile-status-success' : 'mobile-status-default'}`}>
        <span className="mobile-status-dot"></span>
        {contact.status}
      </span>
    </div>
    <div className="mobile-card-body">
      <div className="mobile-card-row">
        <span className="mobile-card-label">Company</span>
        <span className="mobile-card-value">{contact['Company Name']}</span>
      </div>
      <div className="mobile-card-row">
        <span className="mobile-card-label">Won Value</span>
        <span className="mobile-card-value">{formatMixedCurrency(contact.totalAmountUSD, contact.totalAmountKHR)}</span>
      </div>
    </div>
  </div>
);


const ContactCard: React.FC<{
  contact: ProcessedContact,
  onView: () => void,
  onEdit: () => void,
  onDelete: () => void
}> = ({ contact, onView, onEdit, onDelete }) => {
  return (
    <div className="w-full bg-card rounded-lg shadow-sm border border-border hover:shadow-md hover:border-primary/30 transition-all duration-200 relative group flex flex-col">
      <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <ItemActionsMenu onView={onView} onEdit={onEdit} onDelete={onDelete} module="contacts" />
      </div>
      <button
        onClick={onView}
        className="w-full text-left p-4 h-full flex flex-col flex-grow"
      >
        <div className="min-w-0 flex-grow">
          <p className="font-semibold text-foreground truncate">{contact.Name}</p>
          <p className="text-sm text-muted-foreground truncate mt-0.5">{contact.Role || 'No role specified'}</p>
          <p className="text-sm text-primary font-medium truncate mt-2 hover:underline">{contact['Company Name']}</p>
        </div>
        {(contact.totalAmountUSD > 0 || contact.totalAmountKHR > 0) && (
          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-xs text-muted-foreground font-medium">Won Pipeline Value</p>
            <p className="text-base font-semibold text-foreground">
              {formatMixedCurrency(contact.totalAmountUSD, contact.totalAmountKHR)}
            </p>
          </div>
        )}
      </button>
    </div>
  );
}

const ContactDashboard: React.FC<ContactDashboardProps> = ({ initialFilter }) => {
  const { contacts, setContacts, projects, saleOrders, loading, error, companies } = useData();
  const { openWindow } = useWindowManager();
  const { addToast } = useToast();
  const [searchQuery, setSearchQuery] = useState(initialFilter || '');
  const debouncedSearch = useDebouncedValue(searchQuery);
  const [companyFilter, setCompanyFilter] = useState<string>('All Companies');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [cellWrapStyle, setCellWrapStyle] = useState<CellWrapStyle>('nowrap');
  const [contactToDelete, setContactToDelete] = useState<Contact | null>(null);

  const handleDeleteRequest = (contact: ProcessedContact) => setContactToDelete(contact);

  const handleConfirmDelete = async () => {
    if (!contactToDelete) return;

    const originalContacts = contacts ? [...contacts] : [];
    const contactToDeleteId = contactToDelete['Customer ID'];

    setContactToDelete(null); // Close confirmation modal

    // Optimistic update
    setContacts(current => current ? current.filter(c => c['Customer ID'] !== contactToDeleteId) : null);

    try {
      const response: { deletedId: string } = await deleteRecord('Contact_List', contactToDeleteId);
      if (response.deletedId === contactToDeleteId) {
        addToast('Contact deleted!', 'success');
      } else {
        throw new Error("Backend did not confirm deletion.");
      }
    } catch (err: any) {
      addToast(`Failed to delete contact: ${err.message}`, 'error');
      setContacts(originalContacts); // Revert on error
    }
  };

  const validContacts = useMemo(() => {
    if (!contacts) return [];
    return contacts.filter(contact => contact.Name && contact.Name.trim() !== '');
  }, [contacts]);

  const processedData = useMemo<ProcessedContact[]>(() => {
    if (!validContacts) return [];

    return validContacts.map(contact => {
      const contactName = contact.Name;
      const isActive = projects?.some(p => p['Contact Name'] === contactName && p.Status === 'Proposal Submission') || false;

      // Calculate total from completed Sale Orders, excluding VAT
      const { totalAmountUSD, totalAmountKHR } = saleOrders
        ? saleOrders
          .filter(so => so['Contact Name'] === contactName && so.Status === 'Completed')
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
              acc.totalAmountKHR += subtotal;
            } else {
              acc.totalAmountUSD += subtotal;
            }
            return acc;
          }, { totalAmountUSD: 0, totalAmountKHR: 0 })
        : { totalAmountUSD: 0, totalAmountKHR: 0 };

      return {
        ...contact,
        status: isActive ? 'Active' : 'Inactive',
        totalAmountUSD,
        totalAmountKHR,
      };
    });
  }, [validContacts, projects, saleOrders]);

  const openContactWindow = (contactId: string | null) => {
    const id = `contact-${contactId ?? 'new'}`;
    openWindow({
      id,
      title: contactId ? 'Contact' : 'Create New Contact',
      content: <ContactWindowContent windowId={id} contactId={contactId} />,
      initialWidth: 640,
      initialHeight: 700,
      minWidth: 500,
      minHeight: 400,
      detachUrl: contactId ? `/standalone/contact/${encodeURIComponent(contactId)}` : undefined,
    });
  };

  const companyOptions = useMemo(() => {
    if (!companies) return ['All Companies'];
    const companyNames = new Set(companies.map(c => c['Company Name']).filter(Boolean));
    return ['All Companies', ...Array.from(companyNames).sort()];
  }, [companies]);

  const filteredData = useMemo(() => {
    let data = processedData;

    if (companyFilter !== 'All Companies') {
      data = data.filter(c => c['Company Name'] === companyFilter);
    }

    if (debouncedSearch) {
      const lowercasedQuery = debouncedSearch.toLowerCase();
      data = data.filter(item =>
        ['Name', 'Company Name', 'Email', 'Role'].some(key =>
          String(item[key as keyof Contact] ?? '').toLowerCase().includes(lowercasedQuery)
        )
      );
    }

    return data;
  }, [processedData, debouncedSearch, companyFilter]);

  const allColumns = useMemo<ColumnDef<ProcessedContact>[]>(() => [
    {
      accessorKey: 'Customer ID',
      header: 'Customer ID',
      isSortable: true,
      cell: (value: string) => <div className="text-muted-foreground">{value}</div>,
    },
    {
      accessorKey: 'Created Date',
      header: 'Created Date',
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
    },
    {
      accessorKey: 'Name',
      header: 'Contact Name',
      isSortable: true,
      cell: (value: string) => (
        <span className="font-semibold text-foreground">{value}</span>
      ),
    },
    {
      accessorKey: 'Role',
      header: 'Role',
      isSortable: true,
    },
    {
      accessorKey: 'totalAmountUSD',
      header: 'Total Amount',
      isSortable: true,
      cell: (_, row) => {
        const displayValue = formatMixedCurrency(row.totalAmountUSD, row.totalAmountKHR);
        if (displayValue === '$0') return <span className="text-muted-foreground/50 text-right block w-full">-</span>;
        return (
          <span className="text-sm font-medium text-foreground text-right block w-full">
            {displayValue}
          </span>
        );
      },
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
      const saved = localStorageGet(CONTACT_COLUMNS_VISIBILITY_KEY);
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
    const saved = localStorageGet(CONTACT_COLUMNS_VISIBILITY_KEY);
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
        localStorageSet(CONTACT_COLUMNS_VISIBILITY_KEY, JSON.stringify(Array.from(newSet)));
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
    return <ErrorState title="Could not load contact data" message={error} />;
  }


  return (
    <div className="h-full flex flex-col">
      {/* Header & Filter Section */}
      <DashboardHeader
        title="Contacts"
        icon={<Users />}
        subtitle={`${filteredData.length} contacts`}
      >
        <SearchInput
          id="contact-search"
          value={searchQuery}
          onValueChange={setSearchQuery}
          placeholder="Search name, role, company..."
          label="Search contacts"
        />

        <select
          value={companyFilter}
          onChange={(e) => setCompanyFilter(e.target.value)}
          aria-label="Filter by company"
          className="h-9 flex-shrink-0 rounded-md border border-border bg-muted px-2 text-sm text-foreground shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring dark:[color-scheme:dark]"
        >
          {companyOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>

        <ViewToggle<ViewMode> views={VIEW_OPTIONS} activeView={viewMode} onViewChange={setViewMode} />

        {viewMode === 'list' && (
          <>
            <CellWrapToggle value={cellWrapStyle} onChange={setCellWrapStyle} />

            <DataTableColumnToggle
              allColumns={allColumns}
              visibleColumns={visibleColumns}
              onColumnToggle={handleColumnToggle}
            />
          </>
        )}

        <PermissionGate module="contacts" action="create">
          <Button onClick={() => openContactWindow(null)} aria-label="New contact">
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">New</span>
          </Button>
        </PermissionGate>
      </DashboardHeader>

      {/* Main Content */}
      <div className={`flex-1 min-h-0 ${viewMode === 'list' ? 'overflow-hidden p-4' : 'overflow-auto p-6'}`}>
        {loading ? <Spinner size="lg" /> : (
          viewMode === 'grid' ? (
            filteredData.length > 0 ? (
              <div className="p-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredData.map(contact => (
                    <ContactCard
                      key={contact['Customer ID']}
                      contact={contact}
                      onView={() => openContactWindow(contact['Customer ID'])}
                      onEdit={() => openContactWindow(contact['Customer ID'])}
                      onDelete={() => handleDeleteRequest(contact)}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="pt-16">
                <EmptyState illustration={<Users className="w-16 h-16 text-muted-foreground/30" />}>
                  <h3 className="mt-2 text-sm font-semibold text-foreground">No contacts found</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Try adjusting your search or filters, or create a new contact.</p>
                </EmptyState>
              </div>
            )
          ) : (
            <div className="h-full">
              <DataTable
                tableId="contact-table"
                data={filteredData}
                columns={displayedColumns}
                loading={loading}
                onRowClick={(row) => openContactWindow(row['Customer ID'])}
                initialSort={{ key: 'Customer ID', direction: 'descending' }}
                highlightedCheck={(contact) => contact.status === 'Active'}
                mobilePrimaryColumns={['Name', 'Company Name', 'status']}
                cellWrapStyle={cellWrapStyle}
                emptyState={{
                  title: 'No contacts found',
                  description: 'Try adjusting your search or filters, or create a new contact.',
                }}
                renderRowActions={(row) => (
                  <IconButton
                    label="Open contact"
                    tone="primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      openContactWindow(row['Customer ID']);
                    }}
                  >
                    <Pencil size={16} aria-hidden="true" />
                  </IconButton>
                )}
                renderRowContextMenu={(row) => (
                  <RowActionMenuItems
                    onOpenWindow={() => openContactWindow(row['Customer ID'])}
                    onView={() => openContactWindow(row['Customer ID'])}
                    onEdit={() => openContactWindow(row['Customer ID'])}
                  />
                )}
              />
            </div>
          )
        )}
      </div>

      <ConfirmationModal
        isOpen={!!contactToDelete}
        onClose={() => setContactToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Contact"
        confirmText="Delete"
      >
        Are you sure you want to delete the contact "{contactToDelete?.Name}"? This action cannot be undone.
      </ConfirmationModal>
    </div>
  );
};

export default React.memo(ContactDashboard);
