import { copyToClipboard } from '../utils/clipboard.js';
import { downloadTextAsFile, inferFilenameFromBlock, exportMessageAsFile } from '../services/file-generator.js';
import { showToast } from '../utils/toast.js';
import { t } from '../services/i18n.js';

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
                <button class="code-download-btn" aria-label="Download File" title="Download ${filename}">
                    <i data-lucide="download"></i>
                    <span class="copy-label">Download File</span>
                </button>
                <button class="code-copy-btn" aria-label="Salin Kode" title="Salin kode">
                    <i data-lucide="copy"></i>
                    <span class="copy-label">Salin</span>
                </button>
            </div>
        `;

        // Action: Download File
        const downloadBtn = header.querySelector('.code-download-btn');
        downloadBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const codeText = code ? (code.innerText || code.textContent || '') : pre.innerText;
            downloadTextAsFile(filename, codeText);
            showToast(`File ${filename} berhasil didownload`, 'success');

            downloadBtn.classList.add('copied');
            downloadBtn.innerHTML = '<i data-lucide="check"></i><span class="copy-label">Tersimpan!</span>';
            if (typeof lucide !== 'undefined') lucide.createIcons({ attrs: { 'stroke-width': '1.5' } });
            setTimeout(() => {
                downloadBtn.classList.remove('copied');
                downloadBtn.innerHTML = '<i data-lucide="download"></i><span class="copy-label">Download File</span>';
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

    // Tombol Download Format (.md)
    const exportBtn = document.createElement('button');
    exportBtn.className = 'icon-button export-icon-btn';
    exportBtn.setAttribute('aria-label', 'Download (.md)');
    exportBtn.title = 'Download format Markdown (.md)';
    exportBtn.innerHTML = '<i data-lucide="file-down"></i>';

    exportBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const clone = contentElement.cloneNode(true);
        clone.querySelectorAll('.code-block-header').forEach(h => h.remove());
        const plainText = clone.innerText || clone.textContent || '';
        exportMessageAsFile(plainText, 'md', 'jawaban_ai');
        showToast('File .md berhasil didownload', 'success');
    });

    actions.appendChild(copyBtn);
    actions.appendChild(exportBtn);
    wrapper.appendChild(actions);
}

let editMessageCallback = null;

export function setEditMessageCallback(callback) {
    editMessageCallback = callback;
}

export function appendUserActions(wrapper, contentElement, msg) {
    const actions = document.createElement('div');
    actions.className = 'user-actions';

    // Tombol Edit Prompt
    const editBtn = document.createElement('button');
    editBtn.className = 'icon-button user-action-btn user-edit-btn';
    editBtn.setAttribute('aria-label', t('edit'));
    editBtn.title = t('edit_prompt_title');
    editBtn.innerHTML = '<i data-lucide="pencil"></i>';

    // Tombol Salin
    const copyBtn = document.createElement('button');
    copyBtn.className = 'icon-button user-action-btn user-copy-btn';
    copyBtn.setAttribute('aria-label', t('copy'));
    copyBtn.title = t('copy');
    copyBtn.innerHTML = '<i data-lucide="copy"></i>';

    copyBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const success = await copyToClipboard(msg.content);
        if (success) {
            copyBtn.innerHTML = '<i data-lucide="check"></i>';
            if (typeof lucide !== 'undefined') lucide.createIcons({ attrs: { 'stroke-width': '1.5' } });
            setTimeout(() => {
                copyBtn.innerHTML = '<i data-lucide="copy"></i>';
                if (typeof lucide !== 'undefined') lucide.createIcons({ attrs: { 'stroke-width': '1.5' } });
            }, 1800);
        }
    });

    // Kontainer Edit Inline
    const editContainer = document.createElement('div');
    editContainer.className = 'user-edit-box hidden';
    editContainer.innerHTML = `
        <textarea class="user-edit-textarea" rows="2" aria-label="${t('edit')}"></textarea>
        <div class="user-edit-toolbar">
            <button class="user-edit-btn btn-cancel-edit" type="button">${t('cancel')}</button>
            <button class="user-edit-btn btn-submit-edit primary" type="button">
                <i data-lucide="send"></i>
                <span>${t('send_and_respond')}</span>
            </button>
        </div>
    `;

    const textarea = editContainer.querySelector('.user-edit-textarea');
    const cancelBtn = editContainer.querySelector('.btn-cancel-edit');
    const submitBtn = editContainer.querySelector('.btn-submit-edit');

    const autoResize = () => {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(Math.max(textarea.scrollHeight, 52), 240) + 'px';
    };

    textarea.addEventListener('input', autoResize);

    const closeEditMode = () => {
        editContainer.classList.add('hidden');
        contentElement.classList.remove('hidden');
        actions.classList.remove('hidden');
    };

    const openEditMode = () => {
        contentElement.classList.add('hidden');
        actions.classList.add('hidden');
        editContainer.classList.remove('hidden');
        textarea.value = msg.content;
        autoResize();
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
        if (typeof lucide !== 'undefined') lucide.createIcons({ attrs: { 'stroke-width': '1.5' } });
    };

    const submitEdit = () => {
        const newText = textarea.value.trim();
        if (!newText) {
            showToast(t('prompt_empty_warning'), 'error');
            return;
        }
        closeEditMode();
        if (typeof editMessageCallback === 'function') {
            editMessageCallback(msg.id, newText);
        }
    };

    editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openEditMode();
    });

    cancelBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeEditMode();
    });

    submitBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        submitEdit();
    });

    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submitEdit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            closeEditMode();
        }
    });

    actions.appendChild(editBtn);
    actions.appendChild(copyBtn);
    wrapper.appendChild(actions);
    wrapper.appendChild(editContainer);
}
