const TAB_ID = typeof window !== 'undefined' ? Math.random().toString(36).slice(2) : '';
const CHANNEL_NAME = 'limperial-data-sync';

function getChannel(): BroadcastChannel | null {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return null;
    try { return new BroadcastChannel(CHANNEL_NAME); } catch { return null; }
}

export function broadcastDataChange(entity: string): void {
    const ch = getChannel();
    if (!ch) return;
    ch.postMessage({ entity, fromTab: TAB_ID });
    ch.close();
}

export function onDataChange(callback: (entity: string) => void): () => void {
    const ch = getChannel();
    if (!ch) return () => {};
    const handler = (e: MessageEvent) => {
        if (e.data?.fromTab === TAB_ID) return;
        if (e.data?.entity) callback(e.data.entity);
    };
    ch.addEventListener('message', handler);
    return () => { ch.removeEventListener('message', handler); ch.close(); };
}
