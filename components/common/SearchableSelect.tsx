'use client';

import React, { useState, useRef, useEffect, useId, useMemo } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';
import { ScrollArea } from "../ui/scroll-area";

interface SearchableSelectProps {
    name: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: string[];
    required?: boolean;
    disabled?: boolean;
    placeholder?: string;
    actionButton?: React.ReactNode;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
    name,
    label,
    value,
    onChange,
    options,
    required = false,
    disabled = false,
    placeholder = "Search...",
    actionButton
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const listId = useId();

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearchTerm(''); // Reset search term when closing
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredOptions = useMemo(() => {
        const search = searchTerm.toLowerCase();
        if (!search) return options;
        return options.filter(option =>
            option.toLowerCase().includes(search)
        );
    }, [options, searchTerm]);

    const handleSelect = (optionValue: string) => {
        onChange(optionValue);
        setIsOpen(false);
        setSearchTerm('');
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        if (!isOpen) setIsOpen(true);
        if (e.target.value === '') {
            onChange('');
        }
    };

    // Display the selected value in the input when the dropdown is closed
    const displayValue = isOpen ? searchTerm : value;

    return (
        <div className="flex flex-col relative" ref={wrapperRef}>
            <div className="flex justify-between items-center mb-2 px-0.5">
                <label htmlFor={name} className="text-[13px] font-bold text-foreground uppercase tracking-wider">
                    {label}{required && <span className="text-rose-500 ml-1">*</span>}
                </label>
                {actionButton}
            </div>

            <div className={`relative group transition-all duration-300 ${isOpen ? 'z-[9999]' : 'z-10'}`}>
                <div className="relative">
                    <Search className={`h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 ${isOpen ? 'text-brand-500' : 'text-muted-foreground'}`} />
                    <input
                        ref={inputRef}
                        type="text"
                        name={name}
                        id={name}
                        value={displayValue}
                        onChange={handleInputChange}
                        onClick={() => setIsOpen(true)}
                        onFocus={() => setIsOpen(true)}
                        required={required && !value}
                        placeholder={placeholder}
                        disabled={disabled}
                        autoComplete="off"
                        className={`
                            block w-full px-10 py-3 bg-background border rounded-xl sm:text-sm text-foreground
                            transition-all duration-200 shadow-sm
                            ${isOpen
                                ? 'border-brand-500 ring-4 ring-brand-500/10 bg-background'
                                : 'border-border hover:border-muted-foreground/30 bg-muted/40 hover:bg-background'}
                            ${disabled ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-60' : 'cursor-text'}
                        `}
                        role="combobox"
                        aria-expanded={isOpen}
                        aria-controls={listId}
                    />
                    <ChevronDown className={`h-4 w-4 text-muted-foreground absolute right-3.5 top-1/2 -translate-y-1/2 transition-transform duration-300 ${isOpen ? 'rotate-180 text-brand-500' : ''}`} />
                </div>

                {isOpen && !disabled && (
                    <div
                        id={listId}
                        role="listbox"
                        className="absolute w-full mt-2 bg-card rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.25)] border border-border overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-[9999]"
                    >
                        <ScrollArea className="max-h-[280px]">
                            <div className="p-2 space-y-1">
                                {filteredOptions.length > 0 ? (
                                    filteredOptions.map(option => (
                                        <button
                                            key={option}
                                            type="button"
                                            onClick={() => handleSelect(option)}
                                            className={`
                                                w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all duration-150
                                                ${value === option
                                                    ? 'bg-brand-500/10 text-brand-600 font-semibold'
                                                    : 'text-foreground hover:bg-muted active:bg-accent'}
                                            `}
                                        >
                                            <span className="truncate">{option}</span>
                                            {value === option && (
                                                <Check className="h-4 w-4 text-brand-600 flex-shrink-0" />
                                            )}
                                        </button>
                                    ))
                                ) : (
                                    <div className="px-4 py-8 text-center">
                                        <Search className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                                        <p className="text-sm text-muted-foreground font-medium">No results for "{searchTerm}"</p>
                                        <p className="text-xs text-muted-foreground/60 mt-1">Try a different search term</p>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SearchableSelect;
