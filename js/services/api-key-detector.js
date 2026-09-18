import { PROVIDERS_CONFIG } from '../api/provider.js';
import { state, setProvider, setProviderApiKey, setProviderModel, setProviderBaseUrl, saveStore } from '../store/index.js';

export function maskApiKey(key) {
    if (!key || typeof key !== 'string') return '';
    if (key.length <= 12) return key.slice(0, 3) + '...' + key.slice(-2);
    return key.slice(0, 10) + '...' + key.slice(-4);
}

// Pola secret generik yang harus disensor dari teks chat & payload LLM.
// Tidak spesifik provider: mencakup semua prefix yang umum dipakai agar
// pembicaraan biasa tentang konfigurasi tidak bocor ke storage/provider.
const SECRET_PATTERNS = [
    /nvapi-[A-Za-z0-9_\-]{20,}/g,
    /sk-or-v1-[a-f0-9]{20,}/gi,
    /sk-or-[A-Za-z0-9_\-]{20,}/g,
    /sk-ant-[A-Za-z0-9_\-]{20,}/g,
    /sk-proj-[A-Za-z0-9_\-]{20,}/g,
    /sk-fish-[A-Za-z0-9_\-]{20,}/g,
    /sk-[A-Za-z0-9_\-]{20,}/g,
    /gsk_[A-Za-z0-9]{20,}/g,
    /AIzaSy[A-Za-z0-9_\-]{20,}/g,
    /pplx-[a-f0-9]{20,}/gi,
    /csk-[A-Za-z0-9_\-]{20,}/g
];

export function redactSecretsInText(text) {
    if (!text || typeof text !== 'string') return text || '';
    let redacted = text;
    for (const re of SECRET_PATTERNS) {
        redacted = redacted.replace(re, (m) => maskApiKey(m));
    }
    return redacted;
}

