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
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
        return { valid: false, error: `Berkas "${file.name}" terlalu besar (maksimal 50MB).` };
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
    return str
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");
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
            const pRegex = /<[a-zA-Z0-9_:]*p[\s>]([\s\S]*?)<\/[a-zA-Z0-9_:]*p>/gi;
            let pMatch;
            while ((pMatch = pRegex.exec(xml)) !== null) {
                const pContent = pMatch[1];
                const tRegex = /<[a-zA-Z0-9_:]*t[\s>]([^<]*)<\/[a-zA-Z0-9_:]*t>/gi;
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
                    const nRegex = /<[a-zA-Z0-9_:]*t[\s>]([^<]*)<\/[a-zA-Z0-9_:]*t>/gi;
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
        const docFile = zip.file('word/document.xml');
        if (!docFile) {
            return { textContent: `[Dokumen Word ${file.name} tidak memiliki struktur XML standar]` };
        }

        const xml = await docFile.async('string');
        const paragraphs = [];
        const pRegex = /<[a-zA-Z0-9_:]*p[\s>]([\s\S]*?)<\/[a-zA-Z0-9_:]*p>/gi;
        let pMatch;
        while ((pMatch = pRegex.exec(xml)) !== null) {
            const pContent = pMatch[1];
            const tRegex = /<[a-zA-Z0-9_:]*t[\s>]([^<]*)<\/[a-zA-Z0-9_:]*t>/gi;
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

async function extractXlsx(file, sizeFormatted) {
    let textContent = '';
    if (!window.JSZip) {
        return { textContent: `[Berkas Spreadsheet: ${file.name} (${sizeFormatted})]` };
    }

    try {
        const buffer = await file.arrayBuffer();
        const zip = await window.JSZip.loadAsync(buffer);

        const sharedStrings = [];
        const ssFile = zip.file('xl/sharedStrings.xml');
        if (ssFile) {
            const ssXml = await ssFile.async('string');
            const siRegex = /<si>([\s\S]*?)<\/si>/gi;
            let siMatch;
            while ((siMatch = siRegex.exec(ssXml)) !== null) {
                const tRegex = /<t[^>]*>([^<]*)<\/t>/gi;
                let tMatch;
                let sText = '';
                while ((tMatch = tRegex.exec(siMatch[1])) !== null) {
                    sText += tMatch[1];
                }
                sharedStrings.push(decodeXmlEntities(sText));
            }
        }

        const sheetFiles = [];
        zip.forEach((relPath) => {
            if (/^xl\/worksheets\/sheet\d+\.xml$/i.test(relPath)) {
                sheetFiles.push(relPath);
            }
        });

        let fullSheetsText = '';
        for (let sIdx = 0; sIdx < Math.min(sheetFiles.length, 3); sIdx++) {
            const sPath = sheetFiles[sIdx];
            const sheetXml = await zip.file(sPath).async('string');
            fullSheetsText += `--- Sheet ${sIdx + 1} ---\n`;

            const rowRegex = /<row[^>]*>([\s\S]*?)<\/row>/gi;
            let rowMatch;
            let rowCount = 0;
            while ((rowMatch = rowRegex.exec(sheetXml)) !== null && rowCount < 100) {
                rowCount++;
                const cRegex = /<c\s+r="([A-Z0-9]+)"(?:\s+t="([a-z]+)")?[^>]*>(?:<v>([^<]*)<\/v>)?/gi;
                let cMatch;
                const rowCells = [];
                while ((cMatch = cRegex.exec(rowMatch[1])) !== null) {
                    const type = cMatch[2];
                    const val = cMatch[3] || '';
                    if (type === 's') {
                        const sNum = parseInt(val, 10);
                        rowCells.push(sharedStrings[sNum] || '');
                    } else {
                        rowCells.push(decodeXmlEntities(val));
                    }
                }
                if (rowCells.some(c => c.trim())) {
                    fullSheetsText += rowCells.join(' | ') + '\n';
                }
            }
            fullSheetsText += '\n';
        }

        textContent = fullSheetsText;
    } catch (err) {
        textContent = `[Gagal mengekstrak berkas Excel: ${err.message}]`;
    }

    return { textContent };
}

async function extractPdf(file, sizeFormatted) {
    let textContent = '';
    let pageCount = 0;
    const pageImages = [];

    if (!window.pdfjsLib) {
        return {
            textContent: `[Dokumen PDF: ${file.name} (${sizeFormatted})]`,
            pageCount: 0,
            pageImages: []
        };
    }

    try {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        const buffer = await file.arrayBuffer();

        // Dukungan font CJK / CID / custom kuliah via cMapUrl & standardFontDataUrl
        const loadingTask = window.pdfjsLib.getDocument({
            data: buffer,
            cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
            cMapPacked: true,
            standardFontDataUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/standard_fonts/'
        });

        const pdf = await loadingTask.promise;
        pageCount = pdf.numPages;
        const maxPages = Math.min(pdf.numPages, 30);

        let totalTextChars = 0;
        const pageTextMap = [];

        for (let i = 1; i <= maxPages; i++) {
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

        // Jika teks digital kosong atau sangat sedikit (scanned document atau slide presentasi gambar),
        // otomatis render halaman ke canvas gambar beresolusi tinggi agar model AI vision dapat membacanya langsung!
        // Pembagi menggunakan maxPages, bukan pageCount, agar PDF panjang dengan teks digital
        // tidak salah diklasifikasikan sebagai scanned.
        const isImageBasedPdf = totalTextChars < 120 || (maxPages > 1 && (totalTextChars / maxPages) < 25);
        if (isImageBasedPdf) {
            const renderLimit = Math.min(pdf.numPages, 25);
            for (let i = 1; i <= renderLimit; i++) {
                try {
                    const page = await pdf.getPage(i);
                    const viewport = page.getViewport({ scale: 1.6 });
                    const canvas = document.createElement('canvas');
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;
                    const ctx = canvas.getContext('2d');
                    await page.render({ canvasContext: ctx, viewport }).promise;
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                    pageImages.push(dataUrl);
                } catch (renderErr) {
                    console.warn(`Gagal merender halaman PDF ${i} ke gambar:`, renderErr);
                }
            }

            textContent = `[Materi Dokumen PDF: ${file.name} (${pageCount} Halaman)]\n` +
                `Hanya ${renderLimit} halaman pertama yang dapat dirender menjadi gambar beresolusi tinggi pada pesan ini karena keterbatasan teknis. ` +
                `Baca dan analisis halaman-halaman yang dilampirkan secara visual.\n`;
            if (pagesWithText.length > 0) {
                textContent += `\nEkstrak Teks Terdeteksi:\n` + pagesWithText.map(p => `--- Halaman ${p.pageNum} ---\n${p.text}`).join('\n\n');
            }
        } else {
            textContent = pagesWithText.map(p => `--- Halaman ${p.pageNum} ---\n${p.text}`).join('\n\n');
            if (pdf.numPages > 30) {
                textContent += `\n\n[Catatan: Dokumen memiliki ${pdf.numPages} halaman, 30 halaman pertama diekstrak]\n`;
            }
        }
    } catch (e) {
        textContent = `[Dokumen PDF: ${file.name} - Gagal ekstraksi: ${e.message}]`;
    }

    return { textContent, pageCount, pageImages };
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
                    textContent,
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
        textContent,
        ext
    };
}
