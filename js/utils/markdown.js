let isMarkedConfigured = false;

function ensureMarkedConfigured() {
    if (isMarkedConfigured) return;

    if (typeof marked !== 'undefined') {
        const renderer = new marked.Renderer();

        renderer.link = function (href, title, text) {
            let actualHref = href;
            let actualTitle = title;
            let actualText = text;

            // Dukungan kompabilitas marked modern ({ href, title, text }) dan versi legacy (href, title, text)
            if (typeof href === 'object' && href !== null) {
                actualHref = href.href;
                actualTitle = href.title;
                actualText = href.text;
            }

            const titleAttr = actualTitle ? ` title="${actualTitle}"` : '';
            return `<a href="${actualHref || '#'}"${titleAttr} target="_blank" rel="noopener noreferrer">${actualText || actualHref || ''}</a>`;
        };

        marked.use({
            breaks: true,
            gfm: true,
            renderer
        });

        isMarkedConfigured = true;
    }
}

// Hook DOMPurify agar selalu menyertakan target="_blank" & rel="noopener noreferrer" pada tag <a>
if (typeof DOMPurify !== 'undefined' && typeof DOMPurify.addHook === 'function') {
    DOMPurify.addHook('afterSanitizeAttributes', function (node) {
        if (node.tagName === 'A' && node.hasAttribute('href')) {
            node.setAttribute('target', '_blank');
            node.setAttribute('rel', 'noopener noreferrer');
        }
    });
}

export function parseMarkdown(text) {
    if (!text) return '';
    ensureMarkedConfigured();

    // Support ==text== highlight syntax (similar to Obsidian, Bear, and MS Word highlighting)
    const withHighlights = text.replace(/==([^=\r\n]+)==/g, '<mark>$1</mark>');
    const rawHtml = marked.parse(withHighlights);
    return DOMPurify.sanitize(rawHtml, {
        ADD_TAGS: ['mark'],
        ADD_ATTR: ['target', 'rel']
    });
}