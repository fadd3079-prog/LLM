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

export function redactSecretsInText(text, knownKeys = []) {
    if (!text || typeof text !== 'string') return text || '';
    let redacted = text;
    for (const re of SECRET_PATTERNS) {
        redacted = redacted.replace(re, (m) => maskApiKey(m));
    }
    redacted = redacted.replace(/(\b(?:api[_-]?key|authorization|bearer)\s*[:=]?\s*["']?)([A-Za-z0-9_-]{16,})/gi, '$1[KEY REDACTED]');
    for (const key of knownKeys) { if (typeof key === 'string' && key.length >= 8) redacted = redacted.split(key).join('[KEY REDACTED]'); }
    return redacted;
}
