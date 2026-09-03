const STORAGE_KEY = 'ai_workspace_data';

export const DEFAULT_CONFIG = {
    provider: 'openrouter',
    apiKey: '',
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
        return JSON.parse(raw);
    } catch (e) {
        console.warn('Gagal membaca storage, menggunakan default:', e);
        return null;
    }
}

export function saveStateToStorage(data) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        return true;
    } catch (e) {
        console.error('Gagal menyimpan ke LocalStorage:', e);
        return false;
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
