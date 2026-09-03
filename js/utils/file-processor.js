export function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function getFileCategory(file) {
    const name = file.name || '';
    const ext = name.split('.').pop().toLowerCase();
    const type = (file.type || '').toLowerCase();

    if (type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) {
        return 'image';
    }
    if (type === 'application/pdf' || ext === 'pdf') {
        return 'pdf';
    }
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext) || type.includes('zip') || type.includes('compressed')) {
        return 'zip';
    }
    return 'text';
}

export function validateFile(file) {
    const maxSize = 30 * 1024 * 1024;
    if (file.size > maxSize) {
        return { valid: false, error: `Berkas "${file.name}" terlalu besar (maksimal 30MB).` };
    }
    return { valid: true };
}

export function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

export async function processFile(file) {
    const category = getFileCategory(file);
    const sizeFormatted = formatBytes(file.size);
    const ext = (file.name || '').split('.').pop().toLowerCase();
    const id = 'att_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);

    if (category === 'image') {
        const data = await fileToBase64(file);
        return {
            id,
            name: file.name || 'Gambar',
            type: file.type || 'image/png',
            category: 'image',
            size: file.size,
            sizeFormatted,
            data
        };
    }

    if (category === 'pdf') {
        let textContent = '';
        let pageCount = 0;
        try {
            if (window.pdfjsLib) {
                window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                const buffer = await file.arrayBuffer();
                const pdf = await window.pdfjsLib.getDocument({ data: buffer }).promise;
                pageCount = pdf.numPages;
                const maxPages = Math.min(pdf.numPages, 30);
                for (let i = 1; i <= maxPages; i++) {
                    const page = await pdf.getPage(i);
                    const tc = await page.getTextContent();
                    const pageStr = tc.items.map(x => x.str).join(' ');
                    textContent += `--- Halaman ${i} ---\n${pageStr}\n\n`;
                }
                if (pdf.numPages > 30) {
                    textContent += `[Catatan: Dokumen memiliki ${pdf.numPages} halaman, hanya 30 halaman pertama yang diekstrak]\n`;
                }
            } else {
                textContent = `[Dokumen PDF: ${file.name} (${sizeFormatted})]`;
            }
        } catch (e) {
            textContent = `[Dokumen PDF: ${file.name} - Gagal mengekstrak teks otomatis: ${e.message}]`;
        }

        return {
            id,
            name: file.name,
            type: 'application/pdf',
            category: 'pdf',
            size: file.size,
            sizeFormatted,
            textContent,
            pageCount
        };
    }

    if (category === 'zip') {
        let textContent = '';
        try {
            if (window.JSZip) {
                const zip = await window.JSZip.loadAsync(file);
                let tree = `Struktur Berkas Arsip ZIP (${file.name}):\n`;
                const textEntries = [];
                zip.forEach((path, entry) => {
                    if (!entry.dir) {
                        tree += `- ${path}\n`;
                        const fext = path.split('.').pop().toLowerCase();
                        const isTextLike = ['txt', 'md', 'json', 'js', 'ts', 'py', 'html', 'css', 'csv', 'yaml', 'yml', 'xml', 'sql', 'sh', 'c', 'cpp', 'rs', 'go', 'php'].includes(fext);
                        if (isTextLike && textEntries.length < 15) {
                            textEntries.push({ path, entry });
                        }
                    }
                });

                for (const item of textEntries) {
                    try {
                        const str = await item.entry.async('string');
                        if (str.length < 40000) {
                            tree += `\n--- Berkas: ${item.path} ---\n${str}\n`;
                        }
                    } catch (e) {}
                }
                textContent = tree;
            } else {
                textContent = `[Arsip ZIP: ${file.name} (${sizeFormatted})]`;
            }
        } catch (e) {
            textContent = `[Arsip ZIP: ${file.name} - Gagal mengekstrak: ${e.message}]`;
        }

        return {
            id,
            name: file.name,
            type: 'application/zip',
            category: 'zip',
            size: file.size,
            sizeFormatted,
            textContent
        };
    }

    // Default: text, code, markdown, csv, json, etc.
    let textContent = '';
    try {
        textContent = await file.text();
    } catch (e) {
        textContent = `[Berkas: ${file.name} (${sizeFormatted})]`;
    }

    return {
        id,
        name: file.name,
        type: file.type || 'text/plain',
        category: 'text',
        size: file.size,
        sizeFormatted,
        textContent,
        ext
    };
}
