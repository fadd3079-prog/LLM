import { loadStateFromStorage, saveStateToStorage, DEFAULT_CONFIG } from './persister.js';
import { PROVIDERS_CONFIG, resolveBaseUrl } from '../api/provider.js';

export const state = {
    config: { ...DEFAULT_CONFIG },
    chats: [],
    currentChatId: null,
    models: [],
    selectedModel: DEFAULT_CONFIG.selectedModel,
    temperature: DEFAULT_CONFIG.temperature,
    maxTokens: DEFAULT_CONFIG.maxTokens,
    isGenerating: false,
    pendingAttachments: [],
    activeStream: null
};

export async function initStore() {
    const saved = await loadStateFromStorage();
    state.config = structuredClone(DEFAULT_CONFIG);
    if (saved && typeof saved === 'object') {
        const config = saved.config && typeof saved.config === 'object' ? saved.config : {};
        state.config = { ...state.config, ...config };
        state.config.provider = Object.hasOwn(PROVIDERS_CONFIG, config.provider) ? config.provider : 'openrouter';
        for (const key of ['apiKeys', 'providerModels', 'customBaseUrls']) {
            state.config[key] = Object.fromEntries(Object.entries(config[key] || {}).filter(([id, value]) => Object.hasOwn(PROVIDERS_CONFIG, id) && typeof value === 'string'));
        }
        const provider = state.config.provider;
        if (config.apiKey && !state.config.apiKeys[provider]) state.config.apiKeys[provider] = String(config.apiKey);
        state.config.apiKey = state.config.apiKeys[provider] || '';
        // Legacy global baseUrl was frequently left over from another provider.
        delete state.config.baseUrl;
        if (!['light', 'dark', 'system'].includes(state.config.theme)) state.config.theme = 'system';
        if (typeof state.config.systemPrompt !== 'string') state.config.systemPrompt = DEFAULT_CONFIG.systemPrompt;
        state.chats = Array.isArray(saved.chats) ? saved.chats.filter(c => c && typeof c.id === 'string' && Array.isArray(c.messages)).map(c => ({
            ...c, title: String(c.title || 'Chat baru'), messages: c.messages.filter(m => m && typeof m.id === 'string' && ['user', 'assistant'].includes(m.role)).map(m => ({ ...m, content: String(m.content || ''), attachments: Array.isArray(m.attachments) ? m.attachments.filter(a => a && typeof a.name === 'string') : [] }))
        })) : [];
        state.currentChatId = saved.currentChatId;
        state.selectedModel = state.config.providerModels[provider] || (typeof saved.selectedModel === 'string' ? saved.selectedModel : PROVIDERS_CONFIG[provider].defaultModel);
        state.config.providerModels[provider] = state.selectedModel;
        state.temperature = Number.isFinite(saved.temperature) ? Math.max(0, Math.min(2, saved.temperature)) : DEFAULT_CONFIG.temperature;
        state.maxTokens = Number.isFinite(saved.maxTokens) ? Math.max(256, Math.min(8192, saved.maxTokens)) : DEFAULT_CONFIG.maxTokens;
        state.activeStream = saved.activeStream || null;
    }
    if (!state.chats.length) createChat();
    else if (!state.chats.some(c => c.id === state.currentChatId)) state.currentChatId = state.chats[0].id;
    applyTheme(state.config.theme);
    return state;
}

export function saveStore() {
    return saveStateToStorage({
        config: state.config,
        chats: state.chats,
        currentChatId: state.currentChatId,
        selectedModel: state.selectedModel,
        temperature: state.temperature,
        maxTokens: state.maxTokens,
        activeStream: state.activeStream
    });
}

export function setProvider(providerId) {
    if (!Object.hasOwn(PROVIDERS_CONFIG, providerId)) return;
    state.config.provider = providerId;
    state.config.apiKey = state.config.apiKeys[providerId] || '';
    state.selectedModel = state.config.providerModels[providerId] || PROVIDERS_CONFIG[providerId].defaultModel;
    state.models = [];
    saveStore();
}

export function setProviderApiKey(providerId, apiKey) {
    if (!state.config.apiKeys) state.config.apiKeys = {};
    state.config.apiKeys[providerId] = apiKey;
    if (state.config.provider === providerId) {
        state.config.apiKey = apiKey;
    }
    saveStore();
}

