export function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
let configured = false;
export function parseMarkdown(text) {
    if (!text) return '';
    // Fail closed if either local dependency failed to load.
    if (!globalThis.marked || !globalThis.DOMPurify) return `<pre>${escapeHTML(text)}</pre>`;
    if (!configured) {
        const renderer = new marked.Renderer();
        renderer.link = function(token) {
            const href = /^(https?:\/\/|mailto:|tel:|#)/i.test(token.href || '') ? token.href : '#';
            const label = token.tokens ? this.parser.parseInline(token.tokens) : escapeHTML(token.text || href);
            return `<a href="${escapeHTML(href)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
        };
        marked.use({ breaks: true, gfm: true, renderer });
        DOMPurify.addHook('afterSanitizeAttributes', node => {
            if (node.tagName === 'A') { node.setAttribute('target', '_blank'); node.setAttribute('rel', 'noopener noreferrer'); }
        });
        configured = true;
    }
    return DOMPurify.sanitize(marked.parse(String(text)), {
        FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select'],
        FORBID_ATTR: ['style', 'id', 'name'],
        ADD_ATTR: ['target', 'rel']
    });
}
