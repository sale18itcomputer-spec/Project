'use client';

import { useRouter } from 'next/navigation';
import {
    FileText, ShoppingCart, Receipt, Package,
    Truck, ClipboardList, TrendingUp, ChevronRight,
} from 'lucide-react';
import { useMiniAppAuth } from '@/contexts/MiniAppAuthContext';

const DOC_TYPES = [
    { id: 'quotations', label: 'Quotations', icon: FileText, color: 'bg-sky-500/10 text-sky-500', accent: 'border-sky-500/30', href: '/miniapp/sales/quotations' },
    { id: 'sale-orders', label: 'Sale Orders', icon: ShoppingCart, color: 'bg-emerald-500/10 text-emerald-500', accent: 'border-emerald-500/30', href: '/miniapp/sales/sale-orders' },
    { id: 'invoices', label: 'Invoices', icon: Receipt, color: 'bg-violet-500/10 text-violet-500', accent: 'border-violet-500/30', href: '/miniapp/sales/invoices' },
    { id: 'delivery-orders', label: 'Delivery Orders', icon: Truck, color: 'bg-orange-500/10 text-orange-500', accent: 'border-orange-500/30', href: '/miniapp/sales/delivery-orders' },
    { id: 'receipts', label: 'Receipts', icon: ClipboardList, color: 'bg-pink-500/10 text-pink-500', accent: 'border-pink-500/30', href: '/miniapp/sales/receipts' },
    { id: 'purchase-orders', label: 'Purchase Orders', icon: Package, color: 'bg-amber-500/10 text-amber-500', accent: 'border-amber-500/30', href: '/miniapp/sales/purchase-orders' },
    { id: 'weekly-report', label: 'Weekly Report', icon: TrendingUp, color: 'bg-teal-500/10 text-teal-500', accent: 'border-teal-500/30', href: '/miniapp/sales/weekly-report' },
] as const;

export default function MiniAppHome() {
    const router = useRouter();
    const { authState } = useMiniAppAuth();

    const user = authState.status === 'authenticated' ? authState.user : null;
    const tgUser = authState.status === 'authenticated' ? authState.telegramUser : null;
    const displayName = user?.Name || tgUser?.first_name || '';
    const avatarLetter = displayName?.[0]?.toUpperCase() || 'L';
    const photoUrl = tgUser?.photo_url;

    return (
        <div className="min-h-screen bg-background flex flex-col">
            {/* Header */}
            <header className="bg-card border-b border-border px-4 pt-4 pb-3 flex-shrink-0">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-lg font-bold text-foreground">Sales Documents</h1>
                        {displayName && (
                            <p className="text-xs text-muted-foreground mt-0.5">Hi, {displayName} 👋</p>
                        )}
                        {user?.Role && (
                            <p className="text-[10px] text-muted-foreground/70">{user.Role}</p>
                        )}
                    </div>
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-brand-600 flex items-center justify-center flex-shrink-0">
                        {photoUrl
                            ? <img src={photoUrl} alt={displayName} className="w-full h-full object-cover" />
                            : <span className="text-white font-bold text-sm">{avatarLetter}</span>
                        }
                    </div>
                </div>
            </header>

            {/* Doc type list */}
            <main className="flex-1 p-4 space-y-2">
                {DOC_TYPES.map(({ id, label, icon: Icon, color, accent, href }) => (
                    <button
                        key={id}
                        onClick={() => router.push(href)}
                        className={`w-full flex items-center gap-4 p-4 rounded-xl bg-card border ${accent} active:scale-[0.98] transition-all text-left shadow-sm`}
                    >
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
                            <Icon size={22} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <span className="text-sm font-semibold text-foreground">{label}</span>
                        </div>
                        <ChevronRight size={18} className="text-muted-foreground flex-shrink-0" />
                    </button>
                ))}
            </main>

            {/* Footer */}
            <footer className="flex-shrink-0 px-4 pb-6 pt-2 text-center">
                <p className="text-xs text-muted-foreground">Limperial Technology</p>
            </footer>
        </div>
    );
}
