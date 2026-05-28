'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';

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
export const FormInput: React.FC<{ name: string; label: string; value: any; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; type?: string; required?: boolean; placeholder?: string; readOnly?: boolean; step?: string; list?: string; datalistOptions?: readonly string[]; }> =
    ({ name, label, value, onChange, type = 'text', required = false, placeholder, readOnly = false, step, list, datalistOptions }) => (
        <div className="flex flex-col">
            <label htmlFor={name} className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground/70 mb-1.5">{label}{required && <span className="text-rose-500 ml-1">*</span>}</label>
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

// Updated select with styles consistent with the new FormInput.
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
    const getPlaceholder = () => {
        if (disabled) {
            return disabledPlaceholder || `Select ${label}`;
        }
        return `Select ${label}`;
    }

    return (
        <div className="flex flex-col">
            <div className="flex justify-between items-baseline mb-1.5">
                <label htmlFor={name} className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">{label}{required && <span className="text-rose-500 ml-1">*</span>}</label>
                {actionButton}
            </div>
            <select
                name={name}
                id={name}
                value={value || ''}
                onChange={onChange}
                required={required}
                disabled={disabled}
                className="block w-full px-3.5 py-2.5 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:bg-background focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 sm:text-sm transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed hover:border-muted-foreground/40 dark:[color-scheme:dark]"
            >
                <option value="" disabled className="bg-card">{getPlaceholder()}</option>
                {options.map(opt => <option key={opt} value={opt} className="bg-card">{opt}</option>)}
            </select>
        </div>
    );
};


// Updated textarea with styles consistent with the new FormInput.
export const FormTextarea: React.FC<{ name: string; label: string; value: any; onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void; rows?: number; placeholder?: string; }> =
    ({ name, label, value, onChange, rows = 3, placeholder }) => (

        <div className="md:col-span-2 flex flex-col">
            <label htmlFor={name} className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground/70 mb-1.5">{label}</label>
            <textarea
                name={name}
                id={name}
                value={value || ''}
                onChange={onChange}
                rows={rows}
                placeholder={placeholder}
                className="block w-full px-3.5 py-2.5 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:bg-background focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 sm:text-sm transition-colors duration-150 hover:border-muted-foreground/40 resize-none"
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
