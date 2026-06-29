'use client';

import React, { useState, useRef, useEffect, useLayoutEffect, useId, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, Check, X } from 'lucide-react';
import { ScrollArea } from "../ui/scroll-area";

interface SearchableSelectProps {
    name?: string;
    label?: string;
    value: string;
    onChange: (value: string) => void;
    options: string[];
    required?: boolean;
    disabled?: boolean;
    placeholder?: string;
    actionButton?: React.ReactNode;
    allowCustomValue?: boolean;
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Wrap the portion of `text` matching `query` so matches are visually
// obvious when scanning a long filtered list.
const highlightMatch = (text: string, query: string): React.ReactNode => {
    if (!query) return text;
    const parts = text.split(new RegExp(`(${escapeRegExp(query)})`, 'gi'));
    return parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase()
            ? <span key={i} className="bg-brand-500/20 text-brand-600 rounded-sm">{part}</span>
            : part
    );
};

const SearchableSelect: React.FC<SearchableSelectProps> = ({
    name,
    label,
    value,
    onChange,
    options,
    required = false,
    disabled = false,
    placeholder = "Search...",
    actionButton,
    allowCustomValue = false,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties | null>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const [contentWidth, setContentWidth] = useState<number | null>(null);
    const listId = useId();

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            const insideWrapper = wrapperRef.current && wrapperRef.current.contains(target);
            const insideDropdown = dropdownRef.current && dropdownRef.current.contains(target);
            if (!insideWrapper && !insideDropdown) {
                if (allowCustomValue && searchTerm && searchTerm !== value) {
                    onChange(searchTerm);
                }
                setIsOpen(false);
                setSearchTerm('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Position the dropdown relative to the viewport via a portal so it isn't
    // clipped by ancestor `overflow-y-auto` containers (e.g. floating windows).
    // Floating windows are dragged via raw mousemove + state updates (see
    // ManagedWindowFrame), which fire neither `resize` nor `scroll` — so we
    // poll via rAF while open instead of relying on those events, otherwise
    // the dropdown stays frozen at its old screen position while the window
    // (and its trigger) moves underneath it.
    useEffect(() => {
        if (!isOpen) {
            setDropdownStyle(null);
            return;
        }
        let frameId: number;
        let lastKey = '';
        const updatePosition = () => {
            const rect = triggerRef.current?.getBoundingClientRect();
            if (rect) {
                const spaceBelow = window.innerHeight - rect.bottom;
                const openUpward = spaceBelow < 200 && rect.top > spaceBelow;
                // Floating windows can be resized down to where the trigger
                // itself is only a few px wide — never shrink the dropdown
                // below a readable minimum. Prefer the measured content width
                // (fits the longest visible option without truncating) once
                // available, and keep it on-screen even when that's wider
                // than the trigger it's anchored to.
                const width = Math.max(rect.width, contentWidth ?? 240);
                const left = Math.min(rect.left, window.innerWidth - width - 8);
                const key = `${left}|${width}|${rect.top}|${rect.bottom}|${openUpward}`;
                if (key !== lastKey) {
                    lastKey = key;
                    setDropdownStyle(openUpward
                        ? { position: 'fixed', left, width, bottom: window.innerHeight - rect.top + 8, zIndex: 1000001 }
                        : { position: 'fixed', left, width, top: rect.bottom + 8, zIndex: 1000001 }
                    );
                }
            }
            frameId = requestAnimationFrame(updatePosition);
        };
        frameId = requestAnimationFrame(updatePosition);
        return () => cancelAnimationFrame(frameId);
    }, [isOpen, contentWidth]);

    const filteredOptions = useMemo(() => {
        const search = searchTerm.toLowerCase();
        if (!search) return options;
        return options.filter(option =>
            option.toLowerCase().includes(search)
        );
    }, [options, searchTerm]);

    // The dropdown mounts off-screen (see the portal below) before its real
    // position/width are known, specifically so this can measure the actual
    // rendered width of the longest option here and feed it back into the
    // position effect above — otherwise the dropdown is stuck matching the
    // trigger's width, which is sized for typical input text, not the
    // longest option in the list (e.g. a long company name gets clipped by
    // `truncate` even though the dropdown is free-floating and could just be
    // wider).
    useLayoutEffect(() => {
        if (!isOpen) { setContentWidth(null); return; }
        const spans = dropdownRef.current?.querySelectorAll<HTMLElement>('[data-option-text]');
        if (!spans || spans.length === 0) return;
        let max = 0;
        spans.forEach(s => { if (s.scrollWidth > max) max = s.scrollWidth; });
        const CHROME = 72; // button padding + check-icon allowance + list padding
        setContentWidth(Math.max(Math.min(max + CHROME, window.innerWidth - 16), 240));
    }, [isOpen, filteredOptions]);

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

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!isOpen) { setIsOpen(true); return; }
            setActiveIndex(i => Math.min(i + 1, filteredOptions.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (!isOpen) { setIsOpen(true); return; }
            setActiveIndex(i => Math.max(i - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (isOpen && filteredOptions[activeIndex]) {
                handleSelect(filteredOptions[activeIndex]);
            } else if (allowCustomValue && searchTerm) {
                handleSelect(searchTerm);
            } else {
                setIsOpen(false);
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            setIsOpen(false);
            setSearchTerm('');
            inputRef.current?.blur();
        }
    };

    // Keep showing the current selection when the dropdown opens — only
    // switch to the live search term once the user actually types, so the
    // selected value doesn't appear to vanish the instant you click in.
    const displayValue = isOpen ? (searchTerm || value) : value;

    // Jump keyboard focus to the current value when the list opens, and back
    // to the top match whenever the search term changes, so Enter always
    // selects whichever option is visibly highlighted.
    useEffect(() => {
        if (!isOpen) return;
        const idx = options.findIndex(o => o === value);
        setActiveIndex(idx >= 0 ? idx : 0);
    }, [isOpen, value, options]);

    useEffect(() => {
        setActiveIndex(0);
    }, [searchTerm]);

    // Scroll whichever option is keyboard-active into view — covers both the
    // initial jump-to-selected on open and subsequent arrow-key moves.
    useEffect(() => {
        if (isOpen) {
            optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
        }
    }, [activeIndex, isOpen]);

    return (
        <div className="flex flex-col relative" ref={wrapperRef}>
            {(label || actionButton) && (
                <div className="flex justify-between items-center mb-2 px-0.5">
                    {label && (
                        <label htmlFor={name} className="text-[13px] font-bold text-foreground uppercase tracking-wider">
                            {label}{required && <span className="text-rose-500 ml-1">*</span>}
                        </label>
                    )}
                    {actionButton}
                </div>
            )}

            <div ref={triggerRef} className="relative group transition-all duration-300">
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
                        onFocus={(e) => { setIsOpen(true); e.target.select(); }}
                        onKeyDown={handleKeyDown}
                        required={required && !value}
                        placeholder={placeholder}
                        disabled={disabled}
                        autoComplete="off"
                        className={`
                            block w-full pl-10 py-3 bg-background border rounded-xl sm:text-sm text-foreground
                            transition-all duration-200 shadow-sm
                            ${value && !disabled ? 'pr-16' : 'pr-10'}
                            ${isOpen
                                ? 'border-brand-500 ring-4 ring-brand-500/10 bg-background'
                                : 'border-border hover:border-muted-foreground/30 bg-muted/40 hover:bg-background'}
                            ${disabled ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-60' : 'cursor-text'}
                        `}
                        role="combobox"
                        aria-expanded={isOpen}
                        aria-controls={listId}
                        aria-activedescendant={isOpen ? `${listId}-option-${activeIndex}` : undefined}
                    />
                    {value && !disabled && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onChange('');
                                setSearchTerm('');
                                setIsOpen(true);
                                inputRef.current?.focus();
                            }}
                            className="absolute right-9 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            aria-label="Clear selection"
                            tabIndex={-1}
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                    <ChevronDown className={`h-4 w-4 text-muted-foreground absolute right-3.5 top-1/2 -translate-y-1/2 transition-transform duration-300 ${isOpen ? 'rotate-180 text-brand-500' : ''}`} />
                </div>
            </div>

            {isOpen && !disabled && typeof document !== 'undefined' && createPortal(
                <div
                    ref={dropdownRef}
                    id={listId}
                    role="listbox"
                    // Mounts off-screen the instant it opens — before the position
                    // effect has measured the trigger — specifically so the content-
                    // width effect above has real DOM to measure on the very first
                    // layout pass. Swaps to the real on-screen style once computed,
                    // with no visible jump since this state is never painted.
                    style={dropdownStyle ?? { position: 'fixed', top: -9999, left: -9999, visibility: 'hidden' }}
                    className="bg-card rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.25)] border border-border overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
                >
                    {filteredOptions.length > 0 && (
                        <div className="px-3.5 py-2 border-b border-border/60 text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wide">
                            {searchTerm
                                ? `${filteredOptions.length} match${filteredOptions.length === 1 ? '' : 'es'}`
                                : `${filteredOptions.length} ${filteredOptions.length === 1 ? 'option' : 'options'}`}
                            {filteredOptions.length > 7 && <span className="text-muted-foreground/50 font-normal"> · scroll for more</span>}
                        </div>
                    )}
                    <ScrollArea className={filteredOptions.length > 7 ? 'h-[320px]' : ''} type="always">
                        <div className="p-2 space-y-1">
                            {filteredOptions.length > 0 ? (
                                filteredOptions.map((option, index) => (
                                    <button
                                        key={option}
                                        ref={el => { optionRefs.current[index] = el; }}
                                        id={`${listId}-option-${index}`}
                                        role="option"
                                        aria-selected={value === option}
                                        type="button"
                                        onClick={() => handleSelect(option)}
                                        onMouseEnter={() => setActiveIndex(index)}
                                        className={`
                                            w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all duration-150
                                            ${value === option
                                                ? 'bg-brand-500/10 text-brand-600 font-semibold'
                                                : index === activeIndex
                                                ? 'bg-muted text-foreground'
                                                : 'text-foreground hover:bg-muted active:bg-accent'}
                                        `}
                                    >
                                        <span data-option-text className="truncate">{highlightMatch(option, searchTerm)}</span>
                                        {value === option && (
                                            <Check className="h-4 w-4 text-brand-600 flex-shrink-0" />
                                        )}
                                    </button>
                                ))
                            ) : (
                                <div className="px-4 py-6 text-center">
                                    <Search className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                                    <p className="text-sm text-muted-foreground font-medium">No results for "{searchTerm}"</p>
                                    {allowCustomValue && searchTerm ? (
                                        <button
                                            type="button"
                                            onClick={() => handleSelect(searchTerm)}
                                            className="mt-3 text-xs font-semibold text-brand-600 hover:text-brand-700 bg-brand-500/10 hover:bg-brand-500/20 px-3 py-1.5 rounded-lg transition"
                                        >
                                            + Use "{searchTerm}"
                                        </button>
                                    ) : (
                                        <p className="text-xs text-muted-foreground/60 mt-1">Try a different search term</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </div>,
                document.body
            )}
        </div>
    );
};

export default SearchableSelect;
