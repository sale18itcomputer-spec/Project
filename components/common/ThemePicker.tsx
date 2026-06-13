'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useTheme, THEME_META } from '../providers/AppProviders';
import { Ban } from 'lucide-react';
import { hexToHsl } from '@/lib/utils';

type ThemeMetaEntry = (typeof THEME_META)[number];

type AccentPresetValue = { h: number; s: number } | null;

const ACCENT_PRESETS: { name: string; value: AccentPresetValue }[] = [
    { name: 'Default', value: null },
    { name: 'Teal', value: { h: 173, s: 80 } },
    { name: 'Violet', value: { h: 262, s: 83 } },
    { name: 'Rose', value: { h: 347, s: 77 } },
    { name: 'Amber', value: { h: 38, s: 92 } },
    { name: 'Emerald', value: { h: 160, s: 84 } },
];

const isSamePreset = (a: AccentPresetValue, b: AccentPresetValue) =>
    a === null || b === null ? a === b : a.h === b.h && a.s === b.s;

const ThemeSwatch: React.FC<{ meta: ThemeMetaEntry; active: boolean; onClick: () => void }> = ({ meta, active, onClick }) => (
    <button
        onClick={onClick}
        title={meta.label}
        aria-label={`Use ${meta.label} theme`}
        aria-pressed={active}
        className="group flex flex-col items-center gap-1 rounded-md p-1.5 transition-colors hover:bg-muted/60"
    >
        <span
            className={`relative block w-full h-10 rounded-md overflow-hidden border transition-all ${active ? 'border-primary ring-2 ring-primary/50' : 'border-border/60 group-hover:border-muted-foreground/40'}`}
            style={{ background: `hsl(${meta.bg})` }}
        >
            <span className="absolute bottom-1 left-1 w-2 h-2 rounded-full ring-1 ring-black/10" style={{ background: `hsl(${meta.card})` }} />
            <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full ring-1 ring-black/10" style={{ background: `hsl(${meta.fg})` }} />
            <span className="absolute bottom-1 right-1 w-2 h-2 rounded-full ring-1 ring-black/10" style={{ background: `hsl(${meta.primary})` }} />
        </span>
        <span className={`text-[10px] font-medium truncate w-full text-center ${active ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'}`}>
            {meta.label}
        </span>
    </button>
);

const AccentPickerPanel: React.FC = () => {
    const { accent, setAccent } = useTheme();
    const isCustom = accent !== null && !ACCENT_PRESETS.some(p => isSamePreset(p.value, accent));

    return (
        <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Override the active theme&apos;s accent color.</p>
            <div className="flex items-center gap-2 flex-wrap">
                {ACCENT_PRESETS.map(preset => (
                    <button
                        key={preset.name}
                        onClick={() => setAccent(preset.value)}
                        title={preset.name}
                        aria-label={preset.name}
                        className={`flex items-center justify-center w-7 h-7 rounded-full border border-border/50 transition-transform hover:scale-110 ${isSamePreset(accent, preset.value) ? 'ring-2 ring-offset-2 ring-offset-card ring-foreground' : ''}`}
                        style={preset.value ? { background: `hsl(${preset.value.h} ${preset.value.s}% 50%)` } : undefined}
                    >
                        {preset.value === null && <Ban size={14} className="text-muted-foreground" />}
                    </button>
                ))}
                <label
                    title="Custom color"
                    className={`relative w-7 h-7 rounded-full border border-border/50 cursor-pointer overflow-hidden transition-transform hover:scale-110 ${isCustom ? 'ring-2 ring-offset-2 ring-offset-card ring-foreground' : ''}`}
                    style={{
                        background: isCustom
                            ? `hsl(${accent!.h} ${accent!.s}% 50%)`
                            : 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)',
                    }}
                >
                    <input
                        type="color"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        onChange={(e) => {
                            const { h, s } = hexToHsl(e.target.value);
                            setAccent({ h, s });
                        }}
                        aria-label="Pick a custom accent color"
                    />
                </label>
            </div>
        </div>
    );
};

const ThemePicker: React.FC = () => {
    const { theme, setTheme, setAccent } = useTheme();
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState<'themes' | 'customize'>('themes');
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const handleClick = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [open]);

    return (
        <div className="relative" ref={containerRef}>
            <button
                onClick={() => setOpen(o => !o)}
                className="flex items-center justify-center w-9 h-9 rounded-lg bg-card border border-border hover:bg-muted transition-all duration-200 shadow-sm"
                aria-label="Choose theme and accent color"
                title="Theme"
            >
                <span className="w-4 h-4 rounded-full border border-border/50" style={{ background: 'hsl(var(--primary))' }} />
            </button>

            {open && (
                <div className="absolute right-0 top-full mt-2 z-50 w-80 rounded-lg bg-card border border-border shadow-lg overflow-hidden">
                    <div className="flex border-b border-border">
                        <button
                            onClick={() => setTab('themes')}
                            className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${tab === 'themes' ? 'text-foreground border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Themes
                        </button>
                        <button
                            onClick={() => setTab('customize')}
                            className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${tab === 'customize' ? 'text-foreground border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Customize
                        </button>
                    </div>

                    {tab === 'themes' ? (
                        <div className="grid grid-cols-4 gap-1 p-3 max-h-96 overflow-y-auto">
                            {THEME_META.map(meta => (
                                <ThemeSwatch
                                    key={meta.id}
                                    meta={meta}
                                    active={meta.id === theme}
                                    onClick={() => { setTheme(meta.id); setAccent(null); }}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="p-3">
                            <AccentPickerPanel />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ThemePicker;
