import { loadStateFromStorage, saveStateToStorage, DEFAULT_CONFIG } from './persister.js';

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

export function initStore() {
    const saved = loadStateFromStorage();
    if (saved) {
        if (saved.config) state.config = { ...DEFAULT_CONFIG, ...saved.config };
        if (saved.chats && Array.isArray(saved.chats)) state.chats = saved.chats;
        if (saved.currentChatId) state.currentChatId = saved.currentChatId;
        if (saved.selectedModel) state.selectedModel = saved.selectedModel;
        if (typeof saved.temperature === 'number') state.temperature = saved.temperature;
        if (typeof saved.maxTokens === 'number') state.maxTokens = saved.maxTokens;
        if (saved.activeStream) state.activeStream = saved.activeStream;
    }

    if (state.chats.length === 0) {
        createChat();
    } else if (!state.currentChatId || !state.chats.find(c => c.id === state.currentChatId)) {
        state.currentChatId = state.chats[0].id;
    }

    applyTheme(state.config.theme);
    return state;
}

export function saveStore() {
    saveStateToStorage({
        config: state.config,
        chats: state.chats,
        currentChatId: state.currentChatId,
        selectedModel: state.selectedModel,
        temperature: state.temperature,
        maxTokens: state.maxTokens,
        activeStream: state.activeStream
    });
}

export function createChat() {
    const newChat = {
        id: 'chat_' + Date.now(),
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
        const generatedTitle = content.trim().slice(0, 30) || 'Percakapan';
        chat.title = generatedTitle;
    }

    saveStore();
    return msg;
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

export function applyTheme(theme) {
    const html = document.documentElement;
    if (theme === 'system') {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
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

export function removePendingAttachment(index) {
    state.pendingAttachments.splice(index, 1);
}

export function clearPendingAttachments() {
    state.pendingAttachments = [];
}
