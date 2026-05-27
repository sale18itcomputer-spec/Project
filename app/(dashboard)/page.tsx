// Server component — redirect happens before any HTML is sent to the browser.
// Using server-side redirect instead of a client-side useEffect+router.replace
// to avoid the React 19/StrictMode double-invoke issue (the effect fired twice,
// briefly trapping navigation at this route and preventing other pages from loading).
import { redirect } from 'next/navigation';

export default function RootPage() {
    redirect('/dashboard');
}
