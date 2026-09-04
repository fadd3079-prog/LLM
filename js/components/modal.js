import { state, saveStore, setTheme, setProvider, setProviderApiKey, setProviderBaseUrl } from '../store/index.js';
import { showToast } from '../utils/toast.js';
import { initModelSelector } from './modal-models.js';
import { getMemories, addMemory, deleteMemory, clearAllMemories } from '../services/memory.js';
import { getSavedLanguageSetting, setLanguage, applyLanguageToDOM } from '../services/i18n.js';
import { PROVIDERS_CONFIG } from '../api/provider.js';

export function initModal({ onModelChange, onClearAll }) {
    const modal = document.getElementById('settings-modal');
    const btnClose = document.getElementById('btn-close-modal');
    const navTabs = document.querySelectorAll('.nav-tab');
    const tabPanels = document.querySelectorAll('.tab-panel');

    const providerSelect = document.getElementById('modal-provider') || document.getElementById('modal-api-provider');
    const customBaseUrlGroup = document.getElementById('custom-base-url-group');
    const baseUrlInput = document.getElementById('modal-base-url');
    const apiKeyLabel = document.getElementById('modal-api-key-label');
    const apiKeyLink = document.getElementById('modal-api-key-link');
    const apiKeyHint = document.getElementById('modal-api-key-hint');
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
        const currentProvider = state.config.provider || 'openrouter';
        const cfg = PROVIDERS_CONFIG[currentProvider] || PROVIDERS_CONFIG.openrouter;

        if (providerSelect) providerSelect.value = currentProvider;

        const currentKey = state.config.apiKeys?.[currentProvider] || (currentProvider === 'openrouter' ? state.config.apiKey : '') || '';
        if (apiKeyInput) {
            apiKeyInput.value = currentKey;
            apiKeyInput.placeholder = cfg.keyPlaceholder || 'sk-...';
        }

        if (apiKeyLabel) {
            apiKeyLabel.textContent = cfg.isLocal ? 'API Key (Opsional)' : 'API Key';
        }

        if (apiKeyLink) {
            if (cfg.keyUrl) {
                apiKeyLink.href = cfg.keyUrl;
                apiKeyLink.textContent = cfg.helpText || 'Ambil API Key';
                apiKeyLink.style.display = 'inline-flex';
            } else {
                apiKeyLink.style.display = 'none';
            }
        }

        if (apiKeyHint) {
            if (cfg.isLocal) {
                apiKeyHint.textContent = 'Server lokal biasanya tidak membutuhkan API Key. Biarkan kosong jika tidak disetel.';
            } else {
                apiKeyHint.textContent = 'API Key tersimpan aman secara privat di LocalStorage browser Anda.';
            }
        }

        if (customBaseUrlGroup && baseUrlInput) {
            const isCustomOrLocal = cfg.isCustom || cfg.isLocal || currentProvider === 'custom';
            if (isCustomOrLocal) {
                customBaseUrlGroup.classList.remove('hidden');
                baseUrlInput.value = state.config.customBaseUrls?.[currentProvider] || cfg.defaultBaseUrl || '';
                baseUrlInput.placeholder = cfg.defaultBaseUrl || 'https://api.example.com/v1';
            } else {
                customBaseUrlGroup.classList.add('hidden');
            }
        }

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
            if (cfg.isLocal) {
                modalApiStatus.textContent = 'Mode Lokal';
                statusDot?.classList.add('connected');
            } else if (currentKey) {
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

        const langSetting = getSavedLanguageSetting();
        document.querySelectorAll('.lang-option').forEach(opt => {
            const isActive = opt.dataset.lang === langSetting;
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
        showToast('Memori berhasil disimpan', 'success');
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
            if (confirm('Hapus seluruh memori AI?')) {
                clearAllMemories();
                renderMemoryUI();
                showToast('Seluruh memori AI berhasil dihapus', 'info');
            }
        });
    }

    const saveAllFormInputs = () => {
        if (systemPromptInput) {
            state.config.systemPrompt = systemPromptInput.value;
        }
        if (providerSelect) {
            setProvider(providerSelect.value);
        }
        if (apiKeyInput) {
            setProviderApiKey(state.config.provider, apiKeyInput.value.trim());
        }
        if (baseUrlInput) {
            setProviderBaseUrl(state.config.provider, baseUrlInput.value.trim());
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

    if (providerSelect) {
        providerSelect.addEventListener('change', async (e) => {
            const newProvider = e.target.value;
            setProvider(newProvider);
            modelSelector.switchProvider(newProvider);
            syncFormFromState();
            if (onModelChange) {
                onModelChange(state.selectedModel);
            }
        });
    }

    if (baseUrlInput) {
        baseUrlInput.addEventListener('input', () => {
            const val = baseUrlInput.value.trim();
            setProviderBaseUrl(state.config.provider, val);
        });

        baseUrlInput.addEventListener('change', async () => {
            const val = baseUrlInput.value.trim();
            setProviderBaseUrl(state.config.provider, val);
            await modelSelector.loadModelCatalog();
        });
    }

    if (apiKeyInput) {
        apiKeyInput.addEventListener('input', () => {
            const val = apiKeyInput.value.trim();
            setProviderApiKey(state.config.provider, val);
            const cfg = PROVIDERS_CONFIG[state.config.provider] || PROVIDERS_CONFIG.openrouter;
            const statusDot = modalStatusBar?.querySelector('.status-dot');
            if (modalApiStatus) {
                if (cfg.isLocal) {
                    modalApiStatus.textContent = 'Mode Lokal';
                    statusDot?.classList.add('connected');
                } else if (val) {
                    modalApiStatus.textContent = 'Terhubung';
                    statusDot?.classList.add('connected');
                } else {
                    modalApiStatus.textContent = 'Belum Terhubung';
                    statusDot?.classList.remove('connected');
                }
            }
        });

        apiKeyInput.addEventListener('change', async () => {
            const val = apiKeyInput.value.trim();
            setProviderApiKey(state.config.provider, val);
            syncFormFromState();
            const cfg = PROVIDERS_CONFIG[state.config.provider] || PROVIDERS_CONFIG.openrouter;
            if (val || cfg.isLocal) {
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

    document.querySelectorAll('.lang-option').forEach(opt => {
        opt.addEventListener('click', () => {
            const lang = opt.dataset.lang;
            setLanguage(lang);
            syncFormFromState();
            showToast(lang === 'en' ? 'Language: English' : (lang === 'id' ? 'Bahasa: Indonesia' : 'Bahasa: Auto (Perangkat)'), 'info');
        });
    });

    if (btnClearAll) {
        btnClearAll.addEventListener('click', () => {
            if (confirm('Hapus semua riwayat chat? Tindakan ini tidak bisa dibatalkan.')) {
                if (onClearAll) onClearAll();
                modal.close();
                showToast('Semua chat berhasil dihapus', 'success');
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
            const cfg = PROVIDERS_CONFIG[state.config.provider] || PROVIDERS_CONFIG.openrouter;
            const currentKey = state.config.apiKeys?.[state.config.provider] || (state.config.provider === 'openrouter' ? state.config.apiKey : '') || '';
            if ((currentKey || cfg.isLocal) && state.models.length === 0) {
                modelSelector.loadModelCatalog();
            }
        },
        close: () => modal.close(),
        refreshCatalog: modelSelector.loadModelCatalog
    };
}
