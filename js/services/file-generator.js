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

/**
 * Ekspor seluruh pesan respon asisten langsung sebagai dokumen PDF profesional
 * tanpa mengharuskan pengguna menginstal Python / library eksternal di komputer mereka.
 */
export async function exportMessageAsPDF(contentElement, titlePrefix = 'Laporan_AI') {
    if (!contentElement) return;

    const timestamp = new Date().toISOString().slice(0, 10);
    // Cari judul dokumen dari H1 atau H2 pertama di dalam pesan jika ada
    const firstHeading = contentElement.querySelector('h1, h2');
    let docTitle = titlePrefix;
    if (firstHeading && firstHeading.textContent) {
        const sanitized = firstHeading.textContent.trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '_').slice(0, 45);
        if (sanitized) docTitle = sanitized;
    }
    const filename = `${docTitle}_${timestamp}.pdf`;

    // Clone element untuk rendering terisolasi
    const clone = contentElement.cloneNode(true);
    // Hapus tombol-tombol dan kontrol interaktif yang tidak perlu dicetak
    clone.querySelectorAll('.code-block-header, .assistant-actions, .user-actions, .sources-tray, .thought-box').forEach(el => el.remove());

    // Buat container cetak profesional
    const printContainer = document.createElement('div');
    printContainer.className = 'pdf-export-container';
    printContainer.style.cssText = `
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        color: #0f172a;
        background: #ffffff;
        padding: 24px 32px;
        line-height: 1.7;
        font-size: 11pt;
        max-width: 820px;
        margin: 0 auto;
    `;

    // Header kop dokumen profesional
    const docHeader = document.createElement('div');
    docHeader.style.cssText = `
        border-bottom: 2px solid #e2e8f0;
        padding-bottom: 12px;
        margin-bottom: 24px;
        display: flex;
        justify-content: space-between;
        align-items: center;
    `;
    docHeader.innerHTML = `
        <span style="font-weight: 700; font-size: 13pt; color: #1e293b; letter-spacing: -0.01em;">AI Workspace • Laporan Riset & Dokumen Eksekutif</span>
        <span style="font-size: 9pt; color: #64748b;">${new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
    `;

    // Footer dokumen
    const docFooter = document.createElement('div');
    docFooter.style.cssText = `
        border-top: 1px solid #e2e8f0;
        padding-top: 12px;
        margin-top: 36px;
        font-size: 8.5pt;
        color: #94a3b8;
        display: flex;
        justify-content: space-between;
    `;
    docFooter.innerHTML = `
        <span>Dihasilkan secara instan oleh AI Workspace</span>
        <span>Dokumen Resmi AI</span>
    `;

    printContainer.appendChild(docHeader);
    printContainer.appendChild(clone);
    printContainer.appendChild(docFooter);

    // Styling tabel dalam clone agar cetakan PDF rapi
    clone.querySelectorAll('table').forEach(table => {
        table.style.cssText = 'width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 9.5pt;';
        table.querySelectorAll('th, td').forEach(cell => {
            cell.style.cssText = 'border: 1px solid #cbd5e1; padding: 7px 10px; text-align: left; vertical-align: top;';
        });
        table.querySelectorAll('th').forEach(th => {
            th.style.backgroundColor = '#f8fafc';
            th.style.fontWeight = '600';
            th.style.color = '#0f172a';
        });
    });

    clone.querySelectorAll('h1').forEach(h => {
        h.style.cssText = 'font-size: 18pt; font-weight: 700; color: #0f172a; margin-top: 24px; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; page-break-after: avoid;';
    });

    clone.querySelectorAll('h2').forEach(h => {
        h.style.cssText = 'font-size: 14pt; font-weight: 600; color: #1e293b; margin-top: 20px; margin-bottom: 10px; page-break-after: avoid;';
    });

    clone.querySelectorAll('h3').forEach(h => {
        h.style.cssText = 'font-size: 12pt; font-weight: 600; color: #334155; margin-top: 16px; margin-bottom: 8px; page-break-after: avoid;';
    });

    clone.querySelectorAll('pre').forEach(pre => {
        pre.style.cssText = 'background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 6px; font-size: 9pt; font-family: monospace; white-space: pre-wrap; word-break: break-word; margin: 12px 0;';
    });

    clone.querySelectorAll('blockquote').forEach(bq => {
        bq.style.cssText = 'border-left: 3px solid #3b82f6; background: #f8fafc; padding: 10px 14px; margin: 14px 0; color: #334155; border-radius: 0 6px 6px 0;';
    });

    // Coba ekspor menggunakan html2pdf jika tersedia
    if (typeof window.html2pdf !== 'undefined') {
        const opt = {
            margin: [10, 10, 10, 10],
            filename: filename,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, letterRendering: true, logging: false },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
        };

        try {
            await window.html2pdf().set(opt).from(printContainer).save();
            return filename;
        } catch (err) {
            console.warn('html2pdf gagal, beralih ke print window:', err);
        }
    }

    // Fallback: Elegant Print Window (Bawaan browser yang selalu ada di Chrome/Edge/Firefox)
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        throw new Error('Popup diblokir browser. Izinkan pop-up untuk mengekspor dokumen.');
    }

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>${filename.replace('.pdf', '')}</title>
            <style>
                @page { size: A4; margin: 15mm; }
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.65; color: #0f172a; margin: 0; padding: 12px; }
                table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 10pt; }
                th, td { border: 1px solid #cbd5e1; padding: 7px 10px; text-align: left; }
                th { background: #f8fafc; }
                pre { background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; border-radius: 4px; font-size: 9.5pt; }
                @media print {
                    button { display: none; }
                }
            </style>
        </head>
        <body>
            ${printContainer.innerHTML}
            <script>
                window.onload = function() {
                    window.print();
                    setTimeout(function() { window.close(); }, 600);
                };
            <\/script>
        </body>
        </html>
    `);
    printWindow.document.close();
    return filename;
}

