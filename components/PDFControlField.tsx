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
        bg: 'bg-blue-50/50',
        hoverBg: 'hover:bg-blue-50',
        border: 'border-blue-200/60',
        text: 'text-blue-600',
        gradient: '#3b82f6',
        ring: 'ring-blue-500/20'
    },
    emerald: {
        bg: 'bg-emerald-50/50',
        hoverBg: 'hover:bg-emerald-50',
        border: 'border-emerald-200/60',
        text: 'text-emerald-600',
        gradient: '#10b981',
        ring: 'ring-emerald-500/20'
    },
    purple: {
        bg: 'bg-purple-50/50',
        hoverBg: 'hover:bg-purple-50',
        border: 'border-purple-200/60',
        text: 'text-purple-600',
        gradient: '#a855f7',
        ring: 'ring-purple-500/20'
    },
    amber: {
        bg: 'bg-amber-50/50',
        hoverBg: 'hover:bg-amber-50',
        border: 'border-amber-200/60',
        text: 'text-amber-600',
        gradient: '#f59e0b',
        ring: 'ring-amber-500/20'
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

    // Fallback if path doesn't exist yet
    if (value === undefined) value = 0;

    const handleIncrement = () => onUpdate(path, parseFloat((value + step).toFixed(2)));
    const handleDecrement = () => onUpdate(path, parseFloat((value - step).toFixed(2)));

    const colors = colorMap[accentColor as keyof typeof colorMap] || colorMap.blue;
    const percentage = ((value - min) / (max - min)) * 100;
    const isHovered = hoveredPath === path;

    return (
        <div
            className={`group relative flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 py-3 sm:py-2.5 px-3 sm:px-3 rounded-lg transition-all duration-200 ${isHovered
                    ? `bg-white shadow-lg ring-2 ${colors.ring} sm:scale-[1.02]`
                    : `${colors.bg} hover:bg-white/80 hover:shadow-md`
                }`}
            onMouseEnter={() => onHover(path)}
            onMouseLeave={() => onHover(null)}
        >
            {/* Label - Full width on mobile, fixed width on larger screens */}
            <div className="w-full sm:w-24 md:w-28 flex-shrink-0">
                <label className={`text-[11px] sm:text-[10px] font-bold uppercase tracking-wider block leading-tight transition-colors ${isHovered ? colors.text : 'text-gray-500'
                    }`}>
                    {label}
                </label>
            </div>

            {/* Control Area - Full width on mobile, flex-1 on larger screens */}
            <div className="flex-1 flex items-center gap-2 sm:gap-2 min-h-[44px] sm:min-h-0">
                {/* Decrement Button - Touch-friendly on mobile */}
                <button
                    onClick={handleDecrement}
                    disabled={value <= min}
                    className={`flex-shrink-0 w-10 h-10 sm:w-6 sm:h-6 sm:opacity-0 sm:group-hover:opacity-100 flex items-center justify-center rounded-md transition-all duration-200 ${value <= min
                            ? 'text-gray-300 cursor-not-allowed'
                            : `text-gray-500 ${colors.hoverBg} ${colors.text} active:scale-95 sm:hover:scale-110`
                        }`}
                    title="Decrease"
                >
                    <Minus className="w-4 h-4 sm:w-3 sm:h-3" strokeWidth={2.5} />
                </button>

                {/* Slider Container - Larger touch area on mobile */}
                <div className="flex-1 relative h-10 sm:h-8 flex items-center touch-none">
                    {/* Track Background */}
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full h-3 sm:h-2 bg-gray-200 rounded-full overflow-hidden">
                            {/* Progress Fill */}
                            <div
                                className={`h-full transition-all duration-150 ease-out ${isHovered ? 'opacity-100' : 'opacity-90'
                                    }`}
                                style={{
                                    width: `${percentage}%`,
                                    background: `linear-gradient(90deg, ${colors.gradient} 0%, ${colors.gradient}dd 100%)`
                                }}
                            />
                        </div>
                    </div>

                    {/* Slider Input - Larger thumb on mobile */}
                    <input
                        type="range"
                        min={min}
                        max={max}
                        step={step}
                        value={value}
                        onChange={e => onUpdate(path, Number(e.target.value))}
                        className="relative w-full h-3 sm:h-2 bg-transparent appearance-none cursor-pointer z-10 mobile-slider"
                        style={{
                            WebkitAppearance: 'none',
                        }}
                    />
                </div>

                {/* Increment Button - Touch-friendly on mobile */}
                <button
                    onClick={handleIncrement}
                    disabled={value >= max}
                    className={`flex-shrink-0 w-10 h-10 sm:w-6 sm:h-6 sm:opacity-0 sm:group-hover:opacity-100 flex items-center justify-center rounded-md transition-all duration-200 ${value >= max
                            ? 'text-gray-300 cursor-not-allowed'
                            : `text-gray-500 ${colors.hoverBg} ${colors.text} active:scale-95 sm:hover:scale-110`
                        }`}
                    title="Increase"
                >
                    <Plus className="w-4 h-4 sm:w-3 sm:h-3" strokeWidth={2.5} />
                </button>
            </div>

            {/* Value Display - Larger on mobile, compact on desktop */}
            <div className={`flex items-center justify-center sm:justify-end gap-1.5 px-3 py-2 sm:px-2.5 sm:py-1.5 rounded-md border transition-all min-h-[44px] sm:min-h-0 ${isHovered ? `${colors.border} bg-white` : 'border-gray-200/60 bg-gray-50/50'
                }`}>
                <input
                    type="number"
                    value={value}
                    step={step}
                    onChange={e => onUpdate(path, Number(e.target.value))}
                    className={`w-14 sm:w-11 bg-transparent text-sm sm:text-[11px] font-mono font-bold text-center sm:text-right focus:outline-none transition-colors ${isHovered ? colors.text : 'text-gray-700'
                        }`}
                />
                <span className="text-[10px] sm:text-[9px] font-bold text-gray-400 uppercase tracking-wider">{unit}</span>
            </div>

            {/* Hover Indicator - Hidden on mobile, visible on desktop */}
            {isHovered && (
                <div className={`hidden sm:block absolute left-0 top-1/2 -translate-y-1/2 w-1 h-3/4 rounded-r-full ${accentColor === 'blue' ? 'bg-blue-500' :
                        accentColor === 'emerald' ? 'bg-emerald-500' :
                            accentColor === 'purple' ? 'bg-purple-500' :
                                accentColor === 'amber' ? 'bg-amber-500' : 'bg-blue-500'
                    } transition-all duration-200`} />
            )}
        </div>
    );
};

export default PDFControlField;
