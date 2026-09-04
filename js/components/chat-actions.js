import { copyToClipboard } from '../utils/clipboard.js';
import { downloadTextAsFile, inferFilenameFromBlock, exportMessageAsFile } from '../services/file-generator.js';
import { showToast } from '../utils/toast.js';

export function enhanceCodeBlocks(container) {
    const preElements = container.querySelectorAll('pre');
    preElements.forEach(pre => {
        if (pre.parentElement?.classList.contains('code-block-content')) return;

        const code = pre.querySelector('code');
        let lang = 'CODE';
        if (code && code.className) {
            const match = code.className.match(/language-([a-zA-Z0-9_.-]+)/);
            if (match && match[1]) lang = match[1];
        }

        const card = document.createElement('div');
        card.className = 'code-block-card';

        const filename = inferFilenameFromBlock(lang);

        const header = document.createElement('div');
        header.className = 'code-block-header';
        header.innerHTML = `
            <div class="code-lang-wrapper">
                <i data-lucide="file-code" class="code-terminal-icon"></i>
                <span class="code-lang" title="${filename}">${filename}</span>
            </div>
            <div class="code-actions-wrapper">
                <button class="code-download-btn" aria-label="Unduh File" title="Unduh sebagai ${filename}">
                    <i data-lucide="download"></i>
                    <span class="copy-label">Unduh File</span>
                </button>
                <button class="code-copy-btn" aria-label="Salin Kode" title="Salin kode">
                    <i data-lucide="copy"></i>
                    <span class="copy-label">Salin</span>
                </button>
            </div>
        `;

        // Action: Unduh File
        const downloadBtn = header.querySelector('.code-download-btn');
        downloadBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const codeText = code ? (code.innerText || code.textContent || '') : pre.innerText;
            downloadTextAsFile(filename, codeText);
            showToast(`File ${filename} berhasil diunduh`, 'success');

            downloadBtn.classList.add('copied');
            downloadBtn.innerHTML = '<i data-lucide="check"></i><span class="copy-label">Tersimpan!</span>';
            if (typeof lucide !== 'undefined') lucide.createIcons({ attrs: { 'stroke-width': '1.5' } });
            setTimeout(() => {
                downloadBtn.classList.remove('copied');
                downloadBtn.innerHTML = '<i data-lucide="download"></i><span class="copy-label">Unduh File</span>';
                if (typeof lucide !== 'undefined') lucide.createIcons({ attrs: { 'stroke-width': '1.5' } });
            }, 2000);
        });

        // Action: Salin Kode
        const copyBtn = header.querySelector('.code-copy-btn');
        copyBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const codeText = code ? (code.innerText || code.textContent || '') : pre.innerText;
            const success = await copyToClipboard(codeText);
            if (success) {
                copyBtn.classList.add('copied');
                copyBtn.innerHTML = '<i data-lucide="check"></i><span class="copy-label">Tersalin!</span>';
                if (typeof lucide !== 'undefined') lucide.createIcons({ attrs: { 'stroke-width': '1.5' } });
                setTimeout(() => {
                    copyBtn.classList.remove('copied');
                    copyBtn.innerHTML = '<i data-lucide="copy"></i><span class="copy-label">Salin</span>';
                    if (typeof lucide !== 'undefined') lucide.createIcons({ attrs: { 'stroke-width': '1.5' } });
                }, 2000);
            }
        });

        const contentDiv = document.createElement('div');
        contentDiv.className = 'code-block-content';

        pre.parentNode.insertBefore(card, pre);
        contentDiv.appendChild(pre);
        card.appendChild(header);
        card.appendChild(contentDiv);
    });
}

export function enhanceTables(container) {
    const tables = container.querySelectorAll('table');
    tables.forEach(table => {
        if (table.parentElement?.classList.contains('table-responsive-wrapper')) return;
        const wrapper = document.createElement('div');
        wrapper.className = 'table-responsive-wrapper';
        table.parentNode.insertBefore(wrapper, table);
        wrapper.appendChild(table);
    });
}

export function appendAssistantActions(wrapper, contentElement) {
    const actions = document.createElement('div');
    actions.className = 'assistant-actions';

    // Tombol Salin Pesan
    const copyBtn = document.createElement('button');
    copyBtn.className = 'icon-button copy-icon-btn';
    copyBtn.setAttribute('aria-label', 'Salin pesan');
    copyBtn.title = 'Salin seluruh teks jawaban';
    copyBtn.innerHTML = '<i data-lucide="copy"></i>';

    copyBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
            const clone = contentElement.cloneNode(true);
            clone.querySelectorAll('.code-block-header').forEach(h => h.remove());
            const plainText = clone.innerText || clone.textContent || '';
            const htmlContent = clone.innerHTML;

            const success = await copyToClipboard(plainText, htmlContent);
            if (success) {
                copyBtn.classList.add('copied');
                copyBtn.innerHTML = '<i data-lucide="check"></i>';
                if (typeof lucide !== 'undefined') {
                    lucide.createIcons({ attrs: { 'stroke-width': '1.5' } });
                }

                setTimeout(() => {
                    copyBtn.classList.remove('copied');
                    copyBtn.innerHTML = '<i data-lucide="copy"></i>';
                    if (typeof lucide !== 'undefined') {
                        lucide.createIcons({ attrs: { 'stroke-width': '1.5' } });
                    }
                }, 2000);
            }
        } catch (err) {
            // Fallback
        }
    });

    // Tombol Unduh Jawaban (.md)
    const exportBtn = document.createElement('button');
    exportBtn.className = 'icon-button export-icon-btn';
    exportBtn.setAttribute('aria-label', 'Unduh jawaban sebagai file Markdown');
    exportBtn.title = 'Unduh jawaban sebagai file Markdown (.md)';
    exportBtn.innerHTML = '<i data-lucide="file-down"></i>';

    exportBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const clone = contentElement.cloneNode(true);
        clone.querySelectorAll('.code-block-header').forEach(h => h.remove());
        const plainText = clone.innerText || clone.textContent || '';
        exportMessageAsFile(plainText, 'md', 'jawaban_ai');
        showToast('Jawaban berhasil diunduh sebagai file .md', 'success');
    });

    actions.appendChild(copyBtn);
    actions.appendChild(exportBtn);
    wrapper.appendChild(actions);
}
