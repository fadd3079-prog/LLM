import { state, saveStore, setProviderModel } from '../store/index.js';
import { fetchModels, PROVIDERS_CONFIG } from '../api/provider.js';

export const CURATED_MODELS_BY_PROVIDER = {
    openrouter: [
        { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash', context_length: 1000000 },
        { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro', context_length: 2000000 },
        { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', context_length: 200000 },
        { id: 'anthropic/claude-3.5-haiku', name: 'Claude 3.5 Haiku', context_length: 200000 },
        { id: 'openai/gpt-4o', name: 'GPT-4o', context_length: 128000 },
        { id: 'openai/gpt-4o-mini', name: 'GPT-4o mini', context_length: 128000 },
        { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3', context_length: 64000 },
        { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', context_length: 64000 },
        { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', context_length: 131000 },
        { id: 'mistralai/mistral-large', name: 'Mistral Large', context_length: 128000 },
        { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B', context_length: 128000 }
    ],
    openai: [
        { id: 'gpt-4o', name: 'GPT-4o (Omni Flagship)', context_length: 128000 },
        { id: 'gpt-4o-mini', name: 'GPT-4o mini (Fast & Efficient)', context_length: 128000 },
        { id: 'o1', name: 'o1 (Advanced Reasoning)', context_length: 200000 },
        { id: 'o1-mini', name: 'o1-mini (Fast Reasoning)', context_length: 128000 },
        { id: 'o3-mini', name: 'o3-mini (Next-Gen Reasoning)', context_length: 200000 },
        { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', context_length: 128000 }
    ],
    gemini: [
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Recommended)', context_length: 1000000 },
        { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (Deep Intelligence)', context_length: 2000000 },
        { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', context_length: 1000000 },
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', context_length: 2000000 },
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', context_length: 1000000 }
    ],
    anthropic: [
        { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet (Latest)', context_length: 200000 },
        { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', context_length: 200000 },
        { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', context_length: 200000 }
    ],
    groq: [
        { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile (Ultra-Fast)', context_length: 128000 },
        { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 Distill Llama 70B', context_length: 128000 },
        { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', context_length: 128000 },
        { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B (MoE)', context_length: 32768 },
        { id: 'gemma2-9b-it', name: 'Gemma 2 9B', context_length: 8192 }
    ],
    deepseek: [
        { id: 'deepseek-chat', name: 'DeepSeek-V3 (Chat & Coding)', context_length: 64000 },
        { id: 'deepseek-reasoner', name: 'DeepSeek-R1 (Full Reasoning)', context_length: 64000 }
    ],
    mistral: [
        { id: 'mistral-large-latest', name: 'Mistral Large 2', context_length: 128000 },
        { id: 'codestral-latest', name: 'Codestral (Coding Specialist)', context_length: 256000 },
        { id: 'pixtral-large-latest', name: 'Pixtral Large (Multimodal)', context_length: 128000 },
        { id: 'ministral-8b-latest', name: 'Ministral 8B', context_length: 128000 }
    ],
    together: [
        { id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', name: 'Llama 3.3 70B Turbo', context_length: 131000 },
        { id: 'deepseek-ai/DeepSeek-R1', name: 'DeepSeek R1 (Together)', context_length: 64000 },
        { id: 'Qwen/Qwen2.5-72B-Instruct-Turbo', name: 'Qwen 2.5 72B Turbo', context_length: 32000 },
        { id: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo', name: 'Llama 3.1 8B Turbo', context_length: 131000 }
    ],
    perplexity: [
        { id: 'sonar', name: 'Sonar (Live Search Grounded)', context_length: 128000 },
        { id: 'sonar-pro', name: 'Sonar Pro (Deep Web Research)', context_length: 200000 },
        { id: 'sonar-reasoning', name: 'Sonar Reasoning', context_length: 128000 }
    ],
    cerebras: [
        { id: 'llama3.3-70b', name: 'Llama 3.3 70B (Fast Inference)', context_length: 128000 },
        { id: 'llama3.1-8b', name: 'Llama 3.1 8B (Fast Inference)', context_length: 8192 }
    ],
    nvidia: [
        { id: 'meta/llama-3.2-11b-vision-instruct', name: 'Llama 3.2 11B Vision (Fast)', context_length: 128000 },
        { id: 'moonshotai/kimi-k3', name: 'Kimi K3 (Moonshot AI)', context_length: 128000 },
        { id: 'nvidia/llama-3.1-nemotron-70b-instruct', name: 'Nemotron 70B', context_length: 128000 },
        { id: 'deepseek-ai/deepseek-v4-pro-0813', name: 'DeepSeek V4 Pro', context_length: 64000 },
        { id: 'mistralai/mistral-large-2-instruct', name: 'Mistral Large 2', context_length: 128000 }
    ],
    cohere: [
        { id: 'command-r-plus-08-2024', name: 'Command R+ (Enterprise)', context_length: 128000 },
        { id: 'command-r-08-2024', name: 'Command R', context_length: 128000 }
    ],
    ollama: [
        { id: 'llama3.2', name: 'Llama 3.2', context_length: 128000 },
        { id: 'deepseek-r1', name: 'DeepSeek R1 (Local Distill)', context_length: 64000 },
        { id: 'qwen2.5-coder', name: 'Qwen 2.5 Coder', context_length: 32000 },
        { id: 'mistral', name: 'Mistral 7B', context_length: 32000 },
        { id: 'phi3', name: 'Phi-3 Mini', context_length: 128000 }
    ],
    lmstudio: [
        { id: 'local-model', name: 'Local Model (LM Studio)', context_length: 32000 }
    ],
    custom: [
        { id: 'default', name: 'Default Model', context_length: 32000 }
    ]
};

export const DEFAULT_MODELS = CURATED_MODELS_BY_PROVIDER.openrouter;

export function initModelSelector({ onModelChange }) {
    const modelSearchInput = document.getElementById('modal-model-search');
    const modelDropdown = document.getElementById('modal-model-dropdown');
    const wrapper = modelSearchInput?.closest('.model-selector-wrapper');

    function getCuratedForProvider(provider) {
        return CURATED_MODELS_BY_PROVIDER[provider] || CURATED_MODELS_BY_PROVIDER.openrouter;
    }

    if (!state.models || state.models.length === 0) {
        state.models = [...getCuratedForProvider(state.config.provider)];
    }

    async function loadModelCatalog() {
        const provider = state.config.provider || 'openrouter';
        const apiKey = state.config.apiKey || '';
        const customBaseUrl = state.config.baseUrl || '';

        try {
            const list = await fetchModels(provider, apiKey, customBaseUrl);
            if (Array.isArray(list) && list.length > 0) {
                state.models = list;
                renderModelDropdown(state.models);
                syncInput();
            }
        } catch (e) {
            console.warn(`Gagal memuat katalog lengkap untuk ${provider}:`, e);
        }
    }

    function renderModelDropdown(modelsToRender) {
        if (!modelDropdown) return;
        modelDropdown.innerHTML = '';

        const list = modelsToRender || state.models || getCuratedForProvider(state.config.provider);

        if (list.length === 0) {
            const emptyLi = document.createElement('li');
            emptyLi.className = 'dropdown-item empty';
            emptyLi.textContent = 'Model tidak ditemukan. Coba filter lain';
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
                setProviderModel(state.config.provider, m.id);
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
            const providerModels = state.models?.length ? state.models : getCuratedForProvider(state.config.provider);
            const current = providerModels.find(m => m.id === state.selectedModel);
            modelSearchInput.value = current?.name || state.selectedModel || '';
            modelSearchInput.disabled = false;
        }
    }

    function switchProvider(newProvider) {
        const curated = getCuratedForProvider(newProvider);
        state.models = [...curated];

        // Jika belum ada model tersimpan untuk provider ini, pilih default provider tersebut
        const savedModel = state.config.providerModels?.[newProvider];
        const cfg = PROVIDERS_CONFIG[newProvider] || PROVIDERS_CONFIG.openrouter;
        state.selectedModel = savedModel || cfg.defaultModel || curated[0]?.id;

        renderModelDropdown(state.models);
        syncInput();

        // Coba load katalog dinamis jika ada API key atau local
        const apiKey = state.config.apiKey;
        if (cfg.isLocal || apiKey) {
            loadModelCatalog();
        }

        if (onModelChange) onModelChange(state.selectedModel);
    }

    if (modelSearchInput && modelDropdown) {
        renderModelDropdown(state.models);
        syncInput();

        const openDropdown = () => {
            renderModelDropdown(state.models);
            modelDropdown.classList.remove('hidden');
            const cfg = PROVIDERS_CONFIG[state.config.provider] || PROVIDERS_CONFIG.openrouter;
            if (cfg.isLocal || state.config.apiKey) {
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
            const list = state.models || getCuratedForProvider(state.config.provider);
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
        syncInput,
        switchProvider
    };
}
