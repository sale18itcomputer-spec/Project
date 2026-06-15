'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useTheme, THEME_META, THEME_BACKGROUNDS, type BgPattern } from '../providers/AppProviders';
import { CANVAS_PATTERNS, type CanvasBgPattern } from './backgroundPatterns';

const STATIC_PATTERNS = new Set<BgPattern>(['none', 'dots']);

// Fixed, full-viewport ambient background layer rendered behind all app
// content. The active pattern + tuning is driven by THEME_BACKGROUNDS
// (AppProviders.tsx), which also sets --bg-effect-color/--bg-effect-intensity
// on <html> for the CSS-only patterns (dots / synapse grid).
export default function ThemeBackground() {
    const { theme } = useTheme();
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    // theme's initial state reads localStorage on the client but defaults to
    // 'light' during SSR, so its first-render pattern can differ from the
    // server's. Render nothing until after mount so the very first client
    // render matches SSR exactly, then pick up the real theme on the next tick.
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    const { pattern, effectColor, intensity = 1 } = THEME_BACKGROUNDS[theme];
    // Fall back to the active theme's own foreground (from THEME_META, not a
    // CSS read) so the color is correct immediately on theme switch — this
    // effect can run before AppProviders' theme-class effect applies
    // .theme-<id> to <html>.
    const color = effectColor ?? `hsl(${THEME_META.find(t => t.id === theme)?.fg ?? '0 0% 100%'})`;

    useEffect(() => {
        if (!mounted) return;
        if (STATIC_PATTERNS.has(pattern)) return;
        const canvas = canvasRef.current;
        if (!canvas) return;

        const sizeRaw = getComputedStyle(document.documentElement).getPropertyValue('--bg-effect-size').trim();
        const size = parseFloat(sizeRaw) || 1;

        const stop = CANVAS_PATTERNS[pattern as CanvasBgPattern](canvas, { color, intensity, size });
        return stop;
    }, [mounted, pattern, color, intensity]);

    if (!mounted || pattern === 'none') return null;

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
