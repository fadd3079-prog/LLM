import { state, initStore, getCurrentChat, addMessage, editMessageAndTruncate, createChat, deleteChat, togglePinChat, saveStore, setTheme } from './store/index.js';
import { streamChat } from './api/provider.js';
import { initSidebar, renderChats, updateHeaderModelDisplay } from './components/sidebar.js';
import { initChatScroll, renderMessages, appendUserMessage, appendStreamingMessage, resumeStreamingMessage, updateStreamingMessage, finalizeStreamingMessage, setEditMessageCallback } from './components/chat.js';
import { initInputUI, setChatInputValue } from './components/input.js';
import { initModal } from './components/modal.js';
import { initSelectionToolbar } from './components/selection-toolbar.js';
import { showToast } from './utils/toast.js';
import { formatMemoriesForSystemPrompt } from './services/memory.js';
import { isImageGenerationRequest, extractImagePrompt, getGeneratedImageUrl } from './services/image-generator.js';
import { applyLanguageToDOM } from './services/i18n.js';

document.addEventListener('DOMContentLoaded', () => {
    initStore();
    initChatScroll();
    applyLanguageToDOM();

    if (typeof lucide !== 'undefined') {
        lucide.createIcons({ attrs: { 'stroke-width': '1.5' } });
    }

    let activeAbortController = null;

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

    const chatInputControls = initInputUI(
        (text, attachments, options) => {
            handleSendMessage(text, attachments, options);
        },
        () => {
            handleStopGeneration();
        }
    );

    initSelectionToolbar((promptText) => {
        handleSendMessage(promptText, []);
    });

    setEditMessageCallback((messageId, newText) => {
        handleEditUserMessage(messageId, newText);
    });

    function handleStopGeneration() {
        if (activeAbortController) {
            activeAbortController.abort();
            activeAbortController = null;
        }
        state.isGenerating = false;
        state.activeStream = null;
        saveStore();
        finalizeStreamingMessage();
        chatInputControls.setGenerating(false);
        chatInputControls.enableInput(true);
        showToast('Respon AI dihentikan', 'info');
    }

    document.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            modal.open('api');
        }
    });

    document.getElementById('btn-settings')?.addEventListener('click', () => modal.open('umum'));
    document.getElementById('btn-open-settings')?.addEventListener('click', () => modal.open('umum'));
    document.getElementById('btn-open-settings-prompt')?.addEventListener('click', () => modal.open('api'));

    document.getElementById('btn-quick-theme')?.addEventListener('click', () => {
        const nextTheme = state.config.theme === 'dark' ? 'light' : 'dark';
        setTheme(nextTheme);
        showToast(nextTheme === 'dark' ? 'Mode Gelap aktif' : 'Mode Terang aktif', 'info');
    });

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

    async function executeStream(chat, assistantMsg, isContinuation = false, streamOptions = {}) {
        state.isGenerating = true;
        chatInputControls.setGenerating(true);
        chatInputControls.enableInput(false);

        activeAbortController = new AbortController();

        try {
            const initialPrefix = isContinuation && assistantMsg.content ? assistantMsg.content.trim() : '';

            if (isContinuation) {
                resumeStreamingMessage(initialPrefix);
            } else {
                let streamMode = 'default';
                if (streamOptions.webSearch) {
                    streamMode = 'web';
                } else if (state.selectedModel?.includes('thinking') || state.selectedModel?.includes('r1')) {
                    streamMode = 'thinking';
                }
                appendStreamingMessage('', streamMode);
            }

            const messagesForApi = [];

            // Gabungkan instruksi sistem, kapabilitas file, dan memori lintas chat
            const fileCapabilityPrompt = `\n\n[KEMAMPUAN MEMBUAT FILE]\nAnda memiliki kemampuan penuh untuk membuat, menyusun, dan membagikan berbagai macam file (seperti Markdown .md, Dokumen Teks .txt, Skrip Python .py, HTML/CSS/JS, CSV, JSON, SQL, Shell script, dll). Jika pengguna meminta Anda membuat, menyimpan, atau menulis file, buatlah isi file tersebut secara lengkap dalam blok kode dengan menyertakan nama file (contoh: \`\`\`markdown:dokumen.md atau \`\`\`python:skrip.py) dan beri penjelasan singkat. Aplikasi ini otomatis menyediakan tombol 'Unduh File' di samping blok kode sehingga pengguna dapat langsung mendownloadnya. Jangan pernah mengatakan bahwa Anda tidak bisa membuat atau menyimpan file.`;
            const memoriesPrompt = formatMemoriesForSystemPrompt();
            const fullSystemPrompt = (state.config.systemPrompt || '') + fileCapabilityPrompt + memoriesPrompt;

            messagesForApi.push({ role: 'system', content: fullSystemPrompt });

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
                    activeAbortController = null;
                    saveStore();
                    finalizeStreamingMessage();
                    state.isGenerating = false;
                    chatInputControls.setGenerating(false);
                    chatInputControls.enableInput(true);
                },
                (error) => {
                    state.activeStream = null;
                    activeAbortController = null;
                    saveStore();
                    finalizeStreamingMessage();
                    updateStreamingMessage(`${assistantMsg.content}\n\n**[Terputus]:** ${error}`);
                    state.isGenerating = false;
                    chatInputControls.setGenerating(false);
                    chatInputControls.enableInput(true);
                },
                {
                    maxTokens: state.maxTokens,
                    temperature: state.temperature,
                    signal: activeAbortController.signal,
                    webSearch: streamOptions.webSearch || false
                }
            );
        } catch (err) {
            state.activeStream = null;
            activeAbortController = null;
            saveStore();
            finalizeStreamingMessage();
            updateStreamingMessage(`**[Error]:** ${err.message || 'Gagal memulai koneksi chat.'}`);
            state.isGenerating = false;
            chatInputControls.setGenerating(false);
            chatInputControls.enableInput(true);
        }
    }

    async function handleSendMessage(text, attachments, options = {}) {
        if (state.isGenerating) return;

        const currentChat = getCurrentChat();
        if (!currentChat) return;

        // Deteksi apakah pengguna meminta pembuatan gambar AI
        if (isImageGenerationRequest(text) && (!attachments || attachments.length === 0)) {
            const imgPrompt = extractImagePrompt(text);
            const userMsg = addMessage('user', text, attachments);
            if (!userMsg) return;

            appendUserMessage(userMsg);

            const imgUrl = getGeneratedImageUrl(imgPrompt);
            const assistantMarkdown = `Berikut adalah gambar resolusi tinggi yang dihasilkan sesuai permintaan Anda:\n\n![${imgPrompt}](${imgUrl})\n\n> *Prompt Visual:* "${imgPrompt}"`;

            const assistantMsg = addMessage('assistant', assistantMarkdown);
            saveStore();

            // Render langsung ke pesan
            const chatWrapper = renderMessages(currentChat);
            showToast('Gambar AI berhasil dibuat', 'success');

            renderChats({
                onSelectChat: (id) => { state.currentChatId = id; refreshUI(); },
                onDeleteChat: (id) => { deleteChat(id); refreshUI(); },
                onTogglePin: (id) => { togglePinChat(id); refreshUI(); }
            });
            return;
        }

        if (!state.config.apiKey) {
            modal.open('api');
            showToast('Silakan masukkan API Key Anda terlebih dahulu', 'error');
            return;
        }

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

        executeStream(currentChat, assistantMsg, false, options);
    }

    async function handleEditUserMessage(messageId, newText) {
        if (state.isGenerating) {
            handleStopGeneration();
        }

        const currentChat = getCurrentChat();
        if (!currentChat) return;

        const targetMsg = currentChat.messages.find(m => m.id === messageId);
        if (!targetMsg) return;

        // Edit isi pesan dan potong percakapan setelah pesan ini (respon sebelumnya & di bawahnya terhapus)
        const editedMsg = editMessageAndTruncate(messageId, newText);
        if (!editedMsg) return;

        // Cek jika prompt yang diedit adalah permintaan gambar AI
        if (isImageGenerationRequest(newText) && (!editedMsg.attachments || editedMsg.attachments.length === 0)) {
            const imgPrompt = extractImagePrompt(newText);
            const imgUrl = getGeneratedImageUrl(imgPrompt);
            const assistantMarkdown = `Berikut adalah gambar resolusi tinggi yang dihasilkan sesuai permintaan Anda:\n\n![${imgPrompt}](${imgUrl})\n\n> *Prompt Visual:* "${imgPrompt}"`;

            addMessage('assistant', assistantMarkdown);
            saveStore();
            renderMessages(currentChat);
            showToast('Prompt diperbarui & gambar AI baru dibuat', 'success');

            renderChats({
                onSelectChat: (id) => { state.currentChatId = id; refreshUI(); },
                onDeleteChat: (id) => { deleteChat(id); refreshUI(); },
                onTogglePin: (id) => { togglePinChat(id); refreshUI(); }
            });
            return;
        }

        if (!state.config.apiKey) {
            renderMessages(currentChat);
            modal.open('api');
            showToast('Silakan masukkan API Key Anda terlebih dahulu', 'error');
            return;
        }

        // Render kembali pesan hingga prompt yang diedit (respon lama terhapus)
        renderMessages(currentChat);

        // Tambah pesan asisten kosong untuk menampung streaming respon baru
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

        const isWebSearch = chatInputControls?.isWebSearchActive ? chatInputControls.isWebSearchActive() : false;
        executeStream(currentChat, assistantMsg, false, { webSearch: isWebSearch });
        showToast('Prompt diperbarui, AI merespon ulang...', 'info');
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