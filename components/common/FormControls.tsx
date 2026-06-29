'use client';

import React, { useState, useEffect, useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';

// A more professional, modern card-based section for forms.
// Increased padding, uses a clean white background with a subtle shadow.
// The title is now a styled uppercase header for better visual hierarchy.
export const FormSection: React.FC<{ title?: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-card p-4 rounded-xl border border-border shadow-sm dark:shadow-none dark:border-border/80">
        {title && <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70 mb-4">{title}</h3>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4">
            {children}
        </div>
    </div>
);

// Updated input with a cleaner, more professional look.
// Features a light gray background, subtle borders, and an elegant focus state with a soft glow.
export const FormInput: React.FC<{ name: string; label: string; value: any; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; type?: string; required?: boolean; placeholder?: string; readOnly?: boolean; step?: string; list?: string; datalistOptions?: readonly string[]; actionButton?: React.ReactNode; }> =
    ({ name, label, value, onChange, type = 'text', required = false, placeholder, readOnly = false, step, list, datalistOptions, actionButton }) => (
        <div className="flex flex-col">
            <div className="flex justify-between items-baseline mb-1.5">
                <label htmlFor={name} className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">{label}{required && <span className="text-rose-500 ml-1">*</span>}</label>
                {actionButton}
            </div>
            <input
                type={type}
                name={name}
                id={name}
                value={value ?? ''}
                onChange={onChange}
                required={required}
                placeholder={placeholder}
                readOnly={readOnly}
                step={step}
                list={list}
                className={`block w-full px-3.5 py-2.5 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:bg-background focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 sm:text-sm transition-colors duration-150 ${readOnly ? 'opacity-60 cursor-not-allowed' : 'hover:border-muted-foreground/40'} ${type === 'date' || type === 'time' ? 'dark:[color-scheme:dark]' : ''}`}
            />
            {list && datalistOptions && (
                <datalist id={list}>
                    {datalistOptions.map(opt => <option key={opt} value={opt} />)}
                </datalist>
            )}
        </div>
    );

// Custom-styled select — looks like FormInput's siblings and matches the
// dark theme exactly, unlike a native <select> whose open option list is
// rendered by the OS/browser and can't be restyled with CSS. A visually
// hidden native <select> stays mounted underneath in sync with `value` so
// forms that rely on native `required` constraint validation on submit
// (several do, via a plain e.preventDefault() + no JS-side required check)
// keep blocking incomplete submissions exactly as before.
export const FormSelect: React.FC<{
    name: string;
    label: string;
    value: any;
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    options: readonly string[];
    required?: boolean;
    disabled?: boolean;
    disabledPlaceholder?: string;
    actionButton?: React.ReactNode;
}> = ({ name, label, value, onChange, options, required = false, disabled = false, disabledPlaceholder, actionButton }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties | null>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
    const listId = useId();

    const getPlaceholder = () => disabled ? (disabledPlaceholder || `Select ${label}`) : `Select ${label}`;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            const insideWrapper = wrapperRef.current && wrapperRef.current.contains(target);
            const insideDropdown = dropdownRef.current && dropdownRef.current.contains(target);
            if (!insideWrapper && !insideDropdown) setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Same floating-window-aware positioning as SearchableSelect: portal to
    // <body> and poll via rAF (drag/resize never fire resize/scroll events).
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
                const width = Math.max(rect.width, 200);
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
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const idx = options.findIndex(o => o === value);
        setActiveIndex(idx >= 0 ? idx : 0);
    }, [isOpen, value, options]);

    useEffect(() => {
        if (isOpen) optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
    }, [activeIndex, isOpen]);

    const commit = (opt: string) => {
        onChange({ target: { name, value: opt, type: 'select-one' } } as unknown as React.ChangeEvent<HTMLSelectElement>);
        setIsOpen(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!isOpen) { setIsOpen(true); return; }
            setActiveIndex(i => Math.min(i + 1, options.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (!isOpen) { setIsOpen(true); return; }
            setActiveIndex(i => Math.max(i - 1, 0));
        } else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (isOpen && options[activeIndex] !== undefined) commit(options[activeIndex]);
            else setIsOpen(o => !o);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            setIsOpen(false);
        }
    };

    return (
        <div className="flex flex-col relative" ref={wrapperRef}>
            <div className="flex justify-between items-baseline mb-1.5">
                <label htmlFor={name} className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">{label}{required && <span className="text-rose-500 ml-1">*</span>}</label>
                {actionButton}
            </div>
            <div className="relative">
                <button
                    ref={triggerRef}
                    type="button"
                    id={name}
                    disabled={disabled}
                    onClick={() => setIsOpen(o => !o)}
                    onKeyDown={handleKeyDown}
                    role="combobox"
                    aria-haspopup="listbox"
                    aria-expanded={isOpen}
                    aria-controls={listId}
                    aria-activedescendant={isOpen ? `${listId}-option-${activeIndex}` : undefined}
                    className={`flex items-center justify-between w-full px-3.5 py-2.5 bg-input border rounded-lg text-left sm:text-sm transition-colors duration-150
                        ${isOpen ? 'border-brand-500 ring-2 ring-brand-500/20 bg-background' : 'border-border hover:border-muted-foreground/40'}
                        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                        ${!value ? 'text-muted-foreground' : 'text-foreground'}
                    `}
                >
                    <span className="truncate">{value || getPlaceholder()}</span>
                    <ChevronDown className={`h-4 w-4 text-muted-foreground flex-shrink-0 ml-2 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                <select
                    name={name}
                    value={value || ''}
                    onChange={() => {}}
                    required={required}
                    disabled={disabled}
                    tabIndex={-1}
                    aria-hidden="true"
                    className="absolute inset-0 opacity-0 pointer-events-none"
                >
                    <option value="" disabled>{getPlaceholder()}</option>
                    {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
            </div>

            {isOpen && !disabled && dropdownStyle && typeof document !== 'undefined' && createPortal(
                <div
                    ref={dropdownRef}
                    id={listId}
                    role="listbox"
                    style={dropdownStyle}
                    className="bg-card rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.25)] border border-border overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150"
                >
                    <ScrollArea className={options.length > 7 ? 'h-[280px]' : ''}>
                        <div className="p-1.5 space-y-0.5">
                            {options.map((opt, index) => (
                                <button
                                    key={opt}
                                    ref={el => { optionRefs.current[index] = el; }}
                                    id={`${listId}-option-${index}`}
                                    role="option"
                                    aria-selected={value === opt}
                                    type="button"
                                    onClick={() => commit(opt)}
                                    onMouseEnter={() => setActiveIndex(index)}
                                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-left transition-colors duration-150
                                        ${value === opt
                                            ? 'bg-brand-500/10 text-brand-600 font-semibold'
                                            : index === activeIndex
                                            ? 'bg-muted text-foreground'
                                            : 'text-foreground hover:bg-muted'}
                                    `}
                                >
                                    <span className="truncate">{opt}</span>
                                    {value === opt && <Check className="h-4 w-4 text-brand-600 flex-shrink-0" />}
                                </button>
                            ))}
                        </div>
                    </ScrollArea>
                </div>,
                document.body
            )}
        </div>
    );
};


