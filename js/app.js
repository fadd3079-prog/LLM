import { state, initStore, getCurrentChat, addMessage, createChat, deleteChat, togglePinChat, saveStore } from './store/index.js';
import { streamChat } from './api/provider.js';
import { initSidebar, renderChats, updateHeaderModelDisplay } from './components/sidebar.js';
import { initChatScroll, renderMessages, appendUserMessage, appendStreamingMessage, resumeStreamingMessage, updateStreamingMessage, finalizeStreamingMessage } from './components/chat.js';
import { initInputUI, setChatInputValue } from './components/input.js';
import { initModal } from './components/modal.js';
import { showToast } from './utils/toast.js';

document.addEventListener('DOMContentLoaded', () => {
    initStore();
    initChatScroll();

    if (typeof lucide !== 'undefined') {
        lucide.createIcons({ attrs: { 'stroke-width': '1.5' } });
    }

    const modal = initModal({
        onModelChange: () => updateHeaderModelDisplay(),
        onClearAll: () => {
            state.chats = [];
            createChat();
            refreshUI();
        }
    });

    const sidebar = initSidebar({
        onNewChat: () => {
            createChat();
            refreshUI();
        },
        onSelectChat: (id) => {
            state.currentChatId = id;
            saveStore();
            refreshUI();
        },
        onDeleteChat: (id) => {
            deleteChat(id);
            refreshUI();
        },
        onPinChat: (id) => {
            togglePinChat(id);
            refreshUI();
        }
    });

    const inputUI = initInputUI((text, attachments) => {
        handleSendMessage(text, attachments);
    });

    document.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            modal.open('api');
        }
    });

    document.getElementById('btn-settings')?.addEventListener('click', () => modal.open('umum'));
    document.getElementById('btn-open-settings')?.addEventListener('click', () => modal.open('umum'));
    document.getElementById('btn-open-settings-prompt')?.addEventListener('click', () => modal.open('api'));

    document.querySelectorAll('.suggestion-card').forEach(card => {
        card.addEventListener('click', () => {
            const prompt = card.dataset.prompt;
            if (prompt) setChatInputValue(prompt);
        });
    });

    function refreshUI() {
        const currentChat = getCurrentChat();
        renderMessages(currentChat);
        updateHeaderModelDisplay();

        const apiStatus = document.getElementById('api-status');
        if (apiStatus) {
            if (state.config.apiKey) {
                apiStatus.textContent = 'Terhubung';
                apiStatus.classList.add('connected');
            } else {
                apiStatus.textContent = 'Belum Terhubung';
                apiStatus.classList.remove('connected');
            }
        }

        renderChats({
            onSelectChat: (id) => { state.currentChatId = id; refreshUI(); },
            onDeleteChat: (id) => { deleteChat(id); refreshUI(); },
            onTogglePin: (id) => { togglePinChat(id); refreshUI(); }
        });
    }

    async function executeStream(chat, assistantMsg, isContinuation = false) {
        state.isGenerating = true;
        chatInputControls.enableInput(false);

        const initialPrefix = isContinuation && assistantMsg.content ? assistantMsg.content.trim() : '';

        if (isContinuation) {
            resumeStreamingMessage(initialPrefix);
        } else {
            appendStreamingMessage();
        }

        const messagesForApi = [];
        if (state.config.systemPrompt) {
            messagesForApi.push({ role: 'system', content: state.config.systemPrompt });
        }

        for (const m of chat.messages) {
            if (m.id === assistantMsg.id) break;
            messagesForApi.push({ role: m.role, content: m.content, attachments: m.attachments });
        }

        if (initialPrefix) {
            messagesForApi.push({ role: 'assistant', content: initialPrefix });
            messagesForApi.push({
                role: 'user',
                content: 'Lanjutkan jawaban Anda dari titik terakhir di atas tanpa mengulang kalimat yang sudah ditulis.'
            });
        }

        let lastSave = 0;
        const throttledSave = (text) => {
            assistantMsg.content = text;
            const now = Date.now();
            if (now - lastSave > 500) {
                lastSave = now;
                saveStore();
            }
        };

        await streamChat(
            messagesForApi,
            state.config.provider,
            state.config.apiKey,
            state.selectedModel,
            (chunkText) => {
                const fullText = initialPrefix ? (initialPrefix + '\n\n' + chunkText) : chunkText;
                throttledSave(fullText);
                updateStreamingMessage(fullText);
            },
            (finalText) => {
                const fullText = initialPrefix ? (initialPrefix + '\n\n' + finalText) : finalText;
                assistantMsg.content = fullText;
                state.activeStream = null;
                saveStore();
                finalizeStreamingMessage();
                state.isGenerating = false;
                chatInputControls.enableInput(true);
            },
            (error) => {
                state.activeStream = null;
                saveStore();
                finalizeStreamingMessage();
                updateStreamingMessage(`${assistantMsg.content}\n\n**[Terputus]:** ${error}`);
                state.isGenerating = false;
                chatInputControls.enableInput(true);
            },
            {
                maxTokens: state.maxTokens,
                temperature: state.temperature
            }
        );
    }

    async function handleSendMessage(text, attachments) {
        if (!state.config.apiKey) {
            modal.open('api');
            showToast('Silakan masukkan API Key Anda terlebih dahulu', 'error');
            return;
        }

        if (state.isGenerating) return;

        const currentChat = getCurrentChat();
        if (!currentChat) return;

        const userMsg = addMessage('user', text, attachments);
        if (!userMsg) return;

        appendUserMessage(userMsg);

        const assistantMsg = addMessage('assistant', '');
        state.activeStream = {
            chatId: currentChat.id,
            messageId: assistantMsg.id
        };
        saveStore();

        renderChats({
            onSelectChat: (id) => { state.currentChatId = id; refreshUI(); },
            onDeleteChat: (id) => { deleteChat(id); refreshUI(); },
            onTogglePin: (id) => { togglePinChat(id); refreshUI(); }
        });

        executeStream(currentChat, assistantMsg, false);
    }

    refreshUI();

    if (state.activeStream) {
        const activeChat = state.chats.find(c => c.id === state.activeStream.chatId);
        if (activeChat) {
            state.currentChatId = activeChat.id;
            const assistantMsg = activeChat.messages.find(m => m.id === state.activeStream.messageId);
            if (assistantMsg && state.config.apiKey) {
                showToast('Melanjutkan respon AI...', 'info');
                setTimeout(() => {
                    executeStream(activeChat, assistantMsg, true);
                }, 150);
            } else {
                state.activeStream = null;
                saveStore();
            }
        } else {
            state.activeStream = null;
            saveStore();
        }
    }
});