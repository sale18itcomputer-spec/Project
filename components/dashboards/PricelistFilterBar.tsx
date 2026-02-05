import React, { useState, useEffect, useRef } from 'react';
import { Filter, ListTree, Tag, X } from 'lucide-react';
import MultiSelectFilter from "../common/MultiSelectFilter";

interface PricelistFilterBarProps {
    categories: string[];
    brands: string[];
    categoryFilter: string[];
    brandFilter: string[];
    onCategoryChange: (selection: string[]) => void;
    onBrandChange: (selection: string[]) => void;
    onMenuVisibilityChange?: (isVisible: boolean) => void;
}

const PricelistFilterBar: React.FC<PricelistFilterBarProps> = ({ categories, brands, categoryFilter, brandFilter, onCategoryChange, onBrandChange, onMenuVisibilityChange }) => {
    const [openMenu, setOpenMenu] = useState<string | null>(null);
    const filterBarRef = useRef<HTMLDivElement>(null);
    const hasActiveFilters = categoryFilter.length > 0 || brandFilter.length > 0;

    useEffect(() => {
        onMenuVisibilityChange?.(openMenu !== null);
    }, [openMenu, onMenuVisibilityChange]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (filterBarRef.current && !filterBarRef.current.contains(event.target as Node)) {
                setOpenMenu(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleMenu = (key: string) => {
        setOpenMenu(prev => (prev === key ? null : key));
    };

    const closeMenu = () => {
        setOpenMenu(null);
    };

    const clearFilters = () => {
        onCategoryChange([]);
        onBrandChange([]);
    };

    return (
        <div ref={filterBarRef} className="bg-card p-3 rounded-xl border border-border shadow-sm flex items-center gap-2">
            <div className="flex items-center gap-3 pr-3 border-r border-border">
                <Filter className="w-5 h-5 text-brand-500 flex-shrink-0" />
                <span className="text-sm font-semibold text-foreground hidden lg:block">Filters</span>
            </div>
            <div className="flex-1 flex flex-wrap items-center gap-2">
                <MultiSelectFilter
                    label="Category"
                    icon={<ListTree className="w-4 h-4" />}
                    options={categories}
                    selectedValues={categoryFilter}
                    onApply={onCategoryChange}
                    isOpen={openMenu === 'category'}
                    onToggle={() => toggleMenu('category')}
                    onClose={closeMenu}
                />
                <MultiSelectFilter
                    label="Brand"
                    icon={<Tag className="w-4 h-4" />}
                    options={brands}
                    selectedValues={brandFilter}
                    onApply={onBrandChange}
                    isOpen={openMenu === 'brand'}
                    onToggle={() => toggleMenu('brand')}
                    onClose={closeMenu}
                />
            </div>
            {hasActiveFilters && (
                <button
                    onClick={clearFilters}
                    className="ml-auto flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-brand-500/10 hover:text-brand-500 transition-colors"
                    aria-label="Clear all filters"
                    title="Clear all filters"
                >
                    <X className="w-4 h-4" />
                </button>
            )}
        </div>
    );
};

export default PricelistFilterBar;
