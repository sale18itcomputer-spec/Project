'use client';

import React, { useState, useEffect, Suspense } from 'react';

// The overlay pulls in every window content component, so it is lazy-loaded
// the first time the palette is opened rather than on every page load.
const GlobalSearchOverlay = React.lazy(() => import('./GlobalSearchOverlay'));

/**
 * Global search launcher — mounts nothing until the user opens the palette
 * with Ctrl+K / Cmd+K or the 'open-global-search' window event (dispatched
 * by the Header search box).
 */
const GlobalSearch: React.FC = () => {
    const [open, setOpen] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setMounted(true);
                setOpen(o => !o);
            }
        };
        const onOpen = () => { setMounted(true); setOpen(true); };
        window.addEventListener('keydown', onKey);
        window.addEventListener('open-global-search', onOpen);
        return () => {
            window.removeEventListener('keydown', onKey);
            window.removeEventListener('open-global-search', onOpen);
        };
    }, []);

    if (!mounted) return null;

    return (
        <Suspense fallback={null}>
            <GlobalSearchOverlay open={open} onClose={() => setOpen(false)} />
        </Suspense>
    );
};

export default GlobalSearch;
