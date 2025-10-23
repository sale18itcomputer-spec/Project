import React, { useState, useMemo } from 'react';
import { Contact, PipelineProject } from '../types';
import { useData } from '../contexts/DataContext';
import NewContactModal from './NewContactModal';
import Spinner from './Spinner';
import EmptyState from './EmptyState';
// FIX: Replaced non-modular local icon imports with icons from the 'lucide-react' library.
import { Users, LayoutGrid, Table } from 'lucide-react';
import ViewToggle from './ViewToggle';
import DataTable, { ColumnDef } from './DataTable';
import ItemActionsMenu from './ItemActionsMenu';
import ConfirmationModal from './ConfirmationModal';
import { deleteRecord } from '../services/api';
import { formatDateAsMDY, parseDate } from '../utils/time';
import { parseSheetValue } from '../utils/formatters';

interface ContactDashboardProps {
  initialFilter?: string;
}

type ViewMode = 'grid' | 'list';

const VIEW_OPTIONS: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
    { id: 'list', label: 'Table', icon: <Table /> },
    { id: 'grid', label: 'Grid', icon: <LayoutGrid /> },
];

type ProcessedContact = Contact & {
  status: 'Active' | 'Inactive';
  totalAmount: number;
};


const ContactCard: React.FC<{ 
  contact: ProcessedContact, 
  onView: () => void, 
  onEdit: () => void, 
  onDelete: () => void 
}> = ({ contact, onView, onEdit, onDelete }) => {
  return (
    <div className="w-full bg-white rounded-lg shadow-sm border border-slate-200/80 hover:shadow-md hover:border-slate-300 transition-all duration-200 relative group flex flex-col">
       <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
         <ItemActionsMenu onView={onView} onEdit={onEdit} onDelete={onDelete} />
      </div>
      <button 
        onClick={onView}
        className="w-full text-left p-4 h-full flex flex-col flex-grow"
      >
        <div className="min-w-0 flex-grow">
          <p className="font-semibold text-slate-900 truncate">{contact.Name}</p>
          <p className="text-sm text-slate-600 truncate mt-0.5">{contact.Role || 'No role specified'}</p>
          <p className="text-sm text-brand-600 font-medium truncate mt-2 hover:underline">{contact['Company Name']}</p>
        </div>
         {contact.totalAmount > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100">
              <p className="text-xs text-slate-600 font-medium">Won Pipeline Value</p>
              <p className="text-base font-semibold text-slate-800">
                {contact.totalAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
          </div>
        )}
      </button>
    </div>
  );
}

