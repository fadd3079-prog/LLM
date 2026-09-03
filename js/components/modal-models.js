import { state, saveStore } from '../store/index.js';
import { fetchModels } from '../api/provider.js';

export const DEFAULT_MODELS = [
    { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash', context_length: 1000000 },
    { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro', context_length: 2000000 },
    { id: 'google/gemini-2.0-flash', name: 'Gemini 2.0 Flash', context_length: 1000000 },
    { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', context_length: 200000 },
    { id: 'anthropic/claude-3.5-haiku', name: 'Claude 3.5 Haiku', context_length: 200000 },
    { id: 'openai/gpt-4o', name: 'GPT-4o', context_length: 128000 },
    { id: 'openai/gpt-4o-mini', name: 'GPT-4o mini', context_length: 128000 },
    { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3', context_length: 64000 },
    { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', context_length: 64000 },
    { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', context_length: 131000 },
    { id: 'mistralai/mistral-large', name: 'Mistral Large', context_length: 128000 },
    { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B', context_length: 128000 }
];

export function initModelSelector({ onModelChange }) {
    const modelSearchInput = document.getElementById('modal-model-search');
    const modelDropdown = document.getElementById('modal-model-dropdown');
    const wrapper = modelSearchInput?.closest('.model-selector-wrapper');

    if (!state.models || state.models.length === 0) {
        state.models = [...DEFAULT_MODELS];
    }

    async function loadModelCatalog() {
        if (!state.config.apiKey) return;
        try {
            const list = await fetchModels(state.config.provider, state.config.apiKey);
            if (Array.isArray(list) && list.length > 0) {
                state.models = list;
                renderModelDropdown(state.models);
                syncInput();
            }
        } catch (e) {
            console.warn('Gagal memuat katalog lengkap:', e);
        }
    }

    function renderModelDropdown(modelsToRender) {
        if (!modelDropdown) return;
        modelDropdown.innerHTML = '';

        const list = modelsToRender || state.models || DEFAULT_MODELS;

        if (list.length === 0) {
            const emptyLi = document.createElement('li');
            emptyLi.className = 'dropdown-item empty';
            emptyLi.textContent = 'Tidak ada model yang cocok';
            emptyLi.style.cssText = 'color: var(--color-mute); cursor: default; justify-content: center; padding: 12px;';
            modelDropdown.appendChild(emptyLi);
            return;
        }

        list.slice(0, 100).forEach(m => {
            const li = document.createElement('li');
            const isActive = m.id === state.selectedModel;
            li.className = `dropdown-item ${isActive ? 'active' : ''}`;
            const contextText = m.context_length ? `${Math.round(m.context_length / 1000)}k ctx` : '';

            li.innerHTML = `
                <span class="model-item-name">${m.name}</span>
                ${contextText ? `<span class="model-item-tag">${contextText}</span>` : ''}
            `;

            li.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                state.selectedModel = m.id;
                saveStore();
                syncInput();
                modelDropdown.classList.add('hidden');
                if (onModelChange) onModelChange(m.id);
            });

            modelDropdown.appendChild(li);
        });
    }

    function syncInput() {
        if (modelSearchInput) {
            const current = (state.models || DEFAULT_MODELS).find(m => m.id === state.selectedModel);
            modelSearchInput.value = current?.name || state.selectedModel || '';
            modelSearchInput.disabled = false;
        }
    }

    if (modelSearchInput && modelDropdown) {
        renderModelDropdown(state.models);
        syncInput();

        const openDropdown = () => {
            renderModelDropdown(state.models);
            modelDropdown.classList.remove('hidden');
            if (state.config.apiKey && state.models.length <= DEFAULT_MODELS.length) {
                loadModelCatalog();
            }
        };

        const toggleDropdown = (e) => {
            if (e) e.stopPropagation();
            if (modelDropdown.classList.contains('hidden')) {
                openDropdown();
            } else {
                modelDropdown.classList.add('hidden');
            }
        };

        modelSearchInput.addEventListener('click', (e) => {
            e.stopPropagation();
            openDropdown();
        });

        modelSearchInput.addEventListener('focus', openDropdown);

        const inputBox = modelSearchInput.closest('.model-input-box');
        if (inputBox) {
            inputBox.addEventListener('click', (e) => {
                if (e.target !== modelSearchInput) {
                    e.stopPropagation();
                    toggleDropdown(e);
                }
            });
        }

        modelSearchInput.addEventListener('input', (e) => {
            const q = e.target.value.toLowerCase().trim();
            const list = state.models || DEFAULT_MODELS;
            const filtered = q
                ? list.filter(m => (m.name || '').toLowerCase().includes(q) || (m.id || '').toLowerCase().includes(q))
                : list;
            renderModelDropdown(filtered);
            modelDropdown.classList.remove('hidden');
        });

        document.addEventListener('click', (e) => {
            if (wrapper && !wrapper.contains(e.target)) {
                modelDropdown.classList.add('hidden');
            }
        });
    }

    return {
        loadModelCatalog,
        renderModelDropdown,
        syncInput
    };
}
