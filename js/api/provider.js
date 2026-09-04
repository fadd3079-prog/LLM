import { createSSEParser } from './stream-parser.js';

export const PROVIDERS_CONFIG = {
    openrouter: {
        id: 'openrouter',
        name: 'OpenRouter',
        defaultBaseUrl: 'https://openrouter.ai/api/v1',
        keyUrl: 'https://openrouter.ai/keys',
        helpText: 'Ambil API Key OpenRouter (300+ Model)',
        keyPlaceholder: 'sk-or-v1-...',
        isLocal: false,
        supportsWebSearch: true,
        defaultModel: 'google/gemini-2.5-flash',
        headers: (apiKey) => ({
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': window.location.href,
            'X-Title': 'AI Workspace'
        })
    },
    openai: {
        id: 'openai',
        name: 'OpenAI',
        defaultBaseUrl: 'https://api.openai.com/v1',
        keyUrl: 'https://platform.openai.com/api-keys',
        helpText: 'Ambil API Key OpenAI',
        keyPlaceholder: 'sk-proj-...',
        isLocal: false,
        defaultModel: 'gpt-4o',
        headers: (apiKey) => ({
            'Authorization': `Bearer ${apiKey}`
        })
    },
    gemini: {
        id: 'gemini',
        name: 'Google Gemini',
        defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
        keyUrl: 'https://aistudio.google.com/app/apikey',
        helpText: 'Ambil API Key Google AI Studio',
        keyPlaceholder: 'AIzaSy...',
        isLocal: false,
        defaultModel: 'gemini-2.5-flash',
        headers: (apiKey) => ({
            'Authorization': `Bearer ${apiKey}`
        })
    },
    anthropic: {
        id: 'anthropic',
        name: 'Anthropic Claude',
        defaultBaseUrl: 'https://api.anthropic.com/v1',
        keyUrl: 'https://console.anthropic.com/settings/keys',
        helpText: 'Ambil API Key Anthropic',
        keyPlaceholder: 'sk-ant-...',
        isLocal: false,
        isAnthropicApi: true,
        defaultModel: 'claude-3-5-sonnet-20241022',
        headers: (apiKey) => ({
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
        })
    },
    groq: {
        id: 'groq',
        name: 'Groq',
        defaultBaseUrl: 'https://api.groq.com/openai/v1',
        keyUrl: 'https://console.groq.com/keys',
        helpText: 'Ambil API Key Groq (Free tier tersedia)',
        keyPlaceholder: 'gsk_...',
        isLocal: false,
        defaultModel: 'llama-3.3-70b-versatile',
        headers: (apiKey) => ({
            'Authorization': `Bearer ${apiKey}`
        })
    },
    deepseek: {
        id: 'deepseek',
        name: 'DeepSeek',
        defaultBaseUrl: 'https://api.deepseek.com/v1',
        keyUrl: 'https://platform.deepseek.com/api_keys',
        helpText: 'Ambil API Key DeepSeek',
        keyPlaceholder: 'sk-...',
        isLocal: false,
        defaultModel: 'deepseek-chat',
        headers: (apiKey) => ({
            'Authorization': `Bearer ${apiKey}`
        })
    },
    mistral: {
        id: 'mistral',
        name: 'Mistral AI',
        defaultBaseUrl: 'https://api.mistral.ai/v1',
        keyUrl: 'https://console.mistral.ai/api-keys/',
        helpText: 'Ambil API Key Mistral AI',
        keyPlaceholder: '...',
        isLocal: false,
        defaultModel: 'mistral-large-latest',
        headers: (apiKey) => ({
            'Authorization': `Bearer ${apiKey}`
        })
    },
    together: {
        id: 'together',
        name: 'Together AI',
        defaultBaseUrl: 'https://api.together.xyz/v1',
        keyUrl: 'https://api.together.ai/settings/api-keys',
        helpText: 'Ambil API Key Together AI',
        keyPlaceholder: '...',
        isLocal: false,
        defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
        headers: (apiKey) => ({
            'Authorization': `Bearer ${apiKey}`
        })
    },
    perplexity: {
        id: 'perplexity',
        name: 'Perplexity AI',
        defaultBaseUrl: 'https://api.perplexity.ai',
        keyUrl: 'https://www.perplexity.ai/settings/api',
        helpText: 'Ambil API Key Perplexity',
        keyPlaceholder: 'pplx-...',
        isLocal: false,
        defaultModel: 'sonar',
        headers: (apiKey) => ({
            'Authorization': `Bearer ${apiKey}`
        })
    },
    cerebras: {
        id: 'cerebras',
        name: 'Cerebras',
        defaultBaseUrl: 'https://api.cerebras.ai/v1',
        keyUrl: 'https://cloud.cerebras.ai/',
        helpText: 'Ambil API Key Cerebras',
        keyPlaceholder: 'csk-...',
        isLocal: false,
        defaultModel: 'llama3.3-70b',
        headers: (apiKey) => ({
            'Authorization': `Bearer ${apiKey}`
        })
    },
    nvidia: {
        id: 'nvidia',
        name: 'NVIDIA NIM',
        defaultBaseUrl: 'https://integrate.api.nvidia.com/v1',
        keyUrl: 'https://build.nvidia.com/',
        helpText: 'Ambil API Key NVIDIA NIM (1000 free credits)',
        keyPlaceholder: 'nvapi-...',
        isLocal: false,
        defaultModel: 'meta/llama-3.2-11b-vision-instruct',
        headers: (apiKey) => ({
            'Authorization': `Bearer ${apiKey}`
        })
    },
    cohere: {
        id: 'cohere',
        name: 'Cohere',
        // Gunakan OpenAI compatibility endpoint agar request /chat/completions valid.
        defaultBaseUrl: 'https://api.cohere.com/compatibility/v1',
        keyUrl: 'https://dashboard.cohere.com/api-keys',
        helpText: 'Ambil API Key Cohere',
        keyPlaceholder: '...',
        isLocal: false,
        defaultModel: 'command-r-plus-08-2024',
        headers: (apiKey) => ({
            'Authorization': `Bearer ${apiKey}`
        })
    },
    ollama: {
        id: 'ollama',
        name: 'Ollama',
        defaultBaseUrl: 'http://localhost:11434/v1',
        keyUrl: 'https://ollama.com',
        helpText: 'Pastikan Ollama berjalan di komputer Anda',
        keyPlaceholder: 'Tidak diperlukan API Key (opsional)',
        isLocal: true,
        defaultModel: 'llama3.2',
        headers: (apiKey) => (apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {})
    },
    lmstudio: {
        id: 'lmstudio',
        name: 'LM Studio',
        defaultBaseUrl: 'http://localhost:1234/v1',
        keyUrl: 'https://lmstudio.ai',
        helpText: 'Nyalakan Local Server di LM Studio',
        keyPlaceholder: 'Tidak diperlukan API Key (opsional)',
        isLocal: true,
        defaultModel: 'local-model',
        headers: (apiKey) => (apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {})
    },
    custom: {
        id: 'custom',
        name: 'Custom (OpenAI-Compatible)',
        defaultBaseUrl: 'http://localhost:8000/v1',
        keyUrl: '',
        helpText: 'Endpoint kustom kompatibel OpenAI',
        keyPlaceholder: 'API Key (jika diperlukan)',
        isCustom: true,
        defaultModel: 'default',
        headers: (apiKey) => (apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {})
    }
};

