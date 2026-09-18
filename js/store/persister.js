const STORAGE_KEY = 'ai_workspace_data';
const MAX_STORAGE_SIZE = 4 * 1024 * 1024; // 4MB safety limit (localStorage typically has 5-10MB)

export const DEFAULT_CONFIG = {
    provider: 'openrouter',
    apiKey: '',
    apiKeys: {},
    customBaseUrls: {},
    providerModels: {},
    baseUrl: 'https://openrouter.ai/api/v1',
    theme: 'system',
    systemPrompt: 'Anda adalah asisten AI yang cerdas, ramah, dan membantu. Jawablah selalu dalam Bahasa Indonesia kecuali diminta menggunakan bahasa lain.',
    temperature: 0.7,
    maxTokens: 2048,
    selectedModel: 'google/gemini-2.5-flash'
};

export function loadStateFromStorage() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed?.config) {
            // Migrasi mundur jika apiKeys objek belum ada
            if (!parsed.config.apiKeys) parsed.config.apiKeys = {};
            if (parsed.config.apiKey && !parsed.config.apiKeys[parsed.config.provider || 'openrouter']) {
                parsed.config.apiKeys[parsed.config.provider || 'openrouter'] = parsed.config.apiKey;
            }
            if (!parsed.config.customBaseUrls) parsed.config.customBaseUrls = {};
            if (!parsed.config.providerModels) parsed.config.providerModels = {};
            if (parsed.selectedModel && !parsed.config.providerModels[parsed.config.provider || 'openrouter']) {
                parsed.config.providerModels[parsed.config.provider || 'openrouter'] = parsed.selectedModel;
            }
        }
        return parsed;
    } catch (e) {
        console.warn('Gagal membaca storage, menggunakan default:', e);
        return null;
    }
}

function estimateSize(data) {
    try {
        return new Blob([JSON.stringify(data)]).size;
    } catch (e) {
        return 0;
    }
}

function pruneChatsForStorage(chats, maxChats = 50) {
    // Keep only the most recent chats if too many
    if (chats.length <= maxChats) return chats;
    // Sort by most recent message timestamp, keep top N
    return chats
        .sort((a, b) => {
            const aTime = a.messages?.length > 0 ? a.messages[a.messages.length - 1].timestamp || 0 : a.createdAt || 0;
            const bTime = b.messages?.length > 0 ? b.messages[b.messages.length - 1].timestamp || 0 : b.createdAt || 0;
            return bTime - aTime;
        })
        .slice(0, maxChats);
}

export function saveStateToStorage(data) {
    try {
        const serialized = JSON.stringify(data);
        
        // Check size before saving
        if (serialized.length > MAX_STORAGE_SIZE) {
            console.warn('Storage data exceeds safety limit, attempting to prune...');
            
            // Try pruning chats
            if (data.chats && data.chats.length > 10) {
                const prunedData = {
                    ...data,
                    chats: pruneChatsForStorage(data.chats, 20)
                };
                const prunedSize = new Blob([JSON.stringify(prunedData)]).size;
                
                if (prunedSize <= MAX_STORAGE_SIZE) {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(prunedData));
                    return true;
                }
                
                // If still too large, try further pruning
                const ultraPrunedData = {
                    ...data,
                    chats: pruneChatsForStorage(data.chats, 10).map(c => ({
                        ...c,
                        messages: c.messages?.slice(-20) || []
                    }))
                };
                const ultraSize = new Blob([JSON.stringify(ultraPrunedData)]).size;
                if (ultraSize <= MAX_STORAGE_SIZE) {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(ultraPrunedData));
                    return true;
                }
            }
            
            // If still too large, try saving without activeStream
            const withoutStream = { ...data, activeStream: null };
            const withoutStreamSize = new Blob([JSON.stringify(withoutStream)]).size;
            if (withoutStreamSize <= MAX_STORAGE_SIZE) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(withoutStream));
                return true;
            }
            
            console.error('Storage data too large even after pruning');
            notifyStorageError('Data terlalu besar untuk disimpan di browser.');
            return false;
        }
        
        localStorage.setItem(STORAGE_KEY, serialized);
        return true;
    } catch (e) {
        if (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014) {
            console.error('LocalStorage quota exceeded:', e);
            // Attempt emergency pruning
            try {
                emergencyPrune();
                localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
                return true;
            } catch (retryErr) {
                console.error('Emergency storage save also failed:', retryErr);
                notifyStorageError('Penyimpanan browser penuh. Beberapa data mungkin tidak tersimpan.');
                return false;
            }
        }
        console.error('Gagal menyimpan ke LocalStorage:', e);
        notifyStorageError('Gagal menyimpan data. Penyimpanan browser mungkin penuh.');
        return false;
    }
}

function notifyStorageError(message) {
    // Dispatch a custom event so the UI can show a toast
    try {
        window.dispatchEvent(new CustomEvent('storage-error', { detail: { message } }));
    } catch (e) {
        // Fallback: console only
    }
}

function emergencyPrune() {
    // Keep only config and the last 5 chats with minimal messages
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    
    try {
        const data = JSON.parse(raw);
        if (data.chats && data.chats.length > 0) {
            data.chats = data.chats.slice(0, 5).map(c => ({
                id: c.id,
                title: c.title,
                pinned: c.pinned,
                createdAt: c.createdAt,
                messages: (c.messages || []).slice(-10)
            }));
        }
        data.activeStream = null;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        // Last resort: clear all chats
        localStorage.removeItem(STORAGE_KEY);
    }
}

export function clearStorage() {
    try {
        localStorage.removeItem(STORAGE_KEY);
        return true;
    } catch (e) {
        return false;
    }
}
