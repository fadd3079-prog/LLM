import { parseSSEChunk } from './stream-parser.js';

export async function fetchModels(provider, apiKey) {
    if (!apiKey) throw new Error('API Key belum diisi');

    const url = 'https://openrouter.ai/api/v1/models';
    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': window.location.href,
            'X-Title': 'AI Workspace'
        }
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `Gagal mengambil model (${response.status})`);
    }

    const data = await response.json();
    return (data.data || []).map(m => ({
        id: m.id,
        name: m.name || m.id,
        description: m.description || '',
        context_length: m.context_length || 0,
        pricing: m.pricing || null
    })).sort((a, b) => a.name.localeCompare(b.name));
}

export async function streamChat(messages, provider, apiKey, model, onChunk, onComplete, onError, options = {}) {
    if (!apiKey) {
        if (onError) onError('API Key diperlukan untuk mengirim pesan.');
        return;
    }

    const url = 'https://openrouter.ai/api/v1/chat/completions';
    const payload = {
        model: model || 'google/gemini-2.5-flash',
        messages: messages.map(m => {
            if (m.attachments && m.attachments.length > 0) {
                let userText = m.content || '';
                const parts = [];

                m.attachments.forEach(att => {
                    if (att.category === 'pdf' || att.type === 'application/pdf') {
                        userText += `\n\n[Lampiran Dokumen PDF: ${att.name} (${att.sizeFormatted || ''}${att.pageCount ? ', ' + att.pageCount + ' halaman' : ''})]\n"""\n${att.textContent || ''}\n"""`;
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
    if (options.webSearch) {
        payload.plugins = [{ id: 'web' }];
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': window.location.href,
                'X-Title': 'AI Workspace'
            },
            body: JSON.stringify(payload),
            signal: options.signal
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error?.message || `Error API: ${response.statusText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let fullText = '';
        let accumulatedReasoning = '';
        let collectedCitations = [];
        let done = false;

        function buildComposedOutput() {
            let composed = '';
            if (accumulatedReasoning) {
                composed += `<details class="thought-box" open><summary class="thought-summary"><i data-lucide="brain"></i> <span>Proses Penalaran</span></summary><div class="thought-body">\n\n${accumulatedReasoning}\n\n</div></details>\n\n`;
            }

            let mainContent = fullText;
            // Tangani tag <think> jika model (seperti DeepSeek) mengeluarkannya di konten teks biasa
            if (mainContent.includes('<think>')) {
                mainContent = mainContent.replace(/<think>([\s\S]*?)(?:<\/think>|$)/g, (match, p1) => {
                    return `<details class="thought-box" open><summary class="thought-summary"><i data-lucide="brain"></i> <span>Proses Penalaran</span></summary><div class="thought-body">\n\n${p1.trim()}\n\n</div></details>\n\n`;
                });
            }

            composed += mainContent;

            if (collectedCitations.length > 0) {
                const citeList = collectedCitations.map(url => {
                    let domain = url;
                    try { domain = new URL(url).hostname.replace(/^www\./, ''); } catch(e) {}
                    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="source-tag"><i data-lucide="external-link"></i> ${domain}</a>`;
                }).join('');
                composed += `\n\n<div class="sources-tray"><div class="sources-title"><i data-lucide="globe"></i> Sumber Riset:</div><div class="sources-list">${citeList}</div></div>`;
            }

            return composed;
        }

        while (!done) {
            // Cek jika sinyal abort terpicu selama pembacaan stream
            if (options.signal?.aborted) {
                break;
            }

            const { value, done: readerDone } = await reader.read();
            done = readerDone;
            if (value) {
                const chunk = decoder.decode(value, { stream: true });
                parseSSEChunk(
                    chunk,
                    (deltaContent, meta = {}) => {
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
                    },
                    () => {
                        done = true;
                    }
                );
            }
        }

        const finalOutput = buildComposedOutput();
        if (onComplete) onComplete(finalOutput);
    } catch (err) {
        if (err.name === 'AbortError' || options.signal?.aborted) {
            // Penghentian sengaja oleh pengguna
            const finalOutput = buildComposedOutput ? buildComposedOutput() : (fullText || '');
            if (onComplete) onComplete(finalOutput);
        } else {
            if (onError) onError(err.message || 'Terjadi kesalahan saat memproses permintaan.');
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