'use client';

import React from 'react';
import { Plus, Minus } from 'lucide-react';

interface PDFControlFieldProps {
    label: string;
    path: string;
    min: number;
    max: number;
    step?: number;
    unit?: string;
    layout: any;
    onUpdate: (path: string, value: number) => void;
    onHover: (path: string | null) => void;
    hoveredPath: string | null;
    accentColor?: string;
}

// Color mapping for consistent theming
const colorMap = {
    blue: {
        text: 'text-blue-500',
        gradient: '#3b82f6',
    },
    emerald: {
        text: 'text-emerald-500',
        gradient: '#10b981',
    },
    purple: {
        text: 'text-purple-500',
        gradient: '#a855f7',
    },
    amber: {
        text: 'text-amber-500',
        gradient: '#f59e0b',
    }
};

const PDFControlField: React.FC<PDFControlFieldProps> = ({
    label,
    path,
    min,
    max,
    step = 1,
    unit = 'mm',
    layout,
    onUpdate,
    onHover,
    hoveredPath,
    accentColor = 'blue'
}) => {
    const keys = path.split('.');
    let value: any = layout;
    for (const key of keys) {
        if (value === undefined || value === null) break;
        value = value[key];
    }

    if (value === undefined) value = 0;

    const handleIncrement = () => onUpdate(path, parseFloat((value + step).toFixed(2)));
    const handleDecrement = () => onUpdate(path, parseFloat((value - step).toFixed(2)));

    const colors = colorMap[accentColor as keyof typeof colorMap] || colorMap.blue;
    const percentage = ((value - min) / (max - min)) * 100;
    const isHovered = hoveredPath === path;

    return (
        <div
            className={`group relative flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 py-3 sm:py-2 px-3 rounded-xl transition-all duration-300 ${isHovered
                ? `bg-card shadow-lg ring-1 ring-border border-border`
                : `hover:bg-card/50 border border-transparent`
                }`}
            onMouseEnter={() => onHover(path)}
            onMouseLeave={() => onHover(null)}
        >
            {/* Label */}
            <div className="w-full sm:w-28 flex-shrink-0">
                <label className={`text-[10px] font-bold uppercase tracking-widest block leading-tight transition-colors ${isHovered ? colors.text : 'text-muted-foreground/60'}`}>
                    {label}
                </label>
            </div>

            {/* Slider Area */}
            <div className="flex-1 flex items-center gap-3">
                <button
                    onClick={handleDecrement}
                    disabled={value <= min}
                    className={`flex-shrink-0 w-8 h-8 sm:w-5 sm:h-5 flex items-center justify-center rounded-md transition-all ${value <= min
                        ? 'text-muted-foreground/20 cursor-not-allowed'
                        : `text-muted-foreground hover:text-foreground hover:bg-muted active:scale-90`
                        }`}
                >
                    <Minus className="w-3.5 h-3.5 sm:w-3 sm:h-3" strokeWidth={3} />
                </button>

                <div className="flex-1 relative h-6 flex items-center touch-none">
                    <div className="absolute inset-0 flex items-center px-1">
                        <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                            <div
                                className="h-full transition-all duration-150 ease-out opacity-80"
                                style={{
                                    width: `${percentage}%`,
                                    background: colors.gradient
                                }}
                            />
                        </div>
                    </div>
                    <input
                        type="range"
                        min={min}
                        max={max}
                        step={step}
                        value={value}
                        onChange={e => onUpdate(path, Number(e.target.value))}
                        className="relative w-full h-4 bg-transparent appearance-none cursor-pointer z-10"
                        style={{ WebkitAppearance: 'none' }}
                    />
                </div>

                <button
                    onClick={handleIncrement}
                    disabled={value >= max}
                    className={`flex-shrink-0 w-8 h-8 sm:w-5 sm:h-5 flex items-center justify-center rounded-md transition-all ${value >= max
                        ? 'text-muted-foreground/20 cursor-not-allowed'
                        : `text-muted-foreground hover:text-foreground hover:bg-muted active:scale-90`
                        }`}
                >
                    <Plus className="w-3.5 h-3.5 sm:w-3 sm:h-3" strokeWidth={3} />
                </button>
            </div>

            {/* Input Display */}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all ${isHovered ? `border-border bg-muted/50` : 'border-transparent bg-muted/30'}`}>
                <input
                    type="number"
                    value={value}
                    step={step}
                    onChange={e => onUpdate(path, Number(e.target.value))}
                    className={`w-12 bg-transparent text-[11px] font-mono font-black text-right focus:outline-none ${isHovered ? colors.text : 'text-foreground'}`}
                />
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tight">{unit}</span>
            </div>
        </div>
    );
};

export default PDFControlField;

