import React, { useState, useMemo, useEffect, useId } from 'react';
import { PricelistItem } from '../types';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { useB2B } from '../contexts/B2BContext';
import DataTable, { ColumnDef } from './DataTable';
import { parseSheetValue } from '../utils/formatters';
import { LayoutGrid, Table, ListTree, ChevronDown, ArrowRightToLine, WrapText, Scissors, Pencil } from 'lucide-react';
import ViewToggle from './ViewToggle';
import ItemActionsMenu from './ItemActionsMenu';
import NewPricelistItemModal from './NewPricelistItemModal';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import PricelistFilterBar from './PricelistFilterBar';
import { DataTableColumnToggle } from './DataTableColumnToggle';

const PriceCell: React.FC<{ value: string; currency?: PricelistItem['Currency'] }> = ({ value, currency }) => {
    const num = parseSheetValue(value);
    if (num === 0 && String(value || '').trim() === '') {
        return <span className="text-slate-400 text-right block w-full">-</span>;
    }

    const formatted = currency === 'KHR'
        ? `៛${num.toLocaleString('en-US')}`
        : num.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

    return (
        <span className="text-sm font-medium text-slate-800 text-right block w-full">
            {formatted}
        </span>
    );
};

const StatusBadge: React.FC<{ status?: string; className?: string }> = ({ status, className }) => {
    if (!status) return null;
    const lowerStatus = status.toLowerCase();

    let variant: 'destructive' | 'secondary' | 'outline' = 'secondary';
    let customClass = '';

    if (lowerStatus.includes('out of stock')) {
        variant = 'destructive';
    } else if (lowerStatus.includes('available')) {
        variant = 'outline';
        customClass = 'font-semibold text-emerald-700 border-emerald-500/80 bg-emerald-50';
    } else if (lowerStatus.includes('pre-order')) {
        variant = 'outline';
        customClass = 'font-semibold text-amber-700 border-amber-500/80 bg-amber-50';
    }

    return <Badge variant={variant} className={`${customClass} ${className}`}>{status}</Badge>;
};


