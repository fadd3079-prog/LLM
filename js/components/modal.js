import { state, saveStore, setTheme } from '../store/index.js';
import { showToast } from '../utils/toast.js';
import { initModelSelector } from './modal-models.js';
import { getMemories, addMemory, deleteMemory, clearAllMemories } from '../services/memory.js';

export function initModal({ onModelChange, onClearAll }) {
    const modal = document.getElementById('settings-modal');
    const btnClose = document.getElementById('btn-close-modal');
    const navTabs = document.querySelectorAll('.nav-tab');
    const tabPanels = document.querySelectorAll('.tab-panel');

    const providerSelect = document.getElementById('modal-provider') || document.getElementById('modal-api-provider');
    const apiKeyInput = document.getElementById('modal-api-key');
    const btnToggleKey = document.getElementById('btn-modal-toggle-key');

    const systemPromptInput = document.getElementById('system-prompt');
    const tempInput = document.getElementById('temperature');
    const tempVal = document.getElementById('temperature-value');
    const tokensInput = document.getElementById('max-tokens');
    const tokensVal = document.getElementById('max-tokens-value');

    const modalStatusBar = document.getElementById('modal-status-bar');
    const modalApiStatus = document.getElementById('modal-api-status');

    const themeOptions = document.querySelectorAll('.theme-option');
    const btnClearAll = document.getElementById('btn-clear-all');

    const modelSelector = initModelSelector({ onModelChange });

    function syncFormFromState() {
        if (providerSelect) providerSelect.value = state.config.provider || 'openrouter';
        if (apiKeyInput) apiKeyInput.value = state.config.apiKey || '';
        if (systemPromptInput) systemPromptInput.value = state.config.systemPrompt || '';

        if (tempInput && tempVal) {
            tempInput.value = state.temperature;
            tempVal.textContent = state.temperature;
        }

        if (tokensInput && tokensVal) {
            tokensInput.value = state.maxTokens;
            tokensVal.textContent = state.maxTokens;
        }

        modelSelector.syncInput();

        if (modalApiStatus) {
            const statusDot = modalStatusBar?.querySelector('.status-dot');
            if (state.config.apiKey) {
                modalApiStatus.textContent = 'Terhubung';
                statusDot?.classList.add('connected');
            } else {
                modalApiStatus.textContent = 'Belum Terhubung';
                statusDot?.classList.remove('connected');
            }
        }

        themeOptions.forEach(opt => {
            const isActive = opt.dataset.theme === state.config.theme;
            opt.classList.toggle('active', isActive);
            opt.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });

        renderMemoryUI();

        if (typeof lucide !== 'undefined') {
            lucide.createIcons({ attrs: { 'stroke-width': '1.5' } });
        }
    }

    function renderMemoryUI() {
        const memoryList = document.getElementById('memory-list');
        const memoryBadge = document.getElementById('memory-count-badge');
        const btnClearMem = document.getElementById('btn-clear-memories');
        if (!memoryList) return;

        const memories = getMemories();
        if (memoryBadge) {
            memoryBadge.textContent = `${memories.length} Catatan`;
        }

        if (btnClearMem) {
            btnClearMem.style.display = memories.length > 0 ? 'inline-flex' : 'none';
        }

        if (memories.length === 0) {
            memoryList.innerHTML = '<div class="empty-memory-state">Belum ada memori tersimpan. Tambahkan preferensi di atas agar AI selalu mengingatnya.</div>';
            return;
        }

        memoryList.innerHTML = memories.map(m => `
            <div class="memory-item" data-id="${m.id}">
                <div class="memory-item-content">
                    <i data-lucide="sparkle" class="memory-item-icon"></i>
                    <span class="memory-text">${m.text}</span>
                </div>
                <button class="btn-delete-memory" data-id="${m.id}" title="Hapus memori ini" aria-label="Hapus memori">
                    <i data-lucide="trash-2"></i>
                </button>
            </div>
        `).join('');

        if (typeof lucide !== 'undefined') {
            lucide.createIcons({ attrs: { 'stroke-width': '1.5' } });
        }

        memoryList.querySelectorAll('.btn-delete-memory').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                deleteMemory(id);
                renderMemoryUI();
                showToast('Memori berhasil dihapus', 'info');
            });
        });
    }

    const inputNewMemory = document.getElementById('input-new-memory');
    const btnAddMemory = document.getElementById('btn-add-memory');
    const btnClearMemories = document.getElementById('btn-clear-memories');

    function handleAddMemory() {
        if (!inputNewMemory) return;
        const text = inputNewMemory.value.trim();
        if (!text) return;
        addMemory(text);
        inputNewMemory.value = '';
        renderMemoryUI();
        showToast('Memori baru berhasil disimpan', 'success');
    }

    if (btnAddMemory) {
        btnAddMemory.addEventListener('click', handleAddMemory);
    }
    if (inputNewMemory) {
        inputNewMemory.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleAddMemory();
            }
        });
    }
    if (btnClearMemories) {
        btnClearMemories.addEventListener('click', () => {
            if (confirm('Hapus seluruh memori yang diingat AI?')) {
                clearAllMemories();
                renderMemoryUI();
                showToast('Seluruh memori AI berhasil dibersihkan', 'info');
            }
        });
    }

    const saveAllFormInputs = () => {
        if (systemPromptInput) {
            state.config.systemPrompt = systemPromptInput.value;
        }
        if (apiKeyInput) {
            state.config.apiKey = apiKeyInput.value.trim();
        }
        if (providerSelect) {
            state.config.provider = providerSelect.value;
        }
        saveStore();
    };

    if (btnClose) {
        btnClose.addEventListener('click', () => {
            saveAllFormInputs();
            modal.close();
        });
    }

    modal.addEventListener('click', (e) => {
        const rect = modal.getBoundingClientRect();
        const isInDialog = (
            rect.top <= e.clientY && e.clientY <= rect.top + rect.height &&
            rect.left <= e.clientX && e.clientX <= rect.left + rect.width
        );
        if (!isInDialog) {
            saveAllFormInputs();
            modal.close();
        }
    });

    modal.addEventListener('close', () => {
        saveAllFormInputs();
    });

    navTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabKey = tab.dataset.tab || tab.id.replace('tab-', '');
            navTabs.forEach(t => {
                t.classList.remove('active');
                t.setAttribute('aria-selected', 'false');
            });
            tabPanels.forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            tab.setAttribute('aria-selected', 'true');
            const target = document.getElementById(`panel-${tabKey}`);
            if (target) target.classList.add('active');
        });
    });

    if (btnToggleKey && apiKeyInput) {
        btnToggleKey.addEventListener('click', () => {
            const isPassword = apiKeyInput.type === 'password';
            apiKeyInput.type = isPassword ? 'text' : 'password';
            btnToggleKey.innerHTML = `<i data-lucide="${isPassword ? 'eye-off' : 'eye'}"></i>`;
            if (typeof lucide !== 'undefined') {
                lucide.createIcons({ attrs: { 'stroke-width': '1.5' } });
            }
        });
    }

    if (apiKeyInput) {
        apiKeyInput.addEventListener('change', async () => {
            state.config.apiKey = apiKeyInput.value.trim();
            saveStore();
            syncFormFromState();
            if (state.config.apiKey) {
                await modelSelector.loadModelCatalog();
            }
        });
    }

    if (systemPromptInput) {
        let saveTimeout = null;
        const promptStatusBadge = document.getElementById('system-prompt-status');

        const onPromptChange = () => {
            state.config.systemPrompt = systemPromptInput.value;
            saveStore();
            if (promptStatusBadge) {
                promptStatusBadge.className = 'status-badge-mini typing';
                promptStatusBadge.innerHTML = '<i data-lucide="loader" style="width:12px;height:12px;"></i> Menyimpan...';
                if (typeof lucide !== 'undefined') lucide.createIcons({ attrs: { 'stroke-width': '1.5' } });

                clearTimeout(saveTimeout);
                saveTimeout = setTimeout(() => {
                    promptStatusBadge.className = 'status-badge-mini';
                    promptStatusBadge.innerHTML = '<i data-lucide="check" style="width:12px;height:12px;"></i> Tersimpan';
                    if (typeof lucide !== 'undefined') lucide.createIcons({ attrs: { 'stroke-width': '1.5' } });
                }, 400);
            }
        };

        systemPromptInput.addEventListener('input', onPromptChange);
        systemPromptInput.addEventListener('change', onPromptChange);
    }

    if (tempInput && tempVal) {
        tempInput.addEventListener('input', () => {
            state.temperature = parseFloat(tempInput.value);
            tempVal.textContent = state.temperature;
            saveStore();
        });
    }

    if (tokensInput && tokensVal) {
        tokensInput.addEventListener('input', () => {
            state.maxTokens = parseInt(tokensInput.value, 10);
            tokensVal.textContent = state.maxTokens;
            saveStore();
        });
    }

    themeOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            const theme = opt.dataset.theme;
            setTheme(theme);
            syncFormFromState();
        });
    });

    if (btnClearAll) {
        btnClearAll.addEventListener('click', () => {
            if (confirm('Hapus semua riwayat percakapan? Tindakan ini tidak dapat dibatalkan.')) {
                if (onClearAll) onClearAll();
                modal.close();
                showToast('Semua percakapan berhasil dibersihkan', 'success');
            }
        });
    }

    syncFormFromState();

    return {
        open: (tabName = 'general') => {
            syncFormFromState();
            let norm = (tabName || 'general').toLowerCase();
            if (norm === 'umum') norm = 'general';
            if (norm === 'tampilan') norm = 'appearance';
            const targetTab = document.querySelector(`.nav-tab[data-tab="${norm}"]`) || 
                              document.getElementById(`tab-${norm}`) ||
                              document.getElementById(`tab-${tabName}`);
            if (targetTab) targetTab.click();
            modal.showModal();
            if (state.config.apiKey && state.models.length === 0) {
                modelSelector.loadModelCatalog();
            }
        },
        close: () => modal.close(),
        refreshCatalog: modelSelector.loadModelCatalog
    };
}