export async function fetchModels(provider = 'openrouter', apiKey = '', customBaseUrl = '') {
    const cfg = PROVIDERS_CONFIG[provider] || PROVIDERS_CONFIG.openrouter;
    if (!cfg.isLocal && !apiKey && !cfg.isCustom) {
        return null;
    }

    let baseUrl = (customBaseUrl || cfg.defaultBaseUrl).replace(/\/+$/, '');
    baseUrl = baseUrl.replace(/\/chat\/completions\/?$/i, '');
    const url = `${baseUrl}/models`;

    try {
        const response = await fetch(url, {
            headers: cfg.headers(apiKey)
        });

        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        const rawList = data.data || data.models || [];
        if (!Array.isArray(rawList) || rawList.length === 0) return null;

        return rawList.map(m => {
            const id = m.id || m.name || m.model || '';
            const name = m.name || m.id || id;
            return {
                id,
                name: name.replace(/^models\//, ''),
                description: m.description || '',
                context_length: m.context_length || m.max_tokens || 0,
                pricing: m.pricing || null
            };
        }).filter(m => Boolean(m.id) && !m.id.includes('thinkingmachines/inkling')).sort((a, b) => a.name.localeCompare(b.name));
    } catch (e) {
        console.warn(`Gagal fetch models dari ${provider}:`, e);
        return null;
    }
}

export async function streamChat(messages, provider, apiKey, model, onChunk, onComplete, onError, options = {}) {
    const cfg = PROVIDERS_CONFIG[provider] || PROVIDERS_CONFIG.openrouter;
    if (!cfg.isLocal && !apiKey && !cfg.isCustom) {
        if (onError) onError(`API Key diperlukan untuk provider ${cfg.name}.`);
        return;
    }

    const baseUrl = (options.baseUrl || cfg.defaultBaseUrl).replace(/\/+$/, '');

    // Format request khusus untuk Anthropic Claude Messages API
    if (cfg.isAnthropicApi) {
        const url = `${baseUrl}/messages`;
        let systemPrompt = '';
        const anthropicMessages = [];

        messages.forEach(m => {
            if (m.role === 'system') {
                systemPrompt += (systemPrompt ? '\n\n' : '') + m.content;
                return;
            }

            if (m.attachments && m.attachments.length > 0) {
                const contentBlocks = [];
                let userText = m.content || '';

                m.attachments.forEach(att => {
                    if (att.category === 'pdf' || att.type === 'application/pdf') {
                        userText += `\n\n[Lampiran Dokumen PDF: ${att.name}${att.pageCount ? ' (' + att.pageCount + ' halaman)' : ''}]\n"""\n${att.textContent || ''}\n"""`;
                    } else if (att.category === 'presentation' || att.ext === 'pptx' || att.ext === 'ppt') {
                        userText += `\n\n[Lampiran Presentasi PowerPoint: ${att.name}${att.slideCount ? ' (' + att.slideCount + ' slide)' : ''}]\n"""\n${att.textContent || ''}\n"""`;
                    } else if (att.category === 'document' || att.ext === 'docx' || att.ext === 'doc') {
                        userText += `\n\n[Lampiran Dokumen Word: ${att.name}]\n"""\n${att.textContent || ''}\n"""`;
                    } else if (att.category === 'spreadsheet' || att.ext === 'xlsx' || att.ext === 'xls') {
                        userText += `\n\n[Lampiran Lembar Kerja Spreadsheet: ${att.name}]\n"""\n${att.textContent || ''}\n"""`;
                    } else if (att.category === 'zip' || att.type === 'application/zip') {
                        userText += `\n\n[Lampiran Arsip ZIP: ${att.name}]\n"""\n${att.textContent || ''}\n"""`;
                    } else if (att.category === 'text' || att.textContent) {
                        userText += `\n\n[Lampiran Berkas: ${att.name}]\n\`\`\`${att.ext || ''}\n${att.textContent || ''}\n\`\`\``;
                    }
                });

                if (userText) {
                    contentBlocks.push({ type: 'text', text: userText });
                }

                m.attachments.forEach(att => {
                    if (att.category === 'image' || att.type?.startsWith('image/')) {
                        if (att.data && att.data.includes(',')) {
                            const [meta, base64Data] = att.data.split(',');
                            const mimeType = meta.match(/:(.*?);/)?.[1] || 'image/jpeg';
                            contentBlocks.push({
                                type: 'image',
                                source: {
                                    type: 'base64',
                                    media_type: mimeType,
                                    data: base64Data
                                }
                            });
                        }
                    }
                    if (att.pageImages && att.pageImages.length > 0) {
                        att.pageImages.forEach(pImg => {
                            const imgUrl = typeof pImg === 'string' ? pImg : pImg.dataUrl;
                            if (imgUrl && imgUrl.includes(',')) {
                                const [meta, base64Data] = imgUrl.split(',');
                                const mimeType = meta.match(/:(.*?);/)?.[1] || 'image/jpeg';
                                contentBlocks.push({
                                    type: 'image',
                                    source: {
                                        type: 'base64',
                                        media_type: mimeType,
                                        data: base64Data
                                    }
                                });
                            }
                        });
                    }
                });

                anthropicMessages.push({
                    role: m.role === 'user' ? 'user' : 'assistant',
                    content: contentBlocks.length === 1 && contentBlocks[0].type === 'text' ? contentBlocks[0].text : contentBlocks
                });
            } else {
                anthropicMessages.push({
                    role: m.role === 'user' ? 'user' : 'assistant',
                    content: m.content || ''
                });
            }
        });

        const anthropicPayload = {
            model: model || cfg.defaultModel,
            messages: anthropicMessages,
            max_tokens: options.maxTokens ?? 2048,
            temperature: options.temperature ?? 0.7,
            stream: true
        };

        if (systemPrompt) {
            anthropicPayload.system = systemPrompt;
        }

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    ...cfg.headers(apiKey),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(anthropicPayload),
                signal: options.signal
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error?.message || `Error Anthropic: ${response.statusText}`);
            }

            await readStreamResponse(response, onChunk, onComplete, onError, options);
            return;
        } catch (err) {
            if (err.name === 'AbortError' || options.signal?.aborted) {
                if (onComplete) onComplete('');
            } else {
                if (onError) onError(err.message || 'Terjadi kesalahan saat memproses permintaan Anthropic.');
            }
            return;
        }
    }

    // Format standar OpenAI-compatible (OpenRouter, OpenAI, Gemini, Groq, DeepSeek, Mistral, Together, Cerebras, NVIDIA, Ollama, LM Studio, Custom)
    let cleanBaseUrl = (options.baseUrl || cfg.defaultBaseUrl).replace(/\/+$/, '');
    cleanBaseUrl = cleanBaseUrl.replace(/\/chat\/completions\/?$/i, '');
    const url = `${cleanBaseUrl}/chat/completions`;
    const payload = {
        model: model || cfg.defaultModel,
        messages: messages.map(m => {
            if (m.attachments && m.attachments.length > 0) {
                let userText = m.content || '';
                const parts = [];

                m.attachments.forEach(att => {
                    if (att.category === 'pdf' || att.type === 'application/pdf') {
                        userText += `\n\n[Lampiran Dokumen PDF: ${att.name} (${att.sizeFormatted || ''}${att.pageCount ? ', ' + att.pageCount + ' halaman' : ''})]\n"""\n${att.textContent || ''}\n"""`;
                    } else if (att.category === 'presentation' || att.ext === 'pptx' || att.ext === 'ppt') {
                        userText += `\n\n[Lampiran Presentasi PowerPoint: ${att.name} (${att.sizeFormatted || ''}${att.slideCount ? ', ' + att.slideCount + ' slide' : ''})]\n"""\n${att.textContent || ''}\n"""`;
                    } else if (att.category === 'document' || att.ext === 'docx' || att.ext === 'doc') {
                        userText += `\n\n[Lampiran Dokumen Word: ${att.name} (${att.sizeFormatted || ''})]\n"""\n${att.textContent || ''}\n"""`;
                    } else if (att.category === 'spreadsheet' || att.ext === 'xlsx' || att.ext === 'xls') {
                        userText += `\n\n[Lampiran Lembar Kerja Spreadsheet: ${att.name} (${att.sizeFormatted || ''})]\n"""\n${att.textContent || ''}\n"""`;
                    } else if (att.category === 'zip' || att.type === 'application/zip') {
                        userText += `\n\n[Lampiran Arsip ZIP: ${att.name} (${att.sizeFormatted || ''})]\n"""\n${att.textContent || ''}\n"""`;
                    } else if (att.category === 'text' || att.textContent) {
                        userText += `\n\n[Lampiran Berkas: ${att.name} (${att.sizeFormatted || ''})]\n\`\`\`${att.ext || ''}\n${att.textContent || ''}\n\`\`\``;
                    }
                });

                parts.push({ type: 'text', text: userText });

                m.attachments.forEach(att => {
                    if (att.category === 'image' || att.type?.startsWith('image/')) {
                        if (att.data) {
                            parts.push({
                                type: 'image_url',
                                image_url: { url: att.data }
                            });
                        }
                    }
                    if (att.pageImages && att.pageImages.length > 0) {
                        att.pageImages.forEach(pImg => {
                            const imgUrl = typeof pImg === 'string' ? pImg : pImg.dataUrl;
                            if (imgUrl) {
                                parts.push({
                                    type: 'image_url',
                                    image_url: { url: imgUrl }
                                });
                            }
                        });
                    }
                });

                return { role: m.role, content: parts };
            }
            return { role: m.role, content: m.content };
        }),
        stream: true,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2048
    };

    // Dukungan plugin riset web OpenRouter
    if (options.webSearch && provider === 'openrouter') {
        payload.plugins = [{ id: 'web' }];
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                ...cfg.headers(apiKey),
                'Content-Type': 'application/json',
                'Accept': 'text/event-stream'
            },
            body: JSON.stringify(payload),
            signal: options.signal
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            let errMsg = errData.error?.message || `Error API (${response.status}): ${response.statusText}`;
            if (errMsg.includes('agentic harnesses') || errMsg.includes('inkling')) {
                errMsg = `Model "${model || ''}" dibatasi oleh OpenRouter (hanya untuk agentic harness terdaftar). Silakan ganti ke model lain seperti Gemini Flash, Llama 3.3, atau DeepSeek di pengaturan model.`;
            }
            throw new Error(errMsg);
        }

        await readStreamResponse(response, onChunk, onComplete, onError, options);
    } catch (err) {
        if (err.name === 'AbortError' || options.signal?.aborted) {
            if (onComplete) onComplete('');
        } else {
            let errorMsg = err.message || 'Terjadi kesalahan saat memproses permintaan.';
            if (errorMsg === 'Failed to fetch' || errorMsg.includes('Failed to fetch')) {
                if (provider === 'nvidia') {
                    errorMsg = 'NVIDIA NIM diblokir oleh CORS browser (Server NVIDIA belum menyertakan header Access-Control-Allow-Origin untuk panggilan langsung dari browser). Solusi: gunakan OpenRouter/Groq atau jalankan reverse proxy lokal.';
                } else {
                    errorMsg = `Gagal terhubung (${errorMsg}). Periksa koneksi internet Anda atau pastikan endpoint mendukung akses CORS dari browser.`;
                }
            }
            if (onError) onError(errorMsg);
        }
    }
}

