import { state, initStore, getCurrentChat, addMessage, editMessageAndTruncate, createChat, deleteChat, togglePinChat, saveStore, setTheme } from './store/index.js';
import { streamChat, PROVIDERS_CONFIG, resolveBaseUrl } from './api/provider.js';
import { initSidebar, renderChats, updateHeaderModelDisplay } from './components/sidebar.js';
import { initChatScroll, renderMessages, appendUserMessage, appendStreamingMessage, updateStreamingMessage, finalizeStreamingMessage, setEditMessageCallback } from './components/chat.js';
import { initInputUI, setChatInputValue } from './components/input.js';
import { initModal } from './components/modal.js';
import { initHeaderModelSwitcher } from './components/header-models.js';
import { initSelectionToolbar } from './components/selection-toolbar.js';
import { showToast } from './utils/toast.js';
import { formatMemoriesForSystemPrompt } from './services/memory.js';
import { isTTSRequest, extractTTSText, generateTTS, cancelTTS } from './services/tts-generator.js';
import { applyLanguageToDOM } from './services/i18n.js';
import { getAppKnowledgeSystemPrompt, processAssistantResponseForMemories } from './services/app-knowledge.js';
import { redactSecretsInText } from './services/api-key-detector.js';

async function startApp() {
    await initStore();
    initChatScroll();
    applyLanguageToDOM();
    window.addEventListener('storage-error', e => showToast(e.detail.message, 'error'));
    let generation = 0;
    let controller = null;
    let activeMessage = null;
    let controls;
    let header;
    const audioUrls = new Map();

    function stopGeneration() {
        if (!state.isGenerating) return;
        generation++;
        controller?.abort();
        cancelTTS();
        controller = null;
        state.isGenerating = false;
        state.activeStream = null;
        if (activeMessage && !activeMessage.content) activeMessage.content = '*Respons dihentikan.*';
        finalizeStreamingMessage(activeMessage?.content, 'stopped');
        activeMessage = null;
        controls?.setGenerating(false);
        controls?.enableInput(true);
        saveStore();
    }

    const chatActions = {
        onSelectChat(id) {
            if (id === state.currentChatId) return;
            stopGeneration();
            controls.clearInput();
            state.currentChatId = id;
            saveStore();
            refreshUI();
        },
        onNewChat() {
            stopGeneration();
            controls.clearInput();
            if (getCurrentChat()?.messages.length) createChat();
            refreshUI();
            if (window.innerWidth > 768) controls.focus();
        },
        onDeleteChat(id) {
            if (id === state.currentChatId) { stopGeneration(); controls.clearInput(); }
            const deleted = state.chats.find(c => c.id === id);
            deleted?.messages.forEach(m => { if (audioUrls.has(m.id)) { URL.revokeObjectURL(audioUrls.get(m.id)); audioUrls.delete(m.id); } });
            deleteChat(id);
            if (state.isGenerating) renderChats(chatActions);
            else refreshUI();
        },
        onTogglePin(id) { togglePinChat(id); renderChats(chatActions); }
    };
    const modal = initModal({
        onModelChange() { updateStatus(); header?.refresh(); },
        onClearAll() {
            stopGeneration();
            controls.clearInput();
            audioUrls.forEach(url => URL.revokeObjectURL(url));
            audioUrls.clear();
            state.chats = [];
            createChat();
            refreshUI();
        }
    });
    header = initHeaderModelSwitcher({
        onModelChange: () => updateStatus(),
        onOpenFullSettings: () => modal.open('api')
    });
    initSidebar(chatActions);
    controls = initInputUI(handleSendMessage, stopGeneration);
    initSelectionToolbar(prompt => { if (canSend(prompt, [])) handleSendMessage(prompt, []); });
    setEditMessageCallback(handleEditUserMessage);

    function updateStatus() {
        updateHeaderModelDisplay();
        const cfg = PROVIDERS_CONFIG[state.config.provider];
        const ready = Boolean(state.config.apiKey || cfg?.isLocal || cfg?.isCustom);
        const status = document.getElementById('api-status');
        status.textContent = ready ? (cfg.isLocal ? 'Mode lokal' : 'Siap digunakan') : 'Atur koneksi API';
        status.classList.toggle('connected', ready);
        controls?.setWebSearchAvailable(Boolean(cfg?.supportsWebSearch));
    }
    function refreshUI() {
        renderMessages(getCurrentChat());
        mountAudio();
        renderChats(chatActions);
        updateStatus();
        header?.refresh();
        window.lucide?.createIcons();
    }
    function mountAudio() {
        const messages = getCurrentChat()?.messages || [];
        document.querySelectorAll('.message-wrapper').forEach((wrapper, i) => {
            const msg = messages[i];
            if (!msg?.audio || !audioUrls.has(msg.id)) return;
            const audio = document.createElement('audio');
            audio.controls = true;
            audio.src = audioUrls.get(msg.id);
            const link = document.createElement('a');
            link.href = audio.src;
            link.download = 'audio.mp3';
            link.textContent = 'Unduh audio';
            wrapper.querySelector('.message-content').append(audio, link);
        });
    }
    function canSend(text, attachments) {
        if (state.isGenerating) return false;
        const cfg = PROVIDERS_CONFIG[state.config.provider];
        const tts = cfg?.isTTS || isTTSRequest(text);
        if (tts && (attachments.length || !state.config.apiKeys?.fish_audio)) {
            showToast('TTS membutuhkan API key Fish Audio dan pesan teks tanpa lampiran.', 'error');
            modal.open('api');
            return false;
        }
        if (!tts && !state.config.apiKey && !cfg?.isLocal && !cfg?.isCustom) {
            modal.open('api');
            showToast('Masukkan API key melalui pengaturan untuk memulai.', 'info');
            return false;
        }
        try { resolveBaseUrl(state.config.provider, state.config.customBaseUrls?.[state.config.provider]); }
        catch (err) { modal.open('api'); showToast(err.message, 'error'); return false; }
        return true;
    }
    function handleSendMessage(text, attachments = [], options = {}, meta = {}) {
        if (!canSend(text, attachments)) return false;
        const safeText = redactSecretsInText(text, Object.values(state.config.apiKeys || {}));
        if (safeText !== text) {
            showToast('API key terdeteksi dalam pesan. Simpan melalui Pengaturan sebelum mengirim.', 'error');
            modal.open('api');
            return false;
        }
        const chat = getCurrentChat();
        const msg = addMessage('user', safeText, attachments);
        if (!msg) return false;
        meta.clearAttachments?.();
        appendUserMessage(msg);
        const assistant = addMessage('assistant', '');
        renderChats(chatActions);
        executeResponse(chat, assistant, options, state.config.provider === 'fish_audio' || isTTSRequest(text) ? extractTTSText(text) : null);
        return true;
    }
    function handleEditUserMessage(id, text) {
        const chat = getCurrentChat();
        const target = chat?.messages.find(m => m.id === id);
        if (!target || state.isGenerating || !canSend(text, target.attachments || [])) return;
        if (redactSecretsInText(text, Object.values(state.config.apiKeys || {})) !== text) { showToast('Hapus API key dari pesan; masukkan melalui Pengaturan.', 'error'); return; }
        editMessageAndTruncate(id, text);
        renderMessages(chat);
        const assistant = addMessage('assistant', '');
        renderChats(chatActions);
        executeResponse(chat, assistant, {}, state.config.provider === 'fish_audio' || isTTSRequest(text) ? extractTTSText(text) : null);
    }
    async function executeResponse(chat, assistant, options = {}, ttsText = null) {
        const requestId = ++generation;
        const current = () => generation === requestId;
        const requestController = new AbortController();
        controller = requestController;
        activeMessage = assistant;
        state.isGenerating = true;
        state.activeStream = { chatId: chat.id, messageId: assistant.id };
        controls.setGenerating(true);
        controls.enableInput(false);
        appendStreamingMessage('', ttsText !== null ? 'audio' : options.webSearch ? 'web' : 'default');
        saveStore();
        let lastSave = Date.now();
        const finish = (text, phase = 'complete') => {
            if (!current()) return;
            assistant.content = processAssistantResponseForMemories(text).cleanText;
            finalizeStreamingMessage(assistant.content, phase);
        };
        try {
            if (ttsText !== null) {
                const bytes = await generateTTS(ttsText, { signal: requestController.signal });
                if (!current()) return;
                audioUrls.set(assistant.id, URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' })));
                assistant.audio = true;
                finish('Audio siap diputar atau diunduh. Audio tersedia selama sesi ini; buat ulang setelah memuat ulang halaman.');
                renderMessages(chat);
                mountAudio();
            } else {
                const messages = [{ role: 'system', content: [getAppKnowledgeSystemPrompt(), formatMemoriesForSystemPrompt(), state.config.systemPrompt].filter(Boolean).join('\n\n') }];
                for (const m of chat.messages) {
                    if (m.id === assistant.id) break;
                    if (!m.audio) messages.push({ role: m.role, content: m.content, attachments: m.attachments });
                }
                await streamChat(messages, state.config.provider, state.config.apiKey, state.selectedModel,
                    (text, meta) => {
                        if (!current()) return;
                        assistant.content = text;
                        updateStreamingMessage(text, meta);
                        if (Date.now() - lastSave > 1500) { lastSave = Date.now(); saveStore(); }
                    },
                    text => finish(text || 'Provider mengembalikan respons kosong. Coba model lain.'),
                    error => finish(`${assistant.content}\n\n**Permintaan gagal:** ${error}`, 'error'),
                    { maxTokens: state.maxTokens, temperature: state.temperature, signal: requestController.signal, webSearch: options.webSearch, baseUrl: resolveBaseUrl(state.config.provider, state.config.customBaseUrls?.[state.config.provider]) });
            }
        } catch (err) {
            if (current()) finish(`${assistant.content}\n\n**Permintaan gagal:** ${err.message}`, 'error');
        } finally {
            if (current()) {
                controller = null;
                activeMessage = null;
                state.isGenerating = false;
                state.activeStream = null;
                controls.setGenerating(false);
                controls.enableInput(true);
                saveStore();
            }
        }
    }
    document.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); modal.open('api'); }
    });
    const openSettings = () => modal.open('api');
    ['btn-settings', 'btn-open-settings-prompt'].forEach(id => document.getElementById(id)?.addEventListener('click', openSettings));
    document.getElementById('btn-quick-theme').addEventListener('click', () => {
        setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
    });
    document.querySelectorAll('.action-pill').forEach(pill => pill.addEventListener('click', () => {
        if (pill.id === 'btn-pill-settings') openSettings();
        else setChatInputValue(pill.dataset.prompt || '');
    }));
    // A reload cannot resume a network request. Keep its partial text and mark it interrupted.
    if (state.activeStream) {
        const chat = state.chats.find(c => c.id === state.activeStream.chatId);
        const msg = chat?.messages.find(m => m.id === state.activeStream.messageId);
        if (msg) msg.content = `${msg.content || ''}\n\n*Respons terputus karena halaman dimuat ulang. Kirim pesan untuk melanjutkan.*`;
        state.activeStream = null;
        saveStore();
    }
    window.addEventListener('pagehide', () => { saveStore(); audioUrls.forEach(url => URL.revokeObjectURL(url)); });
    refreshUI();
    const area = document.querySelector('.input-area');
    new ResizeObserver(() => document.getElementById('main-content').style.setProperty('--composer-height', `${area.offsetHeight}px`)).observe(area);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startApp);
else startApp();
