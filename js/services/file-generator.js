/**
 * Service untuk pembuatan dan pengunduhan berbagai format file dari percakapan AI
 */

const EXTENSION_MAP = {
    python: { ext: 'py', mime: 'text/x-python' },
    py: { ext: 'py', mime: 'text/x-python' },
    javascript: { ext: 'js', mime: 'application/javascript' },
    js: { ext: 'js', mime: 'application/javascript' },
    typescript: { ext: 'ts', mime: 'application/typescript' },
    ts: { ext: 'ts', mime: 'application/typescript' },
    html: { ext: 'html', mime: 'text/html' },
    css: { ext: 'css', mime: 'text/css' },
    markdown: { ext: 'md', mime: 'text/markdown' },
    md: { ext: 'md', mime: 'text/markdown' },
    json: { ext: 'json', mime: 'application/json' },
    csv: { ext: 'csv', mime: 'text/csv' },
    sql: { ext: 'sql', mime: 'application/sql' },
    bash: { ext: 'sh', mime: 'text/x-sh' },
    sh: { ext: 'sh', mime: 'text/x-sh' },
    shell: { ext: 'sh', mime: 'text/x-sh' },
    yaml: { ext: 'yml', mime: 'text/yaml' },
    yml: { ext: 'yml', mime: 'text/yaml' },
    xml: { ext: 'xml', mime: 'application/xml' },
    svg: { ext: 'svg', mime: 'image/svg+xml' },
    text: { ext: 'txt', mime: 'text/plain' },
    txt: { ext: 'txt', mime: 'text/plain' },
    c: { ext: 'c', mime: 'text/x-c' },
    cpp: { ext: 'cpp', mime: 'text/x-c++src' },
    java: { ext: 'java', mime: 'text/x-java-source' },
    rust: { ext: 'rs', mime: 'text/rust' },
    go: { ext: 'go', mime: 'text/x-go' },
    php: { ext: 'php', mime: 'text/x-php' }
};

/**
 * Unduh teks sebagai file lokal di komputer pengguna
 */
export function downloadTextAsFile(filename, text, mimeType = 'text/plain;charset=utf-8') {
    if (!text && text !== '') return;
    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `file_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 200);
}

/**
 * Tentukan nama file yang sesuai dari bahasa atau nama file pada blok kode
 */
export function inferFilenameFromBlock(langIdentifier) {
    if (!langIdentifier) return 'dokumen.txt';

    const clean = langIdentifier.trim().toLowerCase();

    // Jika blok kode sudah menyertakan nama file lengkap (misal: "script.py" atau "index.html")
    if (clean.includes('.')) {
        return clean;
    }

    const mapping = EXTENSION_MAP[clean];
    if (mapping) {
        return `file_${Date.now()}.${mapping.ext}`;
    }

    return `file_${Date.now()}.${clean || 'txt'}`;
}

/**
 * Ekspor seluruh pesan respon asisten sebagai file Markdown atau Teks
 */
export function exportMessageAsFile(rawContent, format = 'md', prefix = 'dokumen_ai') {
    if (!rawContent) return;

    const timestamp = new Date().toISOString().slice(0, 10);
    let filename = `${prefix}_${timestamp}.${format}`;
    let mime = 'text/markdown;charset=utf-8';

    if (format === 'txt') {
        mime = 'text/plain;charset=utf-8';
    } else if (format === 'html') {
        mime = 'text/html;charset=utf-8';
        rawContent = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${prefix}</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #1c1917; }
pre { background: #f4f4f6; padding: 14px; border-radius: 6px; overflow-x: auto; }
code { font-family: monospace; }
table { border-collapse: collapse; width: 100%; margin: 1em 0; }
th, td { border: 1px solid #e2e8f0; padding: 8px 12px; }
th { background: #f8fafc; font-weight: 600; }
</style>
</head>
<body>
${rawContent}
</body>
</html>`;
    }

    downloadTextAsFile(filename, rawContent, mime);
}
