import { state, saveStore, setProviderModel } from '../store/index.js';
import { CURATED_MODELS_BY_PROVIDER } from './modal-models.js';
import { showToast } from '../utils/toast.js';

export function initHeaderModelSwitcher({ onModelChange, onOpenFullSettings }) {
    const pill = document.getElementById('active-model-display');
    const nameEl = document.getElementById('active-model-name');
    const popover = document.getElementById('header-model-popover');
    const searchInput = document.getElementById('header-model-search-input');
    const listEl = document.getElementById('header-model-list');
    const btnOpenSettings = document.getElementById('btn-header-open-settings');
    const filterTags = document.querySelectorAll('.header-model-tag');

    let activeFilter = 'all'; // 'all', 'free', 'curated'

    if (!pill || !popover || !listEl) return { updateDisplay: () => {}, refresh: () => {} };

    function getCuratedModels() {
        const provider = state.config.provider || 'openrouter';
        return CURATED_MODELS_BY_PROVIDER[provider] || CURATED_MODELS_BY_PROVIDER.openrouter || [];
    }

    function getAllAvailableModels() {
        if (state.models && state.models.length > 0) {
            return state.models;
        }
        return getCuratedModels();
    }

    function renderList(query = '') {
        const models = getAllAvailableModels();
        const curated = getCuratedModels();
        const curatedIds = new Set(curated.map(m => m.id));

        const q = (query || '').trim().toLowerCase();

        const filtered = models.filter(m => {
            const isCurated = curatedIds.has(m.id);
            const isFree = m.id.toLowerCase().includes(':free') || (m.name && m.name.toLowerCase().includes('free'));

            if (activeFilter === 'curated' && !isCurated) return false;
            if (activeFilter === 'free' && !isFree) return false;

            if (!q) return true;
            return (m.name && m.name.toLowerCase().includes(q)) || (m.id && m.id.toLowerCase().includes(q));
        });

        listEl.innerHTML = '';

        if (filtered.length === 0) {
            const emptyLi = document.createElement('li');
            emptyLi.className = 'header-model-empty';
            emptyLi.innerHTML = `
                <i data-lucide="search-x"></i>
                <span>Tidak ada model yang cocok</span>
            `;
            listEl.appendChild(emptyLi);
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        // Tampilkan maksimal 80 model agar rendering cepat dan halus
        filtered.slice(0, 80).forEach(m => {
            const li = document.createElement('li');
            const isActive = m.id === state.selectedModel;
            const isFree = m.id.toLowerCase().includes(':free') || (m.name && m.name.toLowerCase().includes('free'));
            const isCurated = curatedIds.has(m.id);

            li.className = `header-model-item ${isActive ? 'active' : ''}`;
            li.setAttribute('role', 'option');
            li.setAttribute('aria-selected', isActive ? 'true' : 'false');

            const mainWrap = document.createElement('div');
            mainWrap.className = 'header-model-item-main';

            const titleRow = document.createElement('div');
            titleRow.className = 'header-model-item-title-row';

            const nameSpan = document.createElement('span');
            nameSpan.className = 'header-model-item-name';
            nameSpan.textContent = m.name || m.id || '';

            titleRow.appendChild(nameSpan);
            if (isFree) {
                const freeBadge = document.createElement('span');
                freeBadge.className = 'model-badge free';
                freeBadge.textContent = 'FREE';
                titleRow.appendChild(freeBadge);
            }
            if (!isFree && isCurated) {
                const topBadge = document.createElement('span');
                topBadge.className = 'model-badge recommended';
                topBadge.textContent = 'TOP';
                titleRow.appendChild(topBadge);
            }

            const idSpan = document.createElement('span');
            idSpan.className = 'header-model-item-id';
            idSpan.textContent = m.id || '';

            mainWrap.appendChild(titleRow);
            mainWrap.appendChild(idSpan);

            const metaWrap = document.createElement('div');
            metaWrap.className = 'header-model-item-meta';
            if (m.context_length) {
                const ctxSpan = document.createElement('span');
                ctxSpan.className = 'model-meta-ctx';
                ctxSpan.textContent = `${Math.round(m.context_length / 1000)}k`;
                metaWrap.appendChild(ctxSpan);
            }
            if (isActive) {
                const checkIcon = document.createElement('i');
                checkIcon.dataset.lucide = 'check';
                checkIcon.className = 'header-model-item-check';
                metaWrap.appendChild(checkIcon);
            }

            li.appendChild(mainWrap);
            li.appendChild(metaWrap);

            li.addEventListener('click', (e) => {
                e.stopPropagation();
                selectModel(m);
            });

            listEl.appendChild(li);
        });

        if (window.lucide) window.lucide.createIcons();
    }

    function selectModel(m) {
        state.selectedModel = m.id;
        setProviderModel(state.config.provider, m.id);
        saveStore();
        updateDisplay();
        closePopover();
        showToast(`Model aktif: ${m.name}`, 'info');
        if (onModelChange) onModelChange(m.id);
    }

    function updateDisplay() {
        if (!state.selectedModel) {
            if (nameEl) nameEl.textContent = 'Pilih Model';
            return;
        }
        const models = getAllAvailableModels();
        const found = models.find(m => m.id === state.selectedModel);
        const displayName = found?.name || state.selectedModel;
        if (nameEl) nameEl.textContent = displayName;
        else pill.textContent = displayName;
        pill.title = `Model aktif: ${state.selectedModel}. Klik untuk mengganti model.`;
    }

    function openPopover() {
        popover.classList.remove('hidden');
        pill.setAttribute('aria-expanded', 'true');
        pill.classList.add('active');
        if (searchInput) {
            searchInput.value = '';
            setTimeout(() => searchInput.focus(), 50);
        }
        renderList('');
    }

    function closePopover() {
        popover.classList.add('hidden');
        pill.setAttribute('aria-expanded', 'false');
        pill.classList.remove('active');
    }

    function togglePopover() {
        if (popover.classList.contains('hidden')) {
            openPopover();
        } else {
            closePopover();
        }
    }

    pill.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePopover();
    });

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            renderList(searchInput.value);
        });
        searchInput.addEventListener('click', (e) => e.stopPropagation());
    }

    filterTags.forEach(tag => {
        tag.addEventListener('click', (e) => {
            e.stopPropagation();
            filterTags.forEach(t => t.classList.remove('active'));
            tag.classList.add('active');
            activeFilter = tag.dataset.filter || 'all';
            renderList(searchInput?.value || '');
        });
    });

    if (btnOpenSettings) {
        btnOpenSettings.addEventListener('click', (e) => {
            e.stopPropagation();
            closePopover();
            if (onOpenFullSettings) onOpenFullSettings();
        });
    }

    document.addEventListener('click', (e) => {
        if (!popover.classList.contains('hidden')) {
            if (!popover.contains(e.target) && !pill.contains(e.target)) {
                closePopover();
            }
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !popover.classList.contains('hidden')) {
            closePopover();
        }
    });

    // Initial display sync
    updateDisplay();

    return {
        updateDisplay,
        refresh: () => {
            updateDisplay();
            if (!popover.classList.contains('hidden')) {
                renderList(searchInput?.value || '');
            }
        }
    };
}
