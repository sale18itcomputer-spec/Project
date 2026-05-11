export const PIN_STORAGE_KEY = 'limperial_local_pin';
export const UNLOCK_STORAGE_KEY = 'limperial_unlocked';
export const AUTOLOCK_STORAGE_KEY = 'limperial_autolock_ms';
export const SETUP_PHASE_KEY = 'limperial_setup_phase';

export async function hashPin(pin: string): Promise<string> {
    const msgBuffer = new TextEncoder().encode(pin);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
