import { redirect } from 'next/navigation';

// This route is retired — all invoice functionality lives under /invoices.
// The redirect preserves any bookmarks or external links that pointed here.
export default function InvoiceDOPage() {
    redirect('/invoices');
}
