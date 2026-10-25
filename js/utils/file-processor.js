import { ensureZip, ensurePdf } from './dependencies.js';
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

    if (type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp'].includes(ext)) {
        return 'image';
    }
    if (type === 'application/pdf' || ext === 'pdf') {
        return 'pdf';
    }
    if (['pptx', 'ppt', 'ppsx', 'odp'].includes(ext) || type.includes('presentation') || type.includes('powerpoint')) {
        return 'presentation';
    }
    if (['docx', 'doc', 'odt', 'rtf'].includes(ext) || type.includes('wordprocessingml') || type.includes('msword')) {
        return 'document';
    }
    if (['xlsx', 'xls', 'ods', 'csv', 'tsv'].includes(ext) || type.includes('spreadsheetml') || type.includes('excel')) {
        return 'spreadsheet';
    }
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext) || type.includes('zip') || type.includes('compressed')) {
        return 'zip';
    }
    return 'text';
}

export function validateFile(file) {
    const maxSize = 20 * 1024 * 1024; // Bound browser memory usage.
    if (file.size > maxSize) {
        return { valid: false, error: `Berkas "${file.name}" terlalu besar (maksimal 20MB).` };
    }
    const ext = (file.name || '').split('.').pop().toLowerCase();
    if (['doc', 'ppt', 'xls', 'odt', 'odp', 'ods', 'rtf', 'ppsx', 'rar', '7z', 'tar', 'gz', 'svg', 'bmp'].includes(ext)) {
        return { valid: false, error: 'Format belum didukung. Gunakan PDF, PPTX, DOCX, XLSX, CSV, ZIP, PNG/JPG/WebP/GIF, atau berkas teks.' };
    }
    if (getFileCategory(file) === 'text' && file.type && !file.type.startsWith('text/') && !/json|javascript|xml/.test(file.type) && !/^(js|ts|tsx|jsx|py|c|cpp|h|java|php|rs|go|sql|sh|md|yaml|yml|toml|ini|log)$/.test(ext)) {
        return { valid: false, error: 'Berkas biner ini belum dapat dibaca. Konversikan ke teks atau PDF.' };
    }
    if (file.size === 0) {
        return { valid: false, error: `Berkas "${file.name}" kosong.` };
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

function decodeXmlEntities(str) {
    if (!str) return '';
    let result = str
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");
    
    // Decode numeric decimal entities: &#123;
    result = result.replace(/&#(\d+);/g, (match, dec) => {
        try {
            const code = parseInt(dec, 10);
            if (code >= 0 && code <= 0x10FFFF) {
                return String.fromCodePoint(code);
            }
        } catch (e) {}
        return match;
    });
    
    // Decode numeric hex entities: &#x1F; or &#x1f;
    result = result.replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => {
        try {
            const code = parseInt(hex, 16);
            if (code >= 0 && code <= 0x10FFFF) {
                return String.fromCodePoint(code);
            }
        } catch (e) {}
        return match;
    });
    
    return result;
}

function limitText(text) {
    const limit = 200000;
    return text.length > limit ? text.slice(0, limit) + '\n[Isi dipotong pada 200.000 karakter.]' : text;
}
function validateArchive(zip) {
    const entries = Object.values(zip.files);
    const total = entries.reduce((sum, entry) => sum + (entry._data?.uncompressedSize || 0), 0);
    if (entries.length > 2000 || total > 40 * 1024 * 1024) throw new Error('Arsip melebihi batas ekstraksi (2.000 entri / 40 MB).');
}

