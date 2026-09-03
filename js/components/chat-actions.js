import { copyToClipboard } from '../utils/clipboard.js';

export function enhanceCodeBlocks(container) {
    const preElements = container.querySelectorAll('pre');
    preElements.forEach(pre => {
        if (pre.parentElement?.classList.contains('code-block-content')) return;

        const code = pre.querySelector('code');
        let lang = 'CODE';
        if (code && code.className) {
            const match = code.className.match(/language-([a-zA-Z0-9_-]+)/);
            if (match && match[1]) lang = match[1].toUpperCase();
        }

        const card = document.createElement('div');
        card.className = 'code-block-card';

        const header = document.createElement('div');
        header.className = 'code-block-header';
        header.innerHTML = `
            <div class="code-lang-wrapper">
                <i data-lucide="terminal" class="code-terminal-icon"></i>
                <span class="code-lang">${lang}</span>
            </div>
            <button class="code-copy-btn" aria-label="Salin Kode" title="Salin kode">
                <i data-lucide="copy"></i>
                <span class="copy-label">Salin</span>
            </button>
        `;

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

    const copyBtn = document.createElement('button');
    copyBtn.className = 'icon-button copy-icon-btn';
    copyBtn.setAttribute('aria-label', 'Salin pesan');
    copyBtn.title = 'Salin pesan';
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
            // Quiet fallback
        }
    });

    actions.appendChild(copyBtn);
    wrapper.appendChild(actions);
}
