import React, { useState, useEffect, useMemo, useId } from 'react';

// This is a generic MultiSelectFilter component.
// It receives its state (selectedValues) and update logic (onApply) via props.
interface MultiSelectFilterProps {
    label: string;
    icon: React.ReactNode;
    options: (string | {label: string, value: string})[];
    selectedValues: string[];
    onApply: (newSelection: string[]) => void;
    isOpen: boolean;
    onToggle: () => void;
    onClose: () => void;
}

const MultiSelectFilter: React.FC<MultiSelectFilterProps> = ({ label, icon, options, selectedValues, onApply, isOpen, onToggle, onClose }) => {
    const [localSelection, setLocalSelection] = useState<string[]>([]);
    const [search, setSearch] = useState('');
    const contentId = useId();

    useEffect(() => {
        if (isOpen) {
            setLocalSelection(selectedValues || []);
        } else {
            setSearch(''); // Reset search on close
        }
    }, [isOpen, selectedValues]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]);
    
    const normalizedOptions = useMemo(() => {
        return options.map(opt => typeof opt === 'string' ? { label: opt, value: opt } : opt);
    }, [options]);

    const handleToggleOption = (optionValue: string) => {
        setLocalSelection(prev => 
            prev.includes(optionValue) ? prev.filter(item => item !== optionValue) : [...prev, optionValue]
        );
    };

    const handleApply = () => {
        onApply(localSelection);
        onClose();
    };

    const handleClear = () => {
        setLocalSelection([]);
        onApply([]);
        onClose();
    };

    const filteredOptions = useMemo(() => {
        if (!search) return normalizedOptions;
        return normalizedOptions.filter(opt => opt.label.toLowerCase().includes(search.toLowerCase()));
    }, [normalizedOptions, search]);

    const handleSelectAll = () => setLocalSelection(filteredOptions.map(opt => opt.value));
    const handleDeselectAll = () => setLocalSelection([]);

    const selectedCount = selectedValues.length;
    const isActive = selectedCount > 0;

    const buttonClasses = `flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer border ${
        isActive
            ? 'bg-brand-50 text-brand-800 border-brand-200 hover:bg-brand-100'
            : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
    }`;
    
    return (
        <div className="relative flex-shrink-0">
            <button 
                onClick={onToggle} 
                className={buttonClasses}
                aria-expanded={isOpen}
                aria-controls={contentId}
            >
                {icon}
                <span className={`${isActive ? 'font-semibold' : ''} max-w-[150px] truncate`}>
                    {label} {selectedCount > 0 && `(${selectedCount})`}
                </span>
            </button>

            {isOpen && (
                <div id={contentId} className="absolute top-full mt-2 w-72 bg-white rounded-lg shadow-lg border border-slate-200 z-20 flex flex-col animate-contentFadeIn" style={{animationDuration: '0.15s'}}>
                   <div className="p-2 border-b border-slate-200">
                       <input
                         type="search"
                         placeholder={`Search ${label}...`}
                         value={search}
                         onChange={(e) => setSearch(e.target.value)}
                         className="w-full text-sm px-2 py-1.5 bg-slate-100 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500"
                       />
                   </div>
                   <div className="px-3 py-2 flex justify-between border-b border-slate-200">
                       <button onClick={handleSelectAll} className="text-xs font-semibold text-brand-600 hover:underline">Select all</button>
                       <button onClick={handleDeselectAll} className="text-xs font-semibold text-brand-600 hover:underline">Deselect all</button>
                   </div>
                   <ul className="max-h-60 overflow-y-auto vertical-scroll p-1">
                       {filteredOptions.map(opt => (
                         <li key={opt.value}>
                           <label className="flex items-center gap-3 w-full text-left px-3 py-1.5 text-sm rounded-md hover:bg-slate-50 transition-colors cursor-pointer">
                               <input
                                 type="checkbox"
                                 checked={localSelection.includes(opt.value)}
                                 onChange={() => handleToggleOption(opt.value)}
                                 className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                               />
                               <span className="text-slate-800 truncate">{opt.label}</span>
                           </label>
                         </li>
                       ))}
                   </ul>
                   <div className="p-2 border-t border-slate-200 flex justify-end gap-2 bg-slate-50 rounded-b-lg">
                       <button onClick={handleClear} className="bg-white hover:bg-slate-100 text-slate-700 font-semibold py-1.5 px-3 rounded-md border border-slate-300 transition text-sm">Clear</button>
                       <button onClick={handleApply} className="bg-brand-600 hover:bg-brand-700 text-white font-semibold py-1.5 px-3 rounded-md transition shadow-sm text-sm">Apply</button>
                   </div>
                </div>
            )}
        </div>
    );
};

export default MultiSelectFilter;