// Updated textarea with styles consistent with the new FormInput.
export const FormTextarea: React.FC<{
    name: string;
    label: string;
    value: any;
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    rows?: number;
    placeholder?: string;
    readOnly?: boolean;
    required?: boolean;
}> = ({ name, label, value, onChange, rows = 3, placeholder, readOnly, required = false }) => (

    <div className="md:col-span-2 flex flex-col">
        <label htmlFor={name} className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground/70 mb-1.5">
            {label}
            {required && <span className="text-rose-500 ml-1">*</span>}
        </label>
        <textarea
            name={name}
            id={name}
            value={value || ''}
            onChange={onChange}
            rows={rows}
            placeholder={placeholder}
            readOnly={readOnly}
            required={required}
            className={`block w-full px-3.5 py-2.5 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:bg-background focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 sm:text-sm transition-colors duration-150 hover:border-muted-foreground/40 resize-none ${readOnly ? 'opacity-70 cursor-default' : ''}`}
        />
    </div>
);

// Searchable select — shows a text input that filters options in a dropdown.
// onChange receives the selected string directly (not a synthetic event).
export const FormSearchSelect: React.FC<{
    name: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: readonly string[];
    required?: boolean;
    disabled?: boolean;
}> = ({ name, label, value, onChange, options, required = false, disabled = false }) => {
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
                setQuery('');
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isOpen]);

    const filtered = query
        ? options.filter(o => o.toLowerCase().includes(query.toLowerCase()))
        : options;

    const displayValue = isOpen ? query : (value || '');

    const handleSelect = (opt: string) => {
        onChange(opt);
        setQuery('');
        setIsOpen(false);
    };

    return (
        <div className="flex flex-col" ref={containerRef}>
            <label htmlFor={name} className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground/70 mb-1.5">
                {label}{required && <span className="text-rose-500 ml-1">*</span>}
            </label>
            <div className="relative">
                <input
                    type="text"
                    id={name}
                    name={name}
                    value={displayValue}
                    onChange={e => { setQuery(e.target.value); setIsOpen(true); }}
                    onFocus={() => { setQuery(''); setIsOpen(true); }}
                    placeholder={`Search ${label}…`}
                    disabled={disabled}
                    autoComplete="off"
                    className={`block w-full px-3.5 py-2.5 pr-9 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:bg-background focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 sm:text-sm transition-colors duration-150 ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-muted-foreground/40'}`}
                />
                <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />

                {isOpen && (
                    <div className="absolute z-[200] w-full mt-1 bg-card border border-border rounded-lg shadow-xl overflow-hidden">
                        {filtered.length > 0 && (
                            <div className="px-3.5 py-2 border-b border-border/60 text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wide">
                                {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
                                {filtered.length > 5 && <span className="text-muted-foreground/50 font-normal"> · scroll for more</span>}
                            </div>
                        )}
                        <div className="max-h-56 overflow-y-auto custom-scrollbar">
                            {filtered.length > 0 ? filtered.map(opt => (
                                <button
                                    key={opt}
                                    type="button"
                                    onMouseDown={e => e.preventDefault()}
                                    onClick={() => handleSelect(opt)}
                                    className={`w-full flex items-center justify-between px-3.5 py-2.5 text-left text-sm transition-colors hover:bg-accent ${opt === value ? 'text-brand-600 font-medium bg-brand-50/40 dark:bg-brand-950/20' : 'text-foreground'}`}
                                >
                                    <span>{opt}</span>
                                    {opt === value && <Check className="w-4 h-4 flex-shrink-0" />}
                                </button>
                            )) : (
                                <p className="px-3.5 py-3 text-sm text-muted-foreground italic">No companies found</p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// New component for displaying read-only data in a way that matches form input styling.
export const FormDisplay: React.FC<{ label: string; value?: React.ReactNode; multiline?: boolean; children?: React.ReactNode }> =
    ({ label, value, multiline = false, children }) => (
        <div className={`flex flex-col ${multiline ? 'md:col-span-2' : ''}`}>
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground/70 mb-1.5">{label}</label>
            <div className={`block w-full px-3.5 py-2.5 bg-muted/30 border border-border/60 rounded-lg sm:text-sm text-foreground min-h-[42px] flex items-start pt-2.5 ${multiline ? 'whitespace-pre-wrap' : 'items-center'}`}>
                {children || value || <span className="text-muted-foreground/50 italic text-sm">N/A</span>}
            </div>
        </div>
    );
