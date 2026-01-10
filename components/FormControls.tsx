import React from 'react';

// A more professional, modern card-based section for forms.
// Increased padding, uses a clean white background with a subtle shadow.
// The title is now a styled uppercase header for better visual hierarchy.
export const FormSection: React.FC<{ title?: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-white p-4 rounded-xl border border-brand-200/70 shadow-sm">
        {title && <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">{title}</h3>}
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
            <label htmlFor={name} className="block text-sm font-medium text-slate-600 mb-1.5">{label}{required && <span className="text-rose-500 ml-1">*</span>}</label>
            <input
                type={type}
                name={name}
                id={name}
                value={value || ''}
                onChange={onChange}
                required={required}
                placeholder={placeholder}
                readOnly={readOnly}
                step={step}
                list={list}
                className={`block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg placeholder-slate-400 focus:outline-none focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 sm:text-sm transition-colors duration-150 ${readOnly ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'hover:border-slate-300'} ${type === 'date' || type === 'time' ? '[color-scheme:light]' : ''}`}
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
                <label htmlFor={name} className="block text-sm font-medium text-slate-600">{label}{required && <span className="text-rose-500 ml-1">*</span>}</label>
                {actionButton}
            </div>
            <select
                name={name}
                id={name}
                value={value || ''}
                onChange={onChange}
                required={required}
                disabled={disabled}
                className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 sm:text-sm transition-colors duration-150 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed disabled:opacity-70 hover:border-slate-300"
            >
                <option value="" disabled>{getPlaceholder()}</option>
                {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
        </div>
    );
};


// Updated textarea with styles consistent with the new FormInput.
export const FormTextarea: React.FC<{ name: string; label: string; value: any; onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void; rows?: number; }> =
    ({ name, label, value, onChange, rows = 3 }) => (
        <div className="md:col-span-2 flex flex-col">
            <label htmlFor={name} className="block text-sm font-medium text-slate-600 mb-1.5">{label}</label>
            <textarea
                name={name}
                id={name}
                value={value || ''}
                onChange={onChange}
                rows={rows}
                className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg placeholder-slate-400 focus:outline-none focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 sm:text-sm transition-colors duration-150 hover:border-slate-300"
            />
        </div>
    );

// New component for displaying read-only data in a way that matches form input styling.
export const FormDisplay: React.FC<{ label: string; value?: React.ReactNode; multiline?: boolean; children?: React.ReactNode }> =
    ({ label, value, multiline = false, children }) => (
        <div className={`flex flex-col ${multiline ? 'md:col-span-2' : ''}`}>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">{label}</label>
            <div className={`block w-full px-3.5 py-2.5 bg-slate-50 border-transparent rounded-lg sm:text-sm text-slate-800 min-h-[42px] flex items-center ${multiline ? 'whitespace-pre-wrap' : ''}`}>
                {children || value || <span className="text-slate-400 italic">N/A</span>}
            </div>
        </div>
    );