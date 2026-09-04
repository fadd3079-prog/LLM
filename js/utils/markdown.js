export function parseMarkdown(text) {
    if (!text) return '';
    marked.setOptions({
        breaks: true,
        gfm: true
    });
    // Support ==text== highlight syntax (similar to Obsidian, Bear, and MS Word highlighting)
    const withHighlights = text.replace(/==([^=\r\n]+)==/g, '<mark>$1</mark>');
    const rawHtml = marked.parse(withHighlights);
    return DOMPurify.sanitize(rawHtml, {
        ADD_TAGS: ['mark']
    });
}