
export async function copyToClipboard(plainText, htmlContent = null) {
    if (!plainText && !htmlContent) return false;
    const textToCopy = plainText || (htmlContent ? extractPlainTextFromHtml(htmlContent) : '');

    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.write === 'function') {
        try {
            const clipboardData = {
                'text/plain': new Blob([textToCopy], { type: 'text/plain' })
            };
            if (htmlContent) {
                clipboardData['text/html'] = new Blob([htmlContent], { type: 'text/html' });
            }
            await navigator.clipboard.write([new ClipboardItem(clipboardData)]);
            return true;
        } catch (err) {

        }
    }

    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        try {
            await navigator.clipboard.writeText(textToCopy);
            return true;
        } catch (err) {

        }
    }

    try {
        const textarea = document.createElement('textarea');
        textarea.value = textToCopy;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '-9999px';
        textarea.style.opacity = '0';
        textarea.setAttribute('readonly', '');
        document.body.appendChild(textarea);
        textarea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
        return success;
    } catch (e) {
        return false;
    }
}

function extractPlainTextFromHtml(html) {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    return temp.innerText || temp.textContent || '';
}