export function detectAndParseApiConfig(text) {
    if (!text || typeof text !== 'string') return null;

    let apiKey = null;
    let provider = null;
    let baseUrl = null;
    let model = null;

    // 1. Deteksi Base URL / Invoke URL - ONLY from explicit configuration patterns
    // Never treat a standalone URL in user text as a config URL
    const explicitUrlPatterns = [
        /(?:invoke_url|base_url|baseUrl|endpoint|api_base|api_endpoint)\s*[:=]\s*["'](https?:\/\/[^\s"'\`]+)["']/i,
        /(?:invoke_url|base_url|baseUrl|endpoint|api_base|api_endpoint)\s*[:=]\s*(https?:\/\/[^\s"'\`]+)/i
    ];

    for (const regex of explicitUrlPatterns) {
        const match = text.match(regex);
        if (match) {
            let foundUrl = match[1] || match[0];
            foundUrl = foundUrl.replace(/\/+$/, '').replace(/\/chat\/completions\/?$/i, '');
            if (foundUrl.startsWith('http')) {
                baseUrl = foundUrl;
                break;
            }
        }
    }

    // 2. Deteksi Model - ONLY from explicit configuration patterns
    const modelPatterns = [
        /["']model["']\s*[:=]\s*["']([^"'\r\n\t,]+)["']/i,
        /model\s*[:=]\s*["']([^"'\r\n\t,]+)["']/i
    ];

    for (const regex of modelPatterns) {
        const match = text.match(regex);
        if (match && match[1]) {
            const candidate = match[1].trim();
            if (candidate && !['gpt', 'model', 'default', 'true', 'false'].includes(candidate.toLowerCase())) {
                model = candidate;
                break;
            }
        }
    }

    // 3. Deteksi API Key berdasarkan pola khas provider
    // a. NVIDIA NIM: nvapi-...
    const nvapiMatch = text.match(/nvapi-[A-Za-z0-9_\-]{30,}/);
    if (nvapiMatch) {
        apiKey = nvapiMatch[0];
        provider = 'nvidia';
    }

    // b. OpenRouter: sk-or-v1-... atau sk-or-...
    if (!apiKey) {
        const orMatch = text.match(/sk-or-v1-[a-f0-9]{64}|sk-or-[A-Za-z0-9_\-]{30,}/i);
        if (orMatch) {
            apiKey = orMatch[0];
            provider = 'openrouter';
        }
    }

    // c. Groq: gsk_...
    if (!apiKey) {
        const groqMatch = text.match(/gsk_[A-Za-z0-9]{20,}/);
        if (groqMatch) {
            apiKey = groqMatch[0];
            provider = 'groq';
        }
    }

    // d. Gemini: AIzaSy...
    if (!apiKey) {
        const geminiMatch = text.match(/AIzaSy[A-Za-z0-9_\-]{33}/);
        if (geminiMatch) {
            apiKey = geminiMatch[0];
            provider = 'gemini';
        }
    }

    // e. Anthropic: sk-ant-...
    if (!apiKey) {
        const antMatch = text.match(/sk-ant-[A-Za-z0-9_\-]{30,}/);
        if (antMatch) {
            apiKey = antMatch[0];
            provider = 'anthropic';
        }
    }

    // f. Perplexity: pplx-...
    if (!apiKey) {
        const pplxMatch = text.match(/pplx-[a-f0-9]{30,}/i);
        if (pplxMatch) {
            apiKey = pplxMatch[0];
            provider = 'perplexity';
        }
    }

    // g. Cerebras: csk-...
    if (!apiKey) {
        const cskMatch = text.match(/csk-[A-Za-z0-9_\-]{25,}/);
        if (cskMatch) {
            apiKey = cskMatch[0];
            provider = 'cerebras';
        }
    }

    // h. Fish Audio: sk-fish-...
    if (!apiKey) {
        const fishMatch = text.match(/sk-fish-[A-Za-z0-9_\-]{25,}/);
        if (fishMatch) {
            apiKey = fishMatch[0];
            provider = 'fish_audio';
        }
    }

    // i. Generic Bearer Token or Header Authorization - ONLY in config context
    if (!apiKey) {
        const authMatch = text.match(/(?:Bearer|Authorization["':\s]+Bearer)\s+([A-Za-z0-9_\-]{20,})/i);
        if (authMatch && authMatch[1]) {
            apiKey = authMatch[1];
        }
    }

    // j. Generic API Key format: sk-proj-... or sk-... - ONLY in config context
    if (!apiKey) {
        const skMatch = text.match(/sk-(?:proj-)?[A-Za-z0-9_\-]{25,}/);
        if (skMatch) {
            apiKey = skMatch[0];
        }
    }

    // k. API_KEY assignment in env/config: (API_KEY|KEY) = "..."
    if (!apiKey) {
        const envMatch = text.match(/(?:[A-Z0-9_]*API[_-]?KEY)\s*[:=]\s*["']?([A-Za-z0-9_\-]{20,})["']?/i);
        if (envMatch && envMatch[1]) {
            apiKey = envMatch[1];
        }
    }

    // 4. Resolusi Provider - ONLY from explicit config signals, NOT from casual text mentions
    if (!provider && baseUrl) {
        const lowerUrl = baseUrl.toLowerCase();
        if (lowerUrl.includes('api.nvidia.com')) provider = 'nvidia';
        else if (lowerUrl.includes('openrouter.ai')) provider = 'openrouter';
        else if (lowerUrl.includes('groq.com')) provider = 'groq';
        else if (lowerUrl.includes('deepseek.com')) provider = 'deepseek';
        else if (lowerUrl.includes('mistral.ai')) provider = 'mistral';
        else if (lowerUrl.includes('together')) provider = 'together';
        else if (lowerUrl.includes('perplexity.ai')) provider = 'perplexity';
        else if (lowerUrl.includes('cerebras.ai')) provider = 'cerebras';
        else if (lowerUrl.includes('cohere.com')) provider = 'cohere';
        else if (lowerUrl.includes('11434')) provider = 'ollama';
        else if (lowerUrl.includes('1234')) provider = 'lmstudio';
        else if (lowerUrl.includes('openai.com')) provider = 'openai';
        else if (lowerUrl.includes('fish.audio')) provider = 'fish_audio';
        else if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) provider = 'custom';
    }

    // Provider fallback from key prefix (deterministic, no text matching)
    if (!provider && apiKey) {
        if (apiKey.startsWith('nvapi-')) provider = 'nvidia';
        else if (apiKey.startsWith('sk-or-')) provider = 'openrouter';
        else if (apiKey.startsWith('sk-ant-')) provider = 'anthropic';
        else if (apiKey.startsWith('sk-proj-')) provider = 'openai';
        else if (apiKey.startsWith('sk-fish-')) provider = 'fish_audio';
        else if (apiKey.startsWith('gsk_')) provider = 'groq';
        else if (apiKey.startsWith('AIzaSy')) provider = 'gemini';
        else if (apiKey.startsWith('pplx-')) provider = 'perplexity';
        else if (apiKey.startsWith('csk-')) provider = 'cerebras';
        else if (apiKey.startsWith('sk-')) provider = 'openai';
    }

    // Jika tidak ditemukan API Key maupun Localhost BaseUrl, bukan instruksi konfigurasi
    if (!apiKey && !['ollama', 'lmstudio', 'custom'].includes(provider)) {
        return null;
    }

    // Saring placeholder palsu
    if (apiKey && /^(your[-_]?api[-_]?key|test|sample|dummy|api_key_here)/i.test(apiKey)) {
        return null;
    }

    const providerConfig = PROVIDERS_CONFIG[provider] || PROVIDERS_CONFIG.custom;

    return {
        provider: provider || 'custom',
        providerName: providerConfig.name || provider,
        apiKey: apiKey || '',
        maskedKey: maskApiKey(apiKey),
        baseUrl: baseUrl || providerConfig.defaultBaseUrl,
        model: model || providerConfig.defaultModel,
        isCustomModel: Boolean(model)
    };
}

export function isPureApiSetupMessage(text, config) {
    if (!text || !config) return false;
    const stripped = text
        .replace(/nvapi-[A-Za-z0-9_\-]{20,}/g, '')
        .replace(/sk-[A-Za-z0-9_\-]{20,}/g, '')
        .replace(/gsk_[A-Za-z0-9]{20,}/g, '')
        .replace(/AIzaSy[A-Za-z0-9_\-]{33}/g, '')
        .replace(/https?:\/\/[^\s"'\`]+/g, '')
        .replace(/["']?model["']?\s*[:=]\s*["'][^"']+["']/gi, '')
        .replace(/(?:import\s+requests|requests\.post|curl|headers|payload|stream|invoke_url|Authorization|Bearer|Accept|max_tokens|temperature|seed|reasoning_effort)/gi, '')
        .replace(/[{}\[\](),:;'"=`_]/g, '')
        .trim();

    // Jika setelah kode dan key dihapus hanya tersisa sedikit teks atau kata-kata konfigurasi
    const setupKeywords = /^(?:tolong\s+)?(?:hubungkan|sambungkan|connect|setting|ganti|pakai|setup|simpan|cek|tes)?\s*(?:api\s*key|provider|ini)?$/i;
    return stripped.length < 40 || setupKeywords.test(stripped);
}

export function applyApiConfig(config) {
    if (!config) return false;

    const { provider, apiKey, baseUrl, model } = config;

    if (provider) {
        setProvider(provider);
    }

    if (apiKey) {
        setProviderApiKey(provider, apiKey);
    }

    if (baseUrl) {
        setProviderBaseUrl(provider, baseUrl);
    }

    if (model) {
        setProviderModel(provider, model);
        state.selectedModel = model;
    }

    saveStore();
    return true;
}

export function generateConnectionSuccessCard(config) {
    const { provider, providerName, maskedKey, baseUrl, model } = config;

    return `### ⚡ Provider & API Key Berhasil Terhubung!

Sistem telah **otomatis mendeteksi, mengonfigurasi, dan menyambungkan** kredensial API Anda ke pengaturan sistem:

| Parameter | Konfigurasi Aktif |
| :--- | :--- |
| **Provider** | **${providerName}** (\`${provider}\`) |
| **Model Aktif** | \`${model}\` |
| **Base URL** | \`${baseUrl}\` |
| **API Key** | \`${maskedKey || '(Tersambung)'}\` *(Tersimpan aman di LocalStorage)* |
| **Status Koneksi** | 🟢 **Terhubung & Siap Digunakan** |

> [!TIP]
> Pengaturan telah aktif seketika. Anda sekarang dapat langsung mengetik pertanyaan, instruksi koding, maupun mengunggah berkas (PDF, PPTX, gambar) untuk mulai chat dengan model **${model}**!`;
}