async function extractPptx(file, sizeFormatted) {
    let textContent = '';
    let slideCount = 0;
    const pageImages = [];

    if (!window.JSZip) {
        return {
            textContent: `[Presentasi PowerPoint: ${file.name} (${sizeFormatted})]`,
            slideCount: 0,
            pageImages: []
        };
    }

    try {
        const buffer = await file.arrayBuffer();
        const zip = await window.JSZip.loadAsync(buffer);
        validateArchive(zip);

        const slideEntries = [];
        zip.forEach((relPath) => {
            const match = relPath.match(/^ppt\/slides\/slide(\d+)\.xml$/i);
            if (match) {
                slideEntries.push({ path: relPath, num: parseInt(match[1], 10) });
            }
        });

        slideEntries.sort((a, b) => a.num - b.num);
        slideCount = slideEntries.length;

        let combinedSlidesText = '';
        let totalChars = 0;

        for (const s of slideEntries) {
            const xml = await zip.file(s.path).async('string');

            const paragraphs = [];
            const pRegex = /<(?:[a-zA-Z0-9_]+:)?p(?:\s[^>]*)?>([\s\S]*?)<\/(?:[a-zA-Z0-9_]+:)?p>/gi;
            let pMatch;
            while ((pMatch = pRegex.exec(xml)) !== null) {
                const pContent = pMatch[1];
                const tRegex = /<(?:[a-zA-Z0-9_]+:)?t(?:\s[^>]*)?>([^<]*)<\/(?:[a-zA-Z0-9_]+:)?t>/gi;
                let tMatch;
                let lineText = '';
                while ((tMatch = tRegex.exec(pContent)) !== null) {
                    lineText += tMatch[1];
                }
                const cleanLine = decodeXmlEntities(lineText).trim();
                if (cleanLine) {
                    paragraphs.push(cleanLine);
                    totalChars += cleanLine.length;
                }
            }

            let notesText = '';
            const notesFile = zip.file(`ppt/notesSlides/notesSlide${s.num}.xml`);
            if (notesFile) {
                try {
                    const notesXml = await notesFile.async('string');
                    const nRegex = /<(?:[a-zA-Z0-9_]+:)?t(?:\s[^>]*)?>([^<]*)<\/(?:[a-zA-Z0-9_]+:)?t>/gi;
                    let nMatch;
                    let nLine = '';
                    while ((nMatch = nRegex.exec(notesXml)) !== null) {
                        nLine += ' ' + nMatch[1];
                    }
                    notesText = decodeXmlEntities(nLine).trim();
                } catch (_) {}
            }

            if (paragraphs.length > 0 || notesText) {
                combinedSlidesText += `--- Slide ${s.num} ---\n`;
                if (paragraphs.length > 0) {
                    combinedSlidesText += paragraphs.join('\n') + '\n';
                }
                if (notesText) {
                    combinedSlidesText += `[Catatan Pembicara: ${notesText}]\n`;
                }
                combinedSlidesText += '\n';
            }
        }

        // Jika teks sedikit atau slide berbentuk gambar/infografis, ekstrak gambar media dari zip
        if (totalChars < 120 || (slideCount > 0 && totalChars / slideCount < 20)) {
            const mediaFiles = [];
            zip.forEach((relPath) => {
                if (relPath.startsWith('ppt/media/') && /\.(png|jpe?g|webp)$/i.test(relPath)) {
                    mediaFiles.push(relPath);
                }
            });
            for (let i = 0; i < Math.min(mediaFiles.length, 12); i++) {
                try {
                    const mediaPath = mediaFiles[i];
                    const ext = mediaPath.split('.').pop().toLowerCase();
                    const mime = ext === 'png' ? 'image/png' : (ext === 'webp' ? 'image/webp' : 'image/jpeg');
                    const b64 = await zip.file(mediaPath).async('base64');
                    pageImages.push(`data:${mime};base64,${b64}`);
                } catch (_) {}
            }
        }

        textContent = combinedSlidesText || `[Presentasi PowerPoint: ${file.name} (${slideCount} slide)]`;
    } catch (err) {
        textContent = `[Gagal mengekstrak presentasi PowerPoint: ${err.message}]`;
    }

    return { textContent, slideCount, pageImages };
}

