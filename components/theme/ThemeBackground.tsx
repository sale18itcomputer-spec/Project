'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useTheme, THEME_META, THEME_BACKGROUNDS, type BgPattern } from '../providers/AppProviders';
import { CANVAS_PATTERNS, type CanvasBgPattern } from './backgroundPatterns';
import TechBackground3D from './TechBackground3D';

const STATIC_PATTERNS = new Set<BgPattern>(['none', 'dots']);
const THREE_D_PATTERNS = new Set<BgPattern>(['tech-3d']);

// Fixed, full-viewport ambient background layer rendered behind all app
// content. The active pattern + tuning is driven by THEME_BACKGROUNDS
// (AppProviders.tsx), which also sets --bg-effect-color/--bg-effect-intensity
// on <html> for the CSS-only patterns (dots / synapse grid).
export default function ThemeBackground() {
    const { theme, patternOverride } = useTheme();
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    const themeBg = THEME_BACKGROUNDS[theme];
    const pattern = patternOverride ?? themeBg.pattern;
    const { effectColor, intensity = 1 } = themeBg;
    const color = effectColor ?? `hsl(${THEME_META.find(t => t.id === theme)?.fg ?? '0 0% 100%'})`;

    useEffect(() => {
        if (!mounted) return;
        if (STATIC_PATTERNS.has(pattern) || THREE_D_PATTERNS.has(pattern)) return;
        const canvas = canvasRef.current;
        if (!canvas) return;

        const sizeRaw = getComputedStyle(document.documentElement).getPropertyValue('--bg-effect-size').trim();
        const size = parseFloat(sizeRaw) || 1;

        const stop = CANVAS_PATTERNS[pattern as CanvasBgPattern](canvas, { color, intensity, size });
        return stop;
    }, [mounted, pattern, color, intensity]);

    if (!mounted || pattern === 'none') return null;

    if (pattern === 'tech-3d') return <TechBackground3D color={color} intensity={intensity} />;

    return (
        <>
            {pattern === 'dots' && <div aria-hidden className="theme-bg-layer bg-pattern-dots" />}
            {pattern === 'synapse' && <div aria-hidden className="theme-bg-layer bg-pattern-synapse-grid" />}
            {!STATIC_PATTERNS.has(pattern) && (
                <canvas ref={canvasRef} aria-hidden className="theme-bg-layer theme-bg-canvas" />
            )}
        </>
    );
}
