'use client';

import React, { useState, useMemo, useEffect, useId } from 'react';
import { PricelistItem } from "../../../types";
import { useData } from "../../../contexts/DataContext";
import { useAuth } from "../../../contexts/AuthContext";
import { useB2B } from "../../../contexts/B2BContext";
import DataTable, { ColumnDef } from "../../common/DataTable";
import { parseSheetValue } from "../../../utils/formatters";
import { LayoutGrid, Table, ListTree, ChevronDown, ArrowRightToLine, WrapText, Scissors, Pencil } from 'lucide-react';
import ViewToggle from "../../common/ViewToggle";
import ItemActionsMenu from "../../common/ItemActionsMenu";
import NewPricelistItemModal from "../../modals/NewPricelistItemModal";
import { useNavigation } from "../../../contexts/NavigationContext";
import { ShieldCheck, TrendingUp, Info } from 'lucide-react';
import { localStorageGet, localStorageSet } from '../../../utils/storage';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../../ui/card";
import { Badge } from "../../ui/badge";
import PricelistFilterBar from "../components/PricelistFilterBar";
import { DataTableColumnToggle } from "../../common/DataTableColumnToggle";

const PriceCell: React.FC<{ value: string; currency?: PricelistItem['Currency'] }> = ({ value, currency }) => {
    const num = parseSheetValue(value);
    if (num === 0 && String(value || '').trim() === '') {
        return <span className="text-muted-foreground/40 text-right block w-full">-</span>;
    }

    const formatted = currency === 'KHR'
        ? `៛${num.toLocaleString('en-US')}`
        : num.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

    return (
        <span className="text-sm font-medium text-foreground text-right block w-full">
            {formatted}
        </span>
    );
};

const DealerPriceCell: React.FC<{ value: string; currency?: PricelistItem['Currency'] }> = ({ value, currency }) => {

    const num = parseSheetValue(value);
    if (num === 0 && String(value || '').trim() === '') {
        return <span className="text-muted-foreground/40 text-right block w-full">-</span>;
    }

    const formatted = currency === 'KHR'
        ? `៛${num.toLocaleString('en-US')}`
        : num.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

    return (
        <span className="text-sm font-medium text-foreground text-right block w-full">
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
        customClass = 'font-semibold text-emerald-500 border-emerald-500/20 bg-emerald-500/10';
    } else if (lowerStatus.includes('pre-order')) {
        variant = 'outline';
        customClass = 'font-semibold text-amber-500 border-amber-500/20 bg-amber-500/10';
    }

    return <Badge variant={variant} className={`${customClass} ${className}`}>{status}</Badge>;
};


