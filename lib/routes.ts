/**
 * Single source of truth for route → human label.
 *
 * There used to be four independent maps: Sidebar's NAV_ITEMS,
 * Header.getBreadcrumbs, Header.getMobileTitle, and MobileBottomNav's
 * nav arrays. They had already drifted ("Quotations" vs "Quotes",
 * "Delivery Orders" vs "Delivery", "Vendor Pricelist" vs "Vendor Price")
 * and seven routes — /pos, /assistant, /service-invoices, /service-tickets,
 * /pdi-records, /serial-numbers, /spare-parts — were missing from the mobile
 * map entirely, so the phone header just said "Dashboard" on those pages.
 *
 * `label` is the canonical name. `short` is for width-constrained chrome
 * (mobile title bar, bottom tab bar); it defaults to `label`.
 */

export interface RouteMeta {
    label: string;
    /** Compact variant for the mobile header and bottom tab bar. */
    short?: string;
}

export const ROUTE_META: Record<string, RouteMeta> = {
    '/': { label: 'Dashboard' },
    '/dashboard': { label: 'Dashboard' },

    // ── CRM ──
    '/companies': { label: 'Companies' },
    '/contacts': { label: 'Contacts' },
    '/contact-logs': { label: 'Contact Logs', short: 'Logs' },
    '/meetings': { label: 'Meetings' },

    // ── Operations ──
    '/projects': { label: 'Pipelines' },
    '/site-surveys': { label: 'Site Surveys', short: 'Surveys' },

    // ── Sales ──
    '/pos': { label: 'POS' },
    '/quotations': { label: 'Quotations', short: 'Quotes' },
    '/sale-orders': { label: 'Sale Orders', short: 'Orders' },
    '/invoices': { label: 'Invoices' },
    '/delivery-orders': { label: 'Delivery Orders', short: 'Delivery' },
    '/receipts': { label: 'Receipts' },
    '/collection': { label: 'Collection' },
    '/invoice-do': { label: 'Invoice + DO', short: 'Invoice+DO' },
    '/weekly-report': { label: 'Weekly Report', short: 'Report' },

    // ── Inventory / pricing ──
    '/pricelist': { label: 'Pricelist' },
    '/b2b-pricelist': { label: 'B2B Pricelist', short: 'B2B' },
    '/vendor-pricelist': { label: 'Vendor Pricelist', short: 'Vendor Price' },
    '/vendors': { label: 'Vendor Master', short: 'Vendors' },
    '/inventory': { label: 'Inventory' },

    // ── Procurement ──
    '/purchase-orders': { label: 'Purchase Orders', short: 'POs' },
    '/inquiries': { label: 'Product Inquiries', short: 'Inquiries' },
    '/consignment': { label: 'Consignment' },

    // ── Service ──
    '/service-tickets': { label: 'Service Tickets', short: 'Tickets' },
    '/service-invoices': { label: 'Service Invoices', short: 'Svc Invoices' },
    '/pdi-records': { label: 'PDI Records', short: 'PDI' },
    '/serial-numbers': { label: 'Serial Numbers', short: 'Serials' },
    '/spare-parts': { label: 'Spare Parts', short: 'Parts' },

    // ── Admin / tools ──
    '/users': { label: 'Users' },
    '/audit-log': { label: 'Audit Log' },
    '/accounting': { label: 'Accounting' },
    '/pricing-calculator': { label: 'Pricing Calculator', short: 'Calculator' },
    '/pdf-layout-editor': { label: 'PDF Layout Editor', short: 'PDF Layout' },
    '/assistant': { label: 'AI Assistant', short: 'Assistant' },
};

/**
 * Resolve a pathname to its route metadata using longest-prefix matching, so
 * detail routes (`/quotations/QT-001`) still resolve to their section.
 * Returns `undefined` for genuinely unknown paths — callers decide the
 * fallback rather than silently displaying "Dashboard".
 */
export function getRouteMeta(pathname: string): RouteMeta | undefined {
    if (ROUTE_META[pathname]) return ROUTE_META[pathname];

    let best: string | undefined;
    for (const path of Object.keys(ROUTE_META)) {
        if (path === '/') continue;
        if (pathname.startsWith(path + '/') && (!best || path.length > best.length)) {
            best = path;
        }
    }
    return best ? ROUTE_META[best] : undefined;
}

/** Canonical full label, e.g. "Delivery Orders". */
export function getRouteLabel(pathname: string, fallback = 'Dashboard'): string {
    return getRouteMeta(pathname)?.label ?? fallback;
}

/** Compact label for the mobile title bar / bottom tabs, e.g. "Delivery". */
export function getRouteShortLabel(pathname: string, fallback = 'Dashboard'): string {
    const meta = getRouteMeta(pathname);
    return meta ? (meta.short ?? meta.label) : fallback;
}
