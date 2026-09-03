export function $(selector, context = document) {
    return context.querySelector(selector);
}

export function $$(selector, context = document) {
    return Array.from(context.querySelectorAll(selector));
}

export function createElement(tag, { className = '', attributes = {}, innerHTML = '', textContent = '' } = {}) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (innerHTML) el.innerHTML = innerHTML;
    if (textContent) el.textContent = textContent;
    for (const [key, val] of Object.entries(attributes)) {
        el.setAttribute(key, val);
    }
    return el;
}

export function formatTime(date = new Date()) {
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}
