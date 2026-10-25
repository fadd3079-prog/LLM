import { animateElement, motionAllowed, settleAnimations } from './motion.js';

const textHosts = new WeakSet();

function canReveal(parent) {
    return motionAllowed() && !parent.closest('pre, code, svg');
}

function appendInk(host, value) {
    if (!value) return;
    if (!canReveal(host) || value.length > 2400) { host.append(document.createTextNode(value)); host.normalize(); return; }
    const run = document.createElement('span');
    run.className = 'stream-ink';
    run.textContent = value;
    host.append(run);
    const animation = animateElement(run, [{ opacity: 0.25 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' });
    const cleanup = () => {
        if (!run.parentNode) return;
        const parent = run.parentNode;
        run.replaceWith(document.createTextNode(run.textContent));
        parent.normalize();
    };
    if (animation) animation.finished.then(cleanup, cleanup);
    else cleanup();
}

function materialize(fresh, parent) {
    if (fresh.nodeType === Node.TEXT_NODE) {
        if (!fresh.textContent.trim() || !canReveal(parent)) return fresh.cloneNode();
        const host = document.createElement('span');
        host.dataset.streamText = '';
        textHosts.add(host);
        appendInk(host, fresh.textContent);
        return host;
    }
    const node = fresh.cloneNode(false);
    for (const child of fresh.childNodes) node.append(materialize(child, node));
    return node;
}

function equivalent(current, fresh) {
    if (fresh.nodeType === Node.TEXT_NODE) return current.nodeType === Node.TEXT_NODE || textHosts.has(current);
    return current.nodeType === fresh.nodeType && current.nodeName === fresh.nodeName;
}

function reconcile(parent, freshParent, topLevel = false) {
    const oldChildren = [...parent.childNodes];
    const freshChildren = [...freshParent.childNodes];
    freshChildren.forEach((fresh, index) => {
        let current = oldChildren[index];
        if (!current || !equivalent(current, fresh)) {
            const node = materialize(fresh, parent);
            if (current) current.replaceWith(node);
            else parent.append(node);
            if (topLevel && node.nodeType === Node.ELEMENT_NODE) {
                animateElement(node, [{ opacity: 0.5, transform: 'translateY(4px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 220 });
            }
            return;
        }
        if (fresh.nodeType === Node.TEXT_NODE) {
            const previous = current.textContent;
            if (previous === fresh.textContent) return;
            if (fresh.textContent.startsWith(previous)) {
                const added = fresh.textContent.slice(previous.length);
                if (textHosts.has(current)) appendInk(current, added);
                else if (canReveal(parent) && fresh.textContent.trim()) {
                    const host = document.createElement('span');
                    host.dataset.streamText = '';
                    textHosts.add(host);
                    current.replaceWith(host);
                    host.append(current);
                    appendInk(host, added);
                } else current.appendData(added);
            } else current.textContent = fresh.textContent;
            return;
        }
        if (fresh.nodeType !== Node.ELEMENT_NODE) return;
        // Keep a reader's open/closed reasoning panel while its content streams.
        for (const attribute of [...current.attributes]) {
            if (current.tagName === 'DETAILS' && attribute.name === 'open') continue;
            if (!fresh.hasAttribute(attribute.name)) current.removeAttribute(attribute.name);
        }
        for (const attribute of fresh.attributes) {
            if (current.tagName === 'DETAILS' && attribute.name === 'open') continue;
            if (current.getAttribute(attribute.name) !== attribute.value) current.setAttribute(attribute.name, attribute.value);
        }
        reconcile(current, fresh);
    });
    oldChildren.slice(freshChildren.length).forEach(node => node.remove());
}

// html must come from parseMarkdown's sanitizer. Reuse nodes rather than replacing
// the whole response on every network event; only appended text receives a fade.
export function reconcileStreamHTML(container, html) {
    const template = document.createElement('template');
    template.innerHTML = html;
    template.content.querySelectorAll('table').forEach(table => {
        const wrapper = document.createElement('div');
        wrapper.className = 'table-responsive-wrapper';
        table.replaceWith(wrapper);
        wrapper.append(table);
    });
    reconcile(container, template.content, true);
}

export function settleStreamHTML(container) {
    settleAnimations(container);
    container.querySelectorAll('[data-stream-text]').forEach(host => host.replaceWith(document.createTextNode(host.textContent)));
    container.normalize();
}
