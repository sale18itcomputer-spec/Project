import React, { useState, useRef, useEffect, useId, useMemo } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';

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
        if (!searchTerm) {
            return options;
        }
        return options.filter(option =>
            option.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [options, searchTerm]);

    const handleSelect = (optionValue: string) => {
        onChange(optionValue);
        setIsOpen(false);
        setSearchTerm('');
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        if (!isOpen) {
            setIsOpen(true);
        }
        // If user clears input, clear selection
        if (e.target.value === '') {
            onChange('');
        }
    };
    
    const handleInputClick = () => {
        setIsOpen(true);
    }
    
    // Display the selected value in the input when the dropdown is closed
    const displayValue = isOpen ? searchTerm : value;

    return (
        <div className="flex flex-col" ref={wrapperRef}>
            <div className="flex justify-between items-baseline mb-1.5">
                <label htmlFor={name} className="block text-sm font-medium text-slate-600">
                    {label}{required && <span className="text-rose-500 ml-1">*</span>}
                </label>
                {actionButton}
            </div>
            <div className="relative">
                <div className="relative">
                    <Search className="h-4 w-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                        ref={inputRef}
                        type="text"
                        name={name}
                        id={name}
                        value={displayValue}
                        onChange={handleInputChange}
                        onClick={handleInputClick}
                        required={required && !value} // make it required only if no value is selected
                        placeholder={placeholder}
                        disabled={disabled}
                        autoComplete="off"
                        className={`block w-full px-3.5 pl-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg placeholder-slate-400 focus:outline-none focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 sm:text-sm transition-colors duration-150 ${disabled ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'hover:border-slate-300'}`}
                        role="combobox"
                        aria-expanded={isOpen}
                        aria-controls={listId}
                    />
                     <ChevronDown className={`h-4 w-4 text-muted-foreground absolute right-3.5 top-1/2 -translate-y-1/2 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                </div>
                {isOpen && !disabled && (
                    <div
                        id={listId}
                        role="listbox"
                        className="absolute z-20 w-full mt-1 bg-white rounded-lg shadow-lg border border-slate-200 max-h-60 overflow-hidden"
                    >
                        <ScrollArea className="h-full">
                            <ul>
                                {filteredOptions.length > 0 ? (
                                    filteredOptions.map(option => (
                                        <li
                                            key={option}
                                            onClick={() => handleSelect(option)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSelect(option)}
                                            role="option"
                                            aria-selected={value === option}
                                            tabIndex={0}
                                            className="px-4 py-2 text-sm text-slate-800 cursor-pointer hover:bg-slate-100 focus:bg-slate-100 focus:outline-none"
                                        >
                                            {option}
                                        </li>
                                    ))
                                ) : (
                                    <li className="px-4 py-2 text-sm text-slate-500 italic">No options found.</li>
                                )}
                            </ul>
                        </ScrollArea>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SearchableSelect;