async function extractDocx(file, sizeFormatted) {
    let textContent = '';
    if (!window.JSZip) {
        return { textContent: `[Dokumen Word: ${file.name} (${sizeFormatted})]` };
    }

    try {
        const buffer = await file.arrayBuffer();
        const zip = await window.JSZip.loadAsync(buffer);
        validateArchive(zip);
        const docFile = zip.file('word/document.xml');
        if (!docFile) {
            return { textContent: `[Dokumen Word ${file.name} tidak memiliki struktur XML standar]` };
        }

        const xml = await docFile.async('string');
        const paragraphs = [];
        const pRegex = /<(?:[a-zA-Z0-9_]+:)?p(?:\s[^>]*)?>([\s\S]*?)<\/(?:[a-zA-Z0-9_]+:)?p>/gi;
        let pMatch;
        while ((pMatch = pRegex.exec(xml)) !== null) {
            const pContent = pMatch[1];
            const tRegex = /<(?:[a-zA-Z0-9_]+:)?t(?:\s[^>]*)?>([^<]*)<\/(?:[a-zA-Z0-9_]+:)?t>/gi;
            let tMatch;
            let lineText = '';
            while ((tMatch = tRegex.exec(pContent)) !== null) {
                lineText += tMatch[1];
            }
            const clean = decodeXmlEntities(lineText).trim();
            if (clean) paragraphs.push(clean);
        }

        textContent = paragraphs.join('\n\n');
    } catch (err) {
        textContent = `[Gagal mengekstrak dokumen Word: ${err.message}]`;
    }

    return { textContent };
}