async function readStreamResponse(response, onChunk, onComplete, onError, options = {}) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    const sse = createSSEParser();
    let fullText = '';
    let accumulatedReasoning = '';
    let collectedCitations = [];
    let done = false;

    function buildComposedOutput() {
        let composed = '';
        if (accumulatedReasoning) {
            composed += `<details class="thought-box" open><summary class="thought-summary"><i data-lucide="brain"></i> <span>Thinking</span></summary><div class="thought-body">\n\n${accumulatedReasoning}\n\n</div></details>\n\n`;
        }

        let mainContent = fullText;
        // Tangani tag <think> jika model (seperti DeepSeek) mengeluarkannya di konten teks biasa
        if (mainContent.includes('<think>')) {
            mainContent = mainContent.replace(/<think>([\s\S]*?)(?:<\/think>|$)/g, (match, p1) => {
                return `<details class="thought-box" open><summary class="thought-summary"><i data-lucide="brain"></i> <span>Thinking</span></summary><div class="thought-body">\n\n${p1.trim()}\n\n</div></details>\n\n`;
            });
        }

        composed += mainContent;

        if (collectedCitations.length > 0) {
            const citeList = collectedCitations.map(url => {
                let domain = url;
                try { domain = new URL(url).hostname.replace(/^www\./, ''); } catch(e) {}
                return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="source-tag"><i data-lucide="external-link"></i> ${domain}</a>`;
            }).join('');
            composed += `\n\n<div class="sources-tray"><div class="sources-title"><i data-lucide="globe"></i> Sources</div><div class="sources-list">${citeList}</div></div>`;
        }

        return composed;
    }

    const onDelta = (deltaContent, meta = {}) => {
        if (meta.reasoning) {
            accumulatedReasoning += meta.reasoning;
        }
        if (meta.citations && Array.isArray(meta.citations)) {
            collectedCitations = [...new Set([...collectedCitations, ...meta.citations])];
        }
        if (deltaContent) {
            fullText += deltaContent;
        }
        const composed = buildComposedOutput();
        if (onChunk) onChunk(composed);
    };

    try {
        while (!done) {
            if (options.signal?.aborted) {
                break;
            }

            const { value, done: readerDone } = await reader.read();
            done = readerDone;
            if (value) {
                const chunk = decoder.decode(value, { stream: true });
                sse.feed(chunk, onDelta, () => { done = true; });
            }
        }

        // Flush decoder agar potongan multibyte di akhir stream tidak hilang.
        const tail = decoder.decode();
        if (tail) sse.feed(tail, onDelta, () => { done = true; });
        // Flush sisa buffer parser untuk event yang tidak ditutup \n\n.
        sse.flush(onDelta, () => { done = true; });

        const finalOutput = buildComposedOutput();
        if (onComplete) onComplete(finalOutput);
    } catch (err) {
        if (err.name === 'AbortError' || options.signal?.aborted) {
            const finalOutput = buildComposedOutput();
            if (onComplete) onComplete(finalOutput);
        } else {
            throw err;
        }
    }
}

export function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

export function validateImageFile(file) {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const maxSize = 10 * 1024 * 1024;
    if (!validTypes.includes(file.type)) {
        return { valid: false, error: 'Format file tidak didukung. Harap gunakan JPEG, PNG, WEBP, atau GIF.' };
    }
    if (file.size > maxSize) {
        return { valid: false, error: 'Ukuran file terlalu besar. Maksimal 10MB.' };
    }
    return { valid: true };
}