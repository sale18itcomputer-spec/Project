'use client';

import React, { useEffect, useState } from 'react';
import { GhostAnimation } from '../../contexts/WindowManagerContext';

const GHOST_DURATION = 220;
const GHOST_EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';

/**
 * Lightweight placeholder rect animated (FLIP-style) between a window frame's
 * position and its minimized-dock chip's position, in either direction.
 * Rendered on top of everything by WindowManagerRoot while a minimize/restore
 * is in flight, then removed once the transition completes.
 */
const WindowGhost: React.FC<{ ghost: GhostAnimation; onDone: (ghostId: string) => void }> = ({ ghost, onDone }) => {
    const [animate, setAnimate] = useState(false);

    useEffect(() => {
        if (!ghost.toRect) return;
        const raf = requestAnimationFrame(() => setAnimate(true));
        return () => cancelAnimationFrame(raf);
    }, [ghost.toRect]);

    useEffect(() => {
        if (!animate) return;
        const timer = setTimeout(() => onDone(ghost.ghostId), GHOST_DURATION);
        return () => clearTimeout(timer);
    }, [animate, ghost.ghostId, onDone]);

    if (!ghost.toRect) return null;

    const rect = animate ? ghost.toRect : ghost.fromRect;

    return (
        <div
            className="fixed bg-card border border-border rounded-xl shadow-2xl pointer-events-none"
            style={{
                left: rect.x,
                top: rect.y,
                width: rect.width,
                height: rect.height,
                opacity: animate ? 0 : 1,
                transition: `left ${GHOST_DURATION}ms ${GHOST_EASING}, top ${GHOST_DURATION}ms ${GHOST_EASING}, width ${GHOST_DURATION}ms ${GHOST_EASING}, height ${GHOST_DURATION}ms ${GHOST_EASING}, opacity ${GHOST_DURATION}ms ease-in`,
                zIndex: 999998,
            }}
        />
    );
};

export default WindowGhost;