export function setProviderModel(providerId, modelId) {
    if (!state.config.providerModels) state.config.providerModels = {};
    state.config.providerModels[providerId] = modelId;
    if (state.config.provider === providerId) {
        state.selectedModel = modelId;
    }
    saveStore();
}

export function setProviderBaseUrl(providerId, baseUrl) {
    try {
        resolveBaseUrl(providerId, baseUrl);
        if (baseUrl) state.config.customBaseUrls[providerId] = baseUrl;
        else delete state.config.customBaseUrls[providerId];
        saveStore();
        return true;
    } catch { return false; }
}

export function createChat() {
    const newChat = {
        id: 'chat_' + (globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`),
        title: 'New Chat',
        messages: [],
        createdAt: Date.now(),
        pinned: false
    };
    state.chats.unshift(newChat);
    state.currentChatId = newChat.id;
    saveStore();
    return newChat;
}

export function deleteChat(id) {
    state.chats = state.chats.filter(c => c.id !== id);
    if (state.chats.length === 0) {
        createChat();
    } else if (state.currentChatId === id) {
        state.currentChatId = state.chats[0].id;
    }
    saveStore();
}

export function togglePinChat(id) {
    const chat = state.chats.find(c => c.id === id);
    if (chat) {
        chat.pinned = !chat.pinned;
        saveStore();
    }
}

export function getCurrentChat() {
    return state.chats.find(c => c.id === state.currentChatId) || null;
}

export function addMessage(role, content, attachments = []) {
    const chat = getCurrentChat();
    if (!chat) return null;

    const msg = {
        id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        role,
        content,
        attachments: [...attachments],
        timestamp: Date.now()
    };

    chat.messages.push(msg);

    if (chat.messages.length === 1 && role === 'user') {
        const generatedTitle = content.trim().slice(0, 30) || 'Chat Baru';
        chat.title = generatedTitle;
    }

    saveStore();
    return msg;
}

export function editMessageAndTruncate(messageId, newContent) {
    const chat = getCurrentChat();
    if (!chat) return null;

    const index = chat.messages.findIndex(m => m.id === messageId);
    if (index === -1) return null;

    chat.messages[index].content = newContent;
    chat.messages = chat.messages.slice(0, index + 1);

    if (index === 0 && chat.messages[0].role === 'user') {
        const generatedTitle = newContent.trim().slice(0, 30) || 'Chat Baru';
        chat.title = generatedTitle;
    }

    saveStore();
    return chat.messages[index];
}

export function updateChatTitle(id, title) {
    const chat = state.chats.find(c => c.id === id);
    if (chat) {
        chat.title = title.trim();
        saveStore();
    }
}

export function setTheme(theme) {
    state.config.theme = theme;
    applyTheme(theme);
    saveStore();
}

let systemThemeMql = null;
let systemThemeHandler = null;

export function applyTheme(theme) {
    const html = document.documentElement;
    if (theme === 'system') {
        if (!systemThemeMql && window.matchMedia) {
            systemThemeMql = window.matchMedia('(prefers-color-scheme: dark)');
            systemThemeHandler = (e) => {
                if (state.config.theme === 'system') {
                    html.setAttribute('data-theme', e.matches ? 'dark' : 'light');
                }
            };
            if (systemThemeMql.addEventListener) {
                systemThemeMql.addEventListener('change', systemThemeHandler);
            } else if (systemThemeMql.addListener) {
                systemThemeMql.addListener(systemThemeHandler);
            }
        }
        const isDark = systemThemeMql ? systemThemeMql.matches : false;
        html.setAttribute('data-theme', isDark ? 'dark' : 'light');
    } else {
        html.setAttribute('data-theme', theme);
    }
}

export function getPendingAttachments() {
    return state.pendingAttachments;
}

export function addPendingAttachment(att) {
    state.pendingAttachments.push(att);
}

export function removePendingAttachmentById(id) {
    if (id == null) return;
    state.pendingAttachments = state.pendingAttachments.filter(x => x.id !== id);
}

// Kompatibilitas: parameter numeric dianggap index, selain itu dianggap id.
export function removePendingAttachment(idOrIndex) {
    if (typeof idOrIndex === 'number') {
        state.pendingAttachments.splice(idOrIndex, 1);
    } else {
        removePendingAttachmentById(idOrIndex);
    }
}

export function clearPendingAttachments() {
    state.pendingAttachments = [];
}