const PricelistCard: React.FC<{
    item: ProcessedPricelistItem;
    onView: () => void;
    onEdit: () => void;
    onDelete: () => void;
}> = ({ item, onView, onEdit, onDelete }) => (
    <Card
        className="flex flex-col justify-between overflow-hidden transition-all duration-300 group relative cursor-pointer border hover:border-primary hover:shadow-xl hover:-translate-y-1.5"
        onClick={onView}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') ? onView() : undefined}
        tabIndex={0}
        role="button"
        aria-label={`View details for ${item.Model}`}
    >
        <div className="absolute top-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <ItemActionsMenu onView={onView} onEdit={onEdit} onDelete={onDelete} />
        </div>

        <CardHeader className="pb-2">
            <div className="flex justify-between items-start gap-2">
                <CardDescription className="pr-2 font-semibold text-xs uppercase tracking-wider text-slate-600">{item.Brand}</CardDescription>
                <StatusBadge status={item.Status} />
            </div>
            <CardTitle className="pt-0.5 group-hover:text-primary transition-colors text-lg leading-tight font-bold break-words">
                {item.Model}
            </CardTitle>
        </CardHeader>

        <CardContent className="flex-grow text-xs text-slate-600">
            <p>{item.Description}</p>
        </CardContent>

        <CardFooter className="flex justify-between items-end mt-auto pt-4 bg-slate-50/70 border-t">
            <div className="flex flex-col">
                <p className="text-2xl font-bold text-slate-900">
                    {item.Currency === 'KHR'
                        ? `៛${parseSheetValue(item['End User Price']).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                        : parseSheetValue(item['End User Price']).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 })
                    }
                </p>
            </div>
            {item.Promotion && (
                <div className="text-right max-w-[50%]">
                    <p className="text-xs font-semibold text-rose-500 truncate" title={item.Promotion}>{item.Promotion}</p>
                </div>
            )}
        </CardFooter>
    </Card>
);

const CategorySection: React.FC<{
    category: string;
    items: ProcessedPricelistItem[];
    onViewItem: (item: ProcessedPricelistItem) => void;
    onEditItem: (item: ProcessedPricelistItem) => void;
    onDeleteItem: (item: ProcessedPricelistItem) => void;
}> = ({ category, items, onViewItem, onEditItem, onDeleteItem }) => {
    const [isOpen, setIsOpen] = useState(true);
    const contentId = useId();

    return (
        <Card className="overflow-hidden transition-shadow hover:shadow-md">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex justify-between items-center p-4 hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-expanded={isOpen}
                aria-controls={contentId}
            >
                <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-lg text-slate-800">{category}</h3>
                    <Badge variant="secondary">{items.length}</Badge>
                </div>
                <ChevronDown className={`w-5 h-5 text-slate-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            <div id={contentId} className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                <div className="overflow-hidden">
                    <div className="border-t border-slate-200">
                        <ul className="divide-y divide-slate-100">
                            {items.map(item => (
                                <li key={item.Code} className="group relative" >
                                    <div
                                        className="grid grid-cols-[1fr_auto] items-center py-3 px-4 hover:bg-slate-50 cursor-pointer"
                                        onClick={() => onViewItem(item)}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onViewItem(item)}
                                    >
                                        <div className="min-w-0">
                                            <p className="font-semibold text-slate-900 truncate group-hover:text-primary">{item.Model}</p>
                                            <p className="text-sm text-slate-500 truncate font-mono">{item.Code}</p>
                                        </div>
                                        <div className="flex items-center gap-4 ml-4 flex-shrink-0">
                                            <div className="w-28 text-right">
                                                <PriceCell value={item['End User Price']} currency={item.Currency} />
                                            </div>
                                            <div className="w-24">
                                                <StatusBadge status={item.Status} />
                                            </div>
                                            <div className="w-10 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                                                <ItemActionsMenu
                                                    onView={() => onViewItem(item)}
                                                    onEdit={() => onEditItem(item)}
                                                    onDelete={() => onDeleteItem(item)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </Card>
    );
};


type ViewMode = 'table' | 'grid' | 'category';
type ProcessedPricelistItem = PricelistItem & { fullDescription: string };

const PRICELIST_COLUMNS_VISIBILITY_KEY = 'limperial-pricelist-columns-visibility';

const PricelistDashboard: React.FC = () => {
    const { pricelist, loading, error } = useData();

    const [modalConfig, setModalConfig] = useState<{ item: PricelistItem | null; isReadOnly: boolean; isOpen: boolean }>({ item: null, isReadOnly: false, isOpen: false });
    const [statusFilter, setStatusFilter] = useState<string | null>('Available');
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
    const [brandFilter, setBrandFilter] = useState<string[]>([]);
    const [viewMode, setViewMode] = useState<ViewMode>('table');
    const [renderStep, setRenderStep] = useState(0);
    const [cellWrapStyle, setCellWrapStyle] = useState<'overflow' | 'wrap' | 'clip' | 'nowrap'>('wrap');

    useEffect(() => {
        if (!loading) {
            const timer = setTimeout(() => setRenderStep(1), 100);
            return () => clearTimeout(timer);
        }
    }, [loading]);

    const handleCloseModal = () => setModalConfig({ item: null, isReadOnly: false, isOpen: false });
    const handleViewItem = (item: ProcessedPricelistItem) => setModalConfig({ item, isReadOnly: true, isOpen: true });
    const handleEditItem = (item: ProcessedPricelistItem) => setModalConfig({ item, isReadOnly: false, isOpen: true });
    const handleNewItem = () => setModalConfig({ item: null, isReadOnly: false, isOpen: true });
    const handleDeleteItem = (item: ProcessedPricelistItem) => {
        setModalConfig({ item, isReadOnly: true, isOpen: true });
    };

    const filterOptions = useMemo(() => {
        if (!pricelist) return { categories: [], brands: [] };
        const categories = new Set<string>();
        const brands = new Set<string>();
        pricelist.forEach(item => {
            if (item.Category) categories.add(item.Category);
            if (item.Brand) brands.add(item.Brand);
        });
        return {
            categories: [...Array.from(categories).sort()],
            brands: [...Array.from(brands).sort()],
        };
    }, [pricelist]);

    const filteredData = useMemo(() => {
        let data = pricelist || [];

        if (statusFilter) {
            data = data.filter(item => (item.Status || '').toLowerCase().includes(statusFilter.toLowerCase()));
        }

        if (categoryFilter.length > 0) {
            data = data.filter(item => item.Category && categoryFilter.includes(item.Category));
        }
        if (brandFilter.length > 0) {
            data = data.filter(item => item.Brand && brandFilter.includes(item.Brand));
        }
        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            data = data.filter(item =>
                Object.values(item).some(val =>
                    String(val).toLowerCase().includes(lowerQuery)
                )
            );
        }
        return data;
    }, [pricelist, searchQuery, categoryFilter, brandFilter, statusFilter]);

    const processedFilteredData: ProcessedPricelistItem[] = useMemo(() => {
        return filteredData.map(item => {
            const model = item.Model || '';
            const description = item.Description || '';
            const combined = `${model} ${description ? `(${description})` : ''}`.trim();
            return {
                ...item,
                fullDescription: combined,
            };
        });
    }, [filteredData]);

    const groupedByCategory = useMemo(() => {
        if (!processedFilteredData) return {};
        return processedFilteredData.reduce((acc, item) => {
            const category = item.Category || 'Uncategorized';
            if (!acc[category]) {
                acc[category] = [];
            }
            acc[category].push(item);
            return acc;
        }, {} as Record<string, ProcessedPricelistItem[]>);
    }, [processedFilteredData]);

    const allColumns = useMemo<ColumnDef<ProcessedPricelistItem>[]>(() => {
        const cols: ColumnDef<ProcessedPricelistItem>[] = [
            { accessorKey: 'Category', header: 'Category', isSortable: true },
            { accessorKey: 'Code', header: 'Code', isSortable: true, cell: (value: string) => <span className="font-semibold text-slate-800">{value}</span> },
            { accessorKey: 'Brand', header: 'Brand', isSortable: true },
            { accessorKey: 'Model', header: 'Model', isSortable: true },
            { accessorKey: 'Description', header: 'Description', isSortable: false, cell: (value: string) => <p className="text-sm text-slate-600 line-clamp-2 max-w-sm">{value}</p> },
            {
                accessorKey: 'fullDescription',
                header: 'Full Description',
                isSortable: true,
                cell: (value: string) => <p className="text-sm text-slate-600">{value}</p>
            },
            { accessorKey: 'End User Price', header: 'Unit Price', isSortable: true, cell: (value: string, row) => <PriceCell value={value} currency={row.Currency} /> },
            { accessorKey: 'Promotion', header: 'Promotion', isSortable: true, cell: (value: string) => <span className="text-sm font-medium text-rose-500">{value}</span> },
            { accessorKey: 'Status', header: 'Status', isSortable: true, cell: (value: string) => <StatusBadge status={value} /> },
        ];

        return cols;
    }, []);

    const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
        try {
            const saved = localStorage.getItem(PRICELIST_COLUMNS_VISIBILITY_KEY);
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
        const saved = localStorage.getItem(PRICELIST_COLUMNS_VISIBILITY_KEY);
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
                localStorage.setItem(PRICELIST_COLUMNS_VISIBILITY_KEY, JSON.stringify(Array.from(newSet)));
            } catch (e) {
                console.error("Failed to save visible columns to storage", e);
            }
            return newSet;
        });
    };

    const displayedColumns = useMemo(() => {
        return allColumns.filter(c => c.accessorKey && visibleColumns.has(c.accessorKey as string));
    }, [allColumns, visibleColumns]);


    const VIEW_OPTIONS: { id: ViewMode, label: string, icon: React.ReactNode }[] = [
        { id: 'table', label: 'Table', icon: <Table /> },
        { id: 'grid', label: 'Grid', icon: <LayoutGrid /> },
        { id: 'category', label: 'Category', icon: <ListTree /> },
    ];

    if (error) {
        return (
            <div className="p-6 md:p-8">
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg" role="alert">
                    <p className="font-bold">Error</p>
                    <p>Could not load pricelist data: {error}</p>
                </div>
            </div>
        );
    }

    const renderContent = () => {
        switch (viewMode) {
            case 'table':
                return (
                    <div className="h-full px-4 sm:px-6 pb-4 sm:pb-6">
                        <DataTable
                            tableId="pricelist-table"
                            data={processedFilteredData}
                            columns={displayedColumns}
                            loading={loading}
                            onRowClick={handleViewItem}
                            initialSort={{ key: 'Category', direction: 'ascending' }}
                            mobilePrimaryColumns={['Model', 'Brand', 'End User Price', 'Status']}
                            cellWrapStyle={cellWrapStyle}
                            renderRowActions={(row) => (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleEditItem(row);
                                    }}
                                    className="p-2 text-slate-400 hover:text-brand-600 transition"
                                >
                                    <Pencil size={16} />
                                </button>
                            )}
                        />
                    </div>
                );
            case 'grid':
                return (
                    <div className="px-4 sm:px-6 pb-4 sm:pb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                        {processedFilteredData.map(item => (
                            <PricelistCard
                                key={item.Code}
                                item={item}
                                onView={() => handleViewItem(item)}
                                onEdit={() => handleEditItem(item)}
                                onDelete={() => handleDeleteItem(item)}
                            />
                        ))}
                    </div>
                );
            case 'category':
                return (
                    <div className="px-4 sm:px-6 pb-4 sm:pb-6 space-y-4">
                        {Object.entries(groupedByCategory)
                            .sort(([catA], [catB]) => catA.localeCompare(catB))
                            .map(([category, items]) => (
                                <CategorySection
                                    key={category}
                                    category={category}
                                    items={items}
                                    onViewItem={handleViewItem}
                                    onEditItem={handleEditItem}
                                    onDeleteItem={handleDeleteItem}
                                />
                            ))}
                    </div>
                );
        }
    }

    return (
        <div className="h-full flex flex-col">
            <div className="p-4 lg:p-6 flex flex-col gap-4 bg-white border-b border-slate-200 flex-shrink-0">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <p className="text-base text-slate-600">
                        <span className="font-bold text-slate-800">{filteredData.length}</span> items found
                    </p>

                    <div className="flex flex-col lg:flex-row gap-3 w-full lg:w-auto items-start lg:items-center">
                        <div className="relative w-full lg:w-64 flex-shrink-0">
                            <label htmlFor="pricelist-search" className="sr-only">Search</label>
                            <input
                                id="pricelist-search"
                                type="text"
                                placeholder="Search pricelist..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="bg-slate-100 border-transparent text-gray-800 placeholder-gray-400 text-sm rounded-lg focus:ring-2 focus:ring-brand-500/50 focus:bg-white focus:border-brand-500 block w-full pl-10 p-2.5 transition"
                            />
                            <svg className="w-5 h-5 text-gray-400 absolute top-1/2 left-3 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                        </div>

                        <div className="flex items-center gap-2 w-full lg:w-auto overflow-x-auto no-scrollbar pb-1 lg:pb-0">
                            <ViewToggle<ViewMode> views={VIEW_OPTIONS} activeView={viewMode} onViewChange={setViewMode} />
                            {viewMode === 'table' && (
                                <>
                                    <div className="bg-slate-100 p-1 rounded-lg flex items-center gap-1 flex-shrink-0">
                                        <button
                                            onClick={() => setCellWrapStyle('overflow')}
                                            title="Overflow"
                                            className={`flex items-center justify-center p-1.5 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:ring-offset-1 ${cellWrapStyle === 'overflow'
                                                ? 'bg-white shadow-sm text-brand-700'
                                                : 'text-slate-500 hover:bg-white/60 hover:text-slate-700'
                                                }`}
                                            aria-pressed={cellWrapStyle === 'overflow'}
                                        >
                                            <ArrowRightToLine className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => setCellWrapStyle('wrap')}
                                            title="Wrap"
                                            className={`flex items-center justify-center p-1.5 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:ring-offset-1 ${cellWrapStyle === 'wrap'
                                                ? 'bg-white shadow-sm text-brand-700'
                                                : 'text-slate-500 hover:bg-white/60 hover:text-slate-700'
                                                }`}
                                            aria-pressed={cellWrapStyle === 'wrap'}
                                        >
                                            <WrapText className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => setCellWrapStyle('clip')}
                                            title="Clip"
                                            className={`flex items-center justify-center p-1.5 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:ring-offset-1 ${cellWrapStyle === 'clip'
                                                ? 'bg-white shadow-sm text-brand-700'
                                                : 'text-slate-500 hover:bg-white/60 hover:text-slate-700'
                                                }`}
                                            aria-pressed={cellWrapStyle === 'clip'}
                                        >
                                            <Scissors className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => setCellWrapStyle('nowrap')}
                                            title="No Wrap (Horizontal)"
                                            className={`flex items-center justify-center p-1.5 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:ring-offset-1 ${cellWrapStyle === 'nowrap'
                                                ? 'bg-white shadow-sm text-brand-700'
                                                : 'text-slate-500 hover:bg-white/60 hover:text-slate-700'
                                                }`}
                                            aria-pressed={cellWrapStyle === 'nowrap'}
                                        >
                                            <LayoutGrid className="w-4 h-4 rotate-90" />
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
                                onClick={handleNewItem}
                                className="flex-shrink-0 flex items-center justify-center bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2.5 px-4 rounded-lg transition duration-200 shadow-sm hover:shadow-md transform hover:-translate-y-px ml-auto lg:ml-0"
                            >
                                <svg className="w-5 h-5 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                                <span className="hidden sm:inline">New Item</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className={`flex-1 overflow-hidden bg-slate-50 transition-opacity duration-500 ${renderStep > 0 ? 'opacity-100' : 'opacity-0'} flex flex-col`}>
                <div className="p-4 sm:p-6 space-y-4">

                    <PricelistFilterBar
                        categories={filterOptions.categories}
                        brands={filterOptions.brands}
                        categoryFilter={categoryFilter}
                        brandFilter={brandFilter}
                        onCategoryChange={setCategoryFilter}
                        onBrandChange={setBrandFilter}
                    />
                </div>
                <div className={`flex-1 min-h-0 ${viewMode === 'table' ? 'overflow-hidden' : 'overflow-auto'}`}>
                    {renderContent()}
                </div>
            </div>

            <NewPricelistItemModal
                isOpen={modalConfig.isOpen}
                onClose={handleCloseModal}
                existingData={modalConfig.item}
                initialReadOnly={modalConfig.isReadOnly}
            />
            <footer className="flex-shrink-0 bg-card border-t border-border p-3 flex items-center gap-3">
                <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
                    <button
                        onClick={() => setStatusFilter(statusFilter === 'Available' ? null : 'Available')}
                        className={`whitespace-nowrap px-6 py-2 rounded-md border text-sm font-semibold transition ${statusFilter === 'Available' ? 'bg-brand-600 text-white border-brand-600 shadow-sm' : 'border-border bg-background text-muted-foreground hover:bg-muted'}`}
                    >
                        Available
                    </button>
                    <button
                        onClick={() => setStatusFilter(statusFilter === 'Out of Stock' ? null : 'Out of Stock')}
                        className={`whitespace-nowrap px-6 py-2 rounded-md border text-sm font-semibold transition ${statusFilter === 'Out of Stock' ? 'bg-brand-600 text-white border-brand-600 shadow-sm' : 'border-border bg-background text-muted-foreground hover:bg-muted'}`}
                    >
                        Out of Stock
                    </button>
                    <button
                        onClick={() => setStatusFilter(statusFilter === 'Pre-order' ? null : 'Pre-order')}
                        className={`whitespace-nowrap px-6 py-2 rounded-md border text-sm font-semibold transition ${statusFilter === 'Pre-order' ? 'bg-brand-600 text-white border-brand-600 shadow-sm' : 'border-border bg-background text-muted-foreground hover:bg-muted'}`}
                    >
                        Pre-order
                    </button>
                </div>
            </footer>
        </div>
    );
};

export default PricelistDashboard;