const PricelistCard: React.FC<{
    item: ProcessedPricelistItem;
    onView: () => void;
    onEdit: () => void;
    onDelete: () => void;
    showDealerPrice?: boolean;
}> = ({ item, onView, onEdit, onDelete, showDealerPrice = true }) => (
    <Card
        className="flex flex-col justify-between overflow-hidden transition-all duration-300 group relative border hover:shadow-md"
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') ? onView() : undefined}
        tabIndex={0}
        role="article"
        aria-label={`Product card for ${item.Model}`}
    >
        <div className="absolute top-3 right-3 z-10 opacity-100 transition-opacity duration-300">
            <ItemActionsMenu onView={onView} onEdit={onEdit} onDelete={onDelete} />
        </div>

        <CardHeader className="pb-2">
            <div className="flex justify-between items-start gap-2">
                <CardDescription className="pr-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground">{item.Brand}</CardDescription>
                <StatusBadge status={item.Status} />
            </div>
            <CardTitle className="pt-0.5 group-hover:text-primary transition-colors text-lg leading-tight font-bold break-words text-foreground">
                {item.Model}
            </CardTitle>
        </CardHeader>

        <CardContent className="flex-grow text-xs text-muted-foreground">
            <p>{item.Description}</p>
        </CardContent>

        <CardFooter className="flex justify-between items-end mt-auto pt-4 bg-muted/30 border-t">
            <div className="flex flex-col">
                {showDealerPrice && (
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-tight">Dealer:
                        <span className="ml-1 text-foreground">
                            {item.Currency === 'KHR'
                                ? `៛${parseSheetValue(item['Dealer Price']).toLocaleString('en-US')}`
                                : parseSheetValue(item['Dealer Price']).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
                            }
                        </span>
                    </p>
                )}
                <p className="text-2xl font-bold text-foreground">
                    {item.Currency === 'KHR'
                        ? `៛${parseSheetValue(item['End User Price']).toLocaleString('en-US')}`
                        : parseSheetValue(item['End User Price']).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
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
    showDealerPrice?: boolean;
}> = ({ category, items, onViewItem, onEditItem, onDeleteItem, showDealerPrice = true }) => {
    const [isOpen, setIsOpen] = useState(true);
    const contentId = useId();

    return (
        <Card className="overflow-hidden transition-shadow hover:shadow-md">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex justify-between items-center p-4 hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-expanded={isOpen}
                aria-controls={contentId}
            >
                <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-lg text-foreground">{category}</h3>
                    <Badge variant="secondary">{items.length}</Badge>
                </div>
                <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            <div id={contentId} className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                <div className="overflow-hidden">
                    <div className="border-t border-border">
                        <ul className="divide-y divide-border/40">
                            {items.map(item => (
                                <li key={item.Code} className="group relative" >
                                    <div
                                        className="grid grid-cols-[1fr_auto] items-center py-3 px-4 hover:bg-muted/30"
                                        role="presentation"
                                    >
                                        <div className="min-w-0">
                                            <p className="font-semibold text-foreground truncate group-hover:text-primary">{item.Model}</p>
                                            <p className="text-sm text-muted-foreground truncate font-mono">{item.Code}</p>
                                        </div>
                                        <div className="flex items-center gap-4 ml-4 flex-shrink-0">
                                            {showDealerPrice && (
                                                <div className="w-28 text-right hidden md:block">
                                                    <div className="text-[10px] text-muted-foreground/60 font-semibold uppercase">Dealer</div>
                                                    <PriceCell value={item['Dealer Price']} currency={item.Currency} />
                                                </div>
                                            )}
                                            <div className="w-28 text-right">
                                                {showDealerPrice && <div className="text-[10px] text-muted-foreground/60 font-semibold uppercase md:hidden">Dealer: {item['Dealer Price']}</div>}
                                                <div className="text-[10px] text-muted-foreground/60 font-semibold uppercase hidden md:block">End User</div>
                                                <PriceCell value={item['End User Price']} currency={item.Currency} />
                                            </div>
                                            <div className="w-24">
                                                <StatusBadge status={item.Status} />
                                            </div>
                                            <div className="w-10 transition-opacity" onClick={(e) => e.stopPropagation()}>
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

const B2B_PRICELIST_COLUMNS_VISIBILITY_KEY = 'limperial-b2b-pricelist-columns-visibility';

const B2BPricelistDashboard: React.FC = () => {
    const { pricelist, loading, error } = useData();
    const { currentUser } = useAuth();
    const { isB2B } = useB2B();

    // Restricted access for B2B Pricelist
    const canAccess = useMemo(() => {
        const role = currentUser?.Role?.toLowerCase();
        return role === 'admin' || role === 'b2b' || isB2B;
    }, [currentUser, isB2B]);

    if (!canAccess) {
        return (
            <div className="p-6 md:p-8 flex items-center justify-center h-full">
                <div className="text-center">
                    <h2 className="text-xl font-bold text-foreground mb-2">Access Restricted</h2>
                    <p className="text-muted-foreground">You do not have permission to view the B2B Pricelist.</p>
                </div>
            </div>
        );
    }

    const { handleNavigation, navigation } = useNavigation();
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

    const modalConfig = useMemo(() => {
        const isOpen = !!navigation.action && ['create', 'view', 'edit'].includes(navigation.action);
        const isReadOnly = navigation.action === 'view';
        const item = navigation.id && pricelist ? pricelist.find(i => i.Code === navigation.id) || null : null;
        return { item, isReadOnly, isOpen };
    }, [navigation.action, navigation.id, pricelist]);

    const handleCloseModal = () => handleNavigation({ view: 'b2b-pricelist', filter: navigation.filter });
    const handleViewItem = (item: ProcessedPricelistItem) => handleNavigation({ view: 'b2b-pricelist', filter: navigation.filter, action: 'view', id: item.Code });
    const handleEditItem = (item: ProcessedPricelistItem) => handleNavigation({ view: 'b2b-pricelist', filter: navigation.filter, action: 'edit', id: item.Code });
    const handleNewItem = () => handleNavigation({ view: 'b2b-pricelist', filter: navigation.filter, action: 'create' });
    const handleDeleteItem = (item: ProcessedPricelistItem) => handleNavigation({ view: 'b2b-pricelist', filter: navigation.filter, action: 'view', id: item.Code });

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
    }, [pricelist, searchQuery, categoryFilter, brandFilter]);

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
            { accessorKey: 'Code', header: 'Code', isSortable: true, cell: (value: string) => <span className="font-semibold text-foreground">{value}</span> },
            { accessorKey: 'Brand', header: 'Brand', isSortable: true },
            { accessorKey: 'Model', header: 'Model', isSortable: true },
            { accessorKey: 'Description', header: 'Description', isSortable: false, cell: (value: string) => <p className="text-sm text-muted-foreground line-clamp-2 max-w-sm">{value}</p> },
            {
                accessorKey: 'fullDescription',
                header: 'Full Description',
                isSortable: true,
                cell: (value: string) => <p className="text-sm text-muted-foreground">{value}</p>
            },
            {
                accessorKey: 'Dealer Price',
                header: 'Dealer Price',
                isSortable: true,
                cell: (value: string, row) => <DealerPriceCell value={value} currency={row.Currency} />
            },
            { accessorKey: 'End User Price', header: 'Unit Price', isSortable: true, cell: (value: string, row) => <PriceCell value={value} currency={row.Currency} /> },
            { accessorKey: 'Promotion', header: 'Promotion', isSortable: true, cell: (value: string) => <span className="text-sm font-medium text-rose-500">{value}</span> },
            { accessorKey: 'Status', header: 'Status', isSortable: true, cell: (value: string) => <StatusBadge status={value} /> },
        ];
        return cols;
    }, []);

    const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
        try {
            const saved = localStorageGet(B2B_PRICELIST_COLUMNS_VISIBILITY_KEY);
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
        const saved = localStorageGet(B2B_PRICELIST_COLUMNS_VISIBILITY_KEY);
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
                localStorageSet(B2B_PRICELIST_COLUMNS_VISIBILITY_KEY, JSON.stringify(Array.from(newSet)));
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
                            tableId="b2b-pricelist-table"
                            data={processedFilteredData}
                            columns={displayedColumns}
                            loading={loading}
                            initialSort={{ key: 'Category', direction: 'ascending' }}
                            mobilePrimaryColumns={['Model', 'Brand', 'End User Price', 'Status']}
                            cellWrapStyle={cellWrapStyle}
                            highlightedCheck={(row) => !!row.Promotion}
                            renderRowActions={(row) => (
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleViewItem(row);
                                        }}
                                        className="p-2 text-muted-foreground hover:text-brand-500 transition-colors"
                                        title="View Details"
                                    >
                                        <Info size={16} />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleEditItem(row);
                                        }}
                                        className="p-2 text-muted-foreground hover:text-brand-500 transition-colors"
                                        title="Edit Product"
                                    >
                                        <Pencil size={16} />
                                    </button>
                                </div>
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
                                showDealerPrice={true}
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
                                    showDealerPrice={true}
                                />
                            ))}
                    </div>
                );
        }
    }

    return (
        <div className="h-full flex flex-col bg-background">
            <div className="p-4 lg:p-6 flex flex-col gap-4 bg-card border-b border-border flex-shrink-0">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold text-foreground tracking-tight">B2B Master Pricelist</h1>
                            <Badge variant="outline" className="bg-brand-500/10 text-brand-500 border-brand-500/20 flex items-center gap-1 py-0.5 px-2">
                                <ShieldCheck className="w-3 h-3" />
                                Secure Access
                            </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <p className="flex items-center gap-1.5">
                                <span className="font-bold text-foreground">{filteredData.length}</span> items in inventory
                            </p>
                            <span className="w-1 h-1 bg-muted rounded-full"></span>
                            <p className="flex items-center gap-1.5 text-brand-600 font-medium">
                                <TrendingUp className="w-3.5 h-3.5" />
                                Live Dealer Rates
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col lg:flex-row gap-3 w-full lg:w-auto items-start lg:items-center mt-2 lg:mt-0">
                        <div className="relative w-full lg:w-64 flex-shrink-0">
                            <label htmlFor="pricelist-search" className="sr-only">Search</label>
                            <input
                                id="pricelist-search"
                                type="text"
                                placeholder="Search pricelist..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="bg-muted border-transparent text-foreground placeholder-muted-foreground/60 text-sm rounded-lg focus:ring-2 focus:ring-brand-500/50 focus:bg-background focus:border-brand-500 block w-full pl-10 p-2.5 transition"
                            />
                            <svg className="w-5 h-5 text-muted-foreground/60 absolute top-1/2 left-3 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                        </div>

                        <div className="flex items-center gap-2 w-full lg:w-auto overflow-x-auto no-scrollbar pb-1 lg:pb-0">
                            <ViewToggle<ViewMode> views={VIEW_OPTIONS} activeView={viewMode} onViewChange={setViewMode} />
                            {viewMode === 'table' && (
                                <>
                                    <div className="bg-muted p-1 rounded-lg flex items-center gap-1 border border-border flex-shrink-0">
                                        <button
                                            onClick={() => setCellWrapStyle('overflow')}
                                            title="Overflow"
                                            className={`flex items-center justify-center p-1.5 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:ring-offset-1 ${cellWrapStyle === 'overflow'
                                                ? 'bg-background shadow-sm text-brand-500'
                                                : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'
                                                }`}
                                            aria-pressed={cellWrapStyle === 'overflow'}
                                        >
                                            <ArrowRightToLine className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => setCellWrapStyle('wrap')}
                                            title="Wrap"
                                            className={`flex items-center justify-center p-1.5 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:ring-offset-1 ${cellWrapStyle === 'wrap'
                                                ? 'bg-background shadow-sm text-brand-500'
                                                : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'
                                                }`}
                                            aria-pressed={cellWrapStyle === 'wrap'}
                                        >
                                            <WrapText className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => setCellWrapStyle('clip')}
                                            title="Clip"
                                            className={`flex items-center justify-center p-1.5 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:ring-offset-1 ${cellWrapStyle === 'clip'
                                                ? 'bg-background shadow-sm text-brand-500'
                                                : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'
                                                }`}
                                            aria-pressed={cellWrapStyle === 'clip'}
                                        >
                                            <Scissors className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => setCellWrapStyle('nowrap')}
                                            title="No Wrap (Horizontal)"
                                            className={`flex items-center justify-center p-1.5 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:ring-offset-1 ${cellWrapStyle === 'nowrap'
                                                ? 'bg-background shadow-sm text-brand-500'
                                                : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'
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
                                className="flex-shrink-0 flex items-center justify-center bg-brand-700 hover:bg-brand-800 text-white font-bold py-2.5 px-5 rounded-lg transition-all duration-200 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.2)] hover:shadow-[0_4px_15px_-3px_rgba(0,0,0,0.3)] transform hover:-translate-y-0.5 active:translate-y-0 ml-auto lg:ml-0"
                            >
                                <svg className="w-5 h-5 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                                <span className="hidden sm:inline">Add B2B Product</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className={`flex-1 overflow-hidden bg-background transition-opacity duration-500 ${renderStep > 0 ? 'opacity-100' : 'opacity-0'} flex flex-col`}>
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
        </div >
    );
};

export default B2BPricelistDashboard;

