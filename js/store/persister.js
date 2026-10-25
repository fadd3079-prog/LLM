const STORAGE_KEY = 'ai_workspace_data';
const DB_NAME = 'ai_workspace';

export const DEFAULT_CONFIG = {
    provider: 'openrouter', apiKey: '', apiKeys: {}, customBaseUrls: {}, providerModels: {},
    theme: 'system',
    systemPrompt: 'Jawablah dalam Bahasa Indonesia kecuali diminta menggunakan bahasa lain.',
    temperature: 0.7, maxTokens: 2048, selectedModel: 'google/gemini-2.5-flash'
};

let database;
function openDatabase() {
    if (!globalThis.indexedDB) return Promise.reject(new Error('IndexedDB tidak tersedia'));
    if (!database) database = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => request.result.createObjectStore('workspace');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error('Penyimpanan sedang digunakan tab lain. Tutup tab lama.'));
    });
    return database;
}

export async function loadStateFromStorage() {
    try {
        const db = await openDatabase();
        const saved = await new Promise((resolve, reject) => {
            const req = db.transaction('workspace').objectStore('workspace').get('state');
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
        if (saved) return saved;
    } catch (err) { console.warn('IndexedDB tidak tersedia; mencoba penyimpanan cadangan.', err); }
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); }
    catch { return null; }
}

export async function saveStateToStorage(data) {
    // Capture this revision before waiting for a transaction; never prune user history.
    const snapshot = structuredClone(data);
    try {
        const db = await openDatabase();
        await new Promise((resolve, reject) => {
            const tx = db.transaction('workspace', 'readwrite');
            tx.objectStore('workspace').put(snapshot, 'state');
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
        });
        try { localStorage.removeItem(STORAGE_KEY); } catch { /* Migration already saved. */ }
        return true;
    } catch (err) {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot)); return true; }
        catch {
            globalThis.window?.dispatchEvent(new CustomEvent('storage-error', { detail: { message: 'Gagal menyimpan riwayat. Periksa ruang penyimpanan browser sebelum menutup halaman.' } }));
            return false;
        }
    }
}

export async function clearStorage() {
    try {
        const db = await openDatabase();
        await new Promise((resolve, reject) => {
            const tx = db.transaction('workspace', 'readwrite');
            tx.objectStore('workspace').delete('state');
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
        localStorage.removeItem(STORAGE_KEY);
        return true;
    } catch { return false; }
}