const ContactDashboard: React.FC<ContactDashboardProps> = ({ initialFilter }) => {
  const { contacts: contactData, projects, contactLogs, meetings, quotations, loading, error, companies, refetchData } = useData();
  const [modalConfig, setModalConfig] = useState<{ contact: Contact | null, isReadOnly: boolean, isOpen: boolean }>({ contact: null, isReadOnly: false, isOpen: false });
  const [searchQuery, setSearchQuery] = useState(initialFilter || '');
  const [companyFilter, setCompanyFilter] = useState<string>('All Companies');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [contactToDelete, setContactToDelete] = useState<Contact | null>(null);

  const handleCloseModal = () => setModalConfig(prev => ({ ...prev, isOpen: false }));
  const handleOpenNewContact = () => setModalConfig({ contact: null, isReadOnly: false, isOpen: true });
  const handleViewContact = (contact: ProcessedContact) => setModalConfig({ contact, isReadOnly: true, isOpen: true });
  const handleEditContact = (contact: ProcessedContact) => setModalConfig({ contact, isReadOnly: false, isOpen: true });
  const handleDeleteRequest = (contact: ProcessedContact) => setContactToDelete(contact);
  
  const handleConfirmDelete = async () => {
    if (!contactToDelete) return;
    try {
        await deleteRecord('Contact_List', contactToDelete['Customer ID']);
        await refetchData();
        setContactToDelete(null);
    } catch (e) {
        alert('Failed to delete contact. Please try again.');
        console.error(e);
    }
  };

  const validContacts = useMemo(() => {
    if (!contactData) return [];
    return contactData.filter(contact => contact.Name && contact.Name.trim() !== '');
  }, [contactData]);
  
  const processedData = useMemo<ProcessedContact[]>(() => {
    if (!validContacts || !projects) return [];

    return validContacts.map(contact => {
        const isActive = projects.some(p => p['Contact Name'] === contact.Name && p.Status === 'Quote Submitted');
        const totalAmount = projects
            .filter(p => p['Contact Name'] === contact.Name && p.Status === 'Close (win)')
            .reduce((sum, p) => sum + parseSheetValue(p['Bid Value']), 0);

        return {
            ...contact,
            status: isActive ? 'Active' : 'Inactive',
            totalAmount,
        };
    });
  }, [validContacts, projects]);

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

    if (searchQuery) {
      const lowercasedQuery = searchQuery.toLowerCase();
      data = data.filter(item =>
        ['Name', 'Company Name', 'Email', 'Role'].some(key =>
            String(item[key as keyof Contact] ?? '').toLowerCase().includes(lowercasedQuery)
        )
      );
    }
    
    return data;
  }, [processedData, searchQuery, companyFilter]);
  
  const columns = useMemo<ColumnDef<ProcessedContact>[]>(() => [
    {
        accessorKey: 'Customer ID',
        header: 'Customer ID',
        isSortable: true,
        cell: (value: string) => <div className="text-slate-600">{value}</div>,
    },
    {
        accessorKey: 'Created Date',
        header: 'Created Date',
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
    },
    {
        accessorKey: 'Name',
        header: 'Contact Name',
        isSortable: true,
        cell: (value: string) => (
            <span className="font-semibold text-slate-800">{value}</span>
        ),
    },
    {
        accessorKey: 'Role',
        header: 'Role',
        isSortable: true,
    },
    {
        accessorKey: 'totalAmount',
        header: 'Total Amount',
        isSortable: true,
        cell: (value: number) => {
            if (value === 0) return <span className="text-slate-400 text-right block w-full">-</span>;
            return (
              <span className="text-sm font-medium text-slate-800 text-right block w-full">
                {value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            );
        },
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
          <p>Could not load contact data: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header & Filter Section */}
       <div className="p-4 sm:px-6 bg-white border-b border-slate-200">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div className="flex items-center">
                <span className="text-lg font-semibold text-gray-800">{filteredData.length}</span>
                <span className="ml-2 text-sm text-slate-600">contacts</span>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
                <div className="relative flex-grow sm:w-64">
                    <label htmlFor="contact-search" className="sr-only">Search</label>
                    <svg className="w-5 h-5 text-gray-400 absolute top-1/2 left-3 -translate-y-1/2 z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                    <input
                      id="contact-search"
                      type="text"
                      placeholder="Search name, role, company..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-slate-100 border-transparent text-gray-800 placeholder-gray-400 text-sm rounded-lg focus:ring-2 focus:ring-brand-500/50 focus:bg-white focus:border-brand-500 block w-full pl-10 p-2.5 transition"
                    />
                </div>
                <select 
                    value={companyFilter} 
                    onChange={(e) => setCompanyFilter(e.target.value)}
                    className="bg-slate-100 border-transparent text-gray-800 text-sm rounded-lg focus:ring-2 focus:ring-brand-500/50 focus:bg-white focus:border-brand-500 block p-2.5 transition w-full sm:w-56"
                  >
                    {companyOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                <ViewToggle<ViewMode> views={VIEW_OPTIONS} activeView={viewMode} onViewChange={setViewMode} />
                <button
                    onClick={handleOpenNewContact}
                    className="flex-shrink-0 flex items-center justify-center bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2.5 px-4 rounded-lg transition duration-200 shadow-sm hover:shadow-md transform hover:-translate-y-px"
                >
                    <svg className="w-5 h-5 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                    <span className="hidden sm:inline">New</span>
                </button>
            </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {loading ? <Spinner size="lg" /> : (
          filteredData.length > 0 ? (
            viewMode === 'grid' ? (
              <div className="p-6 md:p-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredData.map(contact => (
                    <ContactCard 
                      key={contact['Customer ID']} 
                      contact={contact} 
                      onView={() => handleViewContact(contact)} 
                      onEdit={() => handleEditContact(contact)}
                      onDelete={() => handleDeleteRequest(contact)}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-white h-full">
                <DataTable
                  tableId="contact-table"
                  data={filteredData}
                  columns={columns}
                  loading={loading}
                  onRowClick={handleViewContact}
                  initialSort={{ key: 'Customer ID', direction: 'ascending' }}
                  highlightedCheck={(contact) => contact.status === 'Active'}
                />
              </div>
            )
          ) : (
            <div className="pt-16">
              <EmptyState illustration={<Users className="w-16 h-16 text-slate-300"/>}>
                <h3 className="mt-2 text-sm font-semibold text-gray-900">No contacts found</h3>
                <p className="mt-1 text-sm text-gray-500">Try adjusting your search or filters, or create a new contact.</p>
              </EmptyState>
            </div>
          )
        )}
      </div>

      <NewContactModal
        isOpen={modalConfig.isOpen}
        onClose={handleCloseModal}
        existingData={modalConfig.contact}
        initialReadOnly={modalConfig.isReadOnly}
        projects={projects || []}
        contactLogs={contactLogs || []}
        meetings={meetings || []}
        quotations={quotations || []}
      />
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