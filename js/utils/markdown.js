export function parseMarkdown(text) {
    if (!text) return '';
    marked.setOptions({
        breaks: true,
        gfm: true
    });
    const rawHtml = marked.parse(text);
    return DOMPurify.sanitize(rawHtml);
}