async function extractXlsx(file) {
    const zip = await window.JSZip.loadAsync(await file.arrayBuffer());
    validateArchive(zip);
    const parse = xml => new DOMParser().parseFromString(xml, 'application/xml');
    const text = node => [...node.getElementsByTagName('t')].map(el => el.textContent).join('');
    const sharedFile = zip.file('xl/sharedStrings.xml');
    const shared = sharedFile ? [...parse(await sharedFile.async('string')).getElementsByTagName('si')].map(text) : [];
    const sheetFiles = Object.keys(zip.files).filter(path => /^xl\/worksheets\/sheet\d+\.xml$/i.test(path)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const blocks = [];
    for (const [index, path] of sheetFiles.slice(0, 3).entries()) {
        const doc = parse(await zip.file(path).async('string'));
        const lines = [];
        for (const row of [...doc.getElementsByTagName('row')].slice(0, 100)) {
            const cells = [];
            for (const cell of row.getElementsByTagName('c')) {
                const address = cell.getAttribute('r') || '';
                const column = [...address.replace(/\d+/g, '')].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
                if (column < 0 || column > 255) continue;
                const type = cell.getAttribute('t');
                const value = cell.getElementsByTagName('v')[0]?.textContent || '';
                cells[column] = type === 's' ? shared[Number(value)] || '' : type === 'inlineStr' ? text(cell) : value;
            }
            if (cells.some(Boolean)) lines.push(Array.from({ length: cells.length }, (_, i) => cells[i] || '').join(' | '));
        }
        blocks.push(`--- Sheet ${index + 1} ---\n${lines.join('\n')}`);
    }
    if (sheetFiles.length > 3) blocks.push('[Dibatasi pada 3 sheet pertama dan 100 baris per sheet.]');
    return { textContent: limitText(blocks.join('\n\n')) };
}

async function extractPdf(file, sizeFormatted) {
    let textContent = '';
    let pageCount = 0;
    const pageImages = [];
    let pdf;
    let loadingTask;

    if (!window.pdfjsLib) {
        return {
            textContent: `[Dokumen PDF: ${file.name} (${sizeFormatted})]`,
            pageCount: 0,
            pageImages: []
        };
    }

    // Resource limits
    const MAX_PAGES_TEXT = 30;
    const MAX_PAGES_RENDER = 8;
    const MAX_RENDER_SCALE = 1.6;
    const MAX_RENDER_WIDTH = 2000;
    const MAX_RENDER_HEIGHT = 2800;
    const MAX_TEXT_CHARS = 500000;
    const MAX_PAGE_IMAGES = 8;

    try {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('../../vendor/pdf.worker.min.mjs', import.meta.url).href;
        const buffer = await file.arrayBuffer();

        loadingTask = window.pdfjsLib.getDocument({
            data: buffer,
            cMapUrl: new URL('../../vendor/cmaps/', import.meta.url).href,
            cMapPacked: true,
            standardFontDataUrl: new URL('../../vendor/standard_fonts/', import.meta.url).href,
            wasmUrl: new URL('../../vendor/wasm/', import.meta.url).href,
            iccUrl: new URL('../../vendor/iccs/', import.meta.url).href,
            isEvalSupported: false
        });

        pdf = await loadingTask.promise;
        pageCount = pdf.numPages;
        const maxPages = Math.min(pdf.numPages, MAX_PAGES_TEXT);

        let totalTextChars = 0;
        const pageTextMap = [];

        for (let i = 1; i <= maxPages; i++) {
            if (totalTextChars >= MAX_TEXT_CHARS) break;
            try {
                const page = await pdf.getPage(i);
                const tc = await page.getTextContent();
                const pageStr = tc.items.map(x => x.str).join(' ').replace(/\s+/g, ' ').trim();
                totalTextChars += pageStr.length;
                pageTextMap.push({ pageNum: i, text: pageStr });
            } catch (pageErr) {
                pageTextMap.push({ pageNum: i, text: '' });
            }
        }

        const pagesWithText = pageTextMap.filter(p => p.text && p.text.length > 5);

        const isImageBasedPdf = totalTextChars < 120 || (maxPages > 1 && (totalTextChars / maxPages) < 25);
        if (isImageBasedPdf) {
            const renderLimit = Math.min(pdf.numPages, MAX_PAGES_RENDER);
            for (let i = 1; i <= renderLimit; i++) {
                if (pageImages.length >= MAX_PAGE_IMAGES) break;
                try {
                    const page = await pdf.getPage(i);
                    const viewport = page.getViewport({ scale: MAX_RENDER_SCALE });
                    // Limit canvas dimensions
                    const clampedWidth = Math.min(viewport.width, MAX_RENDER_WIDTH);
                    const clampedHeight = Math.min(viewport.height, MAX_RENDER_HEIGHT);
                    const canvas = document.createElement('canvas');
                    canvas.width = clampedWidth;
                    canvas.height = clampedHeight;
                    const ctx = canvas.getContext('2d');
                    // Scale to fit within limits
                    const scaleX = clampedWidth / viewport.width;
                    const scaleY = clampedHeight / viewport.height;
                    const scale = Math.min(scaleX, scaleY);
                    const scaledViewport = page.getViewport({ scale: MAX_RENDER_SCALE * scale });
                    await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                    pageImages.push(dataUrl);
                    // Clean up canvas
                    canvas.width = 0;
                    canvas.height = 0;
                } catch (renderErr) {
                    console.warn(`Gagal merender halaman PDF ${i} ke gambar:`, renderErr);
                }
            }

            textContent = `[Materi Dokumen PDF: ${file.name} (${pageCount} Halaman)]\n` +
                `Hanya ${pageImages.length} halaman pertama yang dapat dirender menjadi gambar beresolusi tinggi pada pesan ini karena keterbatasan teknis. ` +
                `Baca dan analisis halaman-halaman yang dilampirkan secara visual.\n`;
            if (pagesWithText.length > 0) {
                textContent += `\nEkstrak Teks Terdeteksi:\n` + pagesWithText.map(p => `--- Halaman ${p.pageNum} ---\n${p.text}`).join('\n\n');
            }
        } else {
            textContent = pagesWithText.map(p => `--- Halaman ${p.pageNum} ---\n${p.text}`).join('\n\n');
            if (pdf.numPages > MAX_PAGES_TEXT) {
                textContent += `\n\n[Catatan: Dokumen memiliki ${pdf.numPages} halaman, ${MAX_PAGES_TEXT} halaman pertama diekstrak]\n`;
            }
        }
    } catch (e) {
        throw new Error(`Gagal membaca PDF: ${e.message}`);
    } finally {
        await loadingTask?.destroy();
    }

    return { textContent, pageCount, pageImages };
}

export async function processFile(file) {
    const validation = validateFile(file);
    if (!validation.valid) throw new Error(validation.error);
    const category = getFileCategory(file);
    if (['presentation', 'document', 'spreadsheet', 'zip'].includes(category) && !/\.(csv|tsv)$/i.test(file.name)) await ensureZip();
    if (category === 'pdf') await ensurePdf();
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

    if (category === 'presentation') {
        const { textContent, slideCount, pageImages } = await extractPptx(file, sizeFormatted);
        return {
            id,
            name: file.name,
            type: file.type || 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            category: 'presentation',
            size: file.size,
            sizeFormatted,
            textContent,
            slideCount,
            pageImages,
            ext
        };
    }

    if (category === 'document') {
        const { textContent } = await extractDocx(file, sizeFormatted);
        return {
            id,
            name: file.name,
            type: file.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            category: 'document',
            size: file.size,
            sizeFormatted,
            textContent,
            ext
        };
    }

    if (category === 'spreadsheet') {
        if (ext === 'csv' || ext === 'tsv') {
            try {
                const textContent = await file.text();
                return {
                    id,
                    name: file.name,
                    type: file.type || 'text/csv',
                    category: 'spreadsheet',
                    size: file.size,
                    sizeFormatted,
                    textContent: limitText(textContent),
                    ext
                };
            } catch (_) {}
        }
        const { textContent } = await extractXlsx(file, sizeFormatted);
        return {
            id,
            name: file.name,
            type: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            category: 'spreadsheet',
            size: file.size,
            sizeFormatted,
            textContent,
            ext
        };
    }

    if (category === 'pdf') {
        const { textContent, pageCount, pageImages } = await extractPdf(file, sizeFormatted);
        return {
            id,
            name: file.name,
            type: 'application/pdf',
            category: 'pdf',
            size: file.size,
            sizeFormatted,
            textContent,
            pageCount,
            pageImages,
            ext
        };
    }

    if (category === 'zip') {
        let textContent = '';
        try {
            if (window.JSZip) {
                const zip = await window.JSZip.loadAsync(file);
                validateArchive(zip);
                let tree = `Struktur Berkas Arsip ZIP (${file.name}):\n`;
                const textEntries = [];
                let entryCount = 0;
                const MAX_ENTRIES = 50;
                const MAX_TEXT_ENTRIES = 15;
                const MAX_ENTRY_SIZE = 40000;
                let totalDecompressed = 0;
                const MAX_TOTAL_DECOMPRESSED = 5 * 1024 * 1024; // 5MB

                zip.forEach((path, entry) => {
                    entryCount++;
                    if (!entry.dir && entryCount <= MAX_ENTRIES) {
                        tree += `- ${path}\n`;
                        const fext = path.split('.').pop().toLowerCase();
                        const isTextLike = ['txt', 'md', 'json', 'js', 'ts', 'py', 'html', 'css', 'csv', 'yaml', 'yml', 'xml', 'sql', 'sh', 'c', 'cpp', 'rs', 'go', 'php'].includes(fext);
                        if (isTextLike && textEntries.length < MAX_TEXT_ENTRIES) {
                            textEntries.push({ path, entry });
                        }
                    }
                });

                if (entryCount > MAX_ENTRIES) {
                    tree += `\n[Catatan: Arsip memiliki ${entryCount} entri, hanya ${MAX_ENTRIES} pertama yang ditampilkan]\n`;
                }

                for (const item of textEntries) {
                    try {
                        if (totalDecompressed >= MAX_TOTAL_DECOMPRESSED) break;
                        const str = await item.entry.async('string');
                        totalDecompressed += str.length;
                        if (str.length < MAX_ENTRY_SIZE) {
                            tree += `\n--- Berkas: ${item.path} ---\n${str}\n`;
                        } else {
                            tree += `\n--- Berkas: ${item.path} --- [Terlalu panjang, ditampilkan ${MAX_ENTRY_SIZE} karakter pertama]\n${str.slice(0, MAX_ENTRY_SIZE)}...\n`;
                        }
                    } catch (e) {}
                }
                textContent = tree;
            } else {
                textContent = `[Arsip ZIP: ${file.name} (${sizeFormatted})]`;
            }
        } catch (e) {
            if (e.message && e.message.includes('corrupt')) {
                textContent = `[Arsip ZIP: ${file.name} - Berkas rusak atau corrupt]`;
            } else {
                textContent = `[Arsip ZIP: ${file.name} - Gagal mengekstrak: ${e.message}]`;
            }
        }

        return {
            id,
            name: file.name,
            type: 'application/zip',
            category: 'zip',
            size: file.size,
            sizeFormatted,
            textContent,
            ext
        };
    }

    // Default: text, code, markdown, json, etc.
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
        textContent: limitText(textContent),
        ext
    };
}
