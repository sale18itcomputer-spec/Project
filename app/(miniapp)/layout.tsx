import type { Metadata, Viewport } from 'next';
import { Toaster } from '@/components/ui/sonner';
import MiniAppProviders from '@/components/providers/MiniAppProviders';

export const metadata: Metadata = {
    title: 'Sales | Limperial',
    description: 'Sales documents mini app',
};

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    themeColor: '#004aad',
};

export default function MiniAppLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            <MiniAppProviders>
                {children}
            </MiniAppProviders>
            <Toaster />
        </>
    );
}
