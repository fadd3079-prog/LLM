import { parseMarkdown } from '../utils/markdown.js';
import { repairIncompleteMarkdown } from '../api/stream-parser.js';
import { formatTime } from '../utils/dom.js';
import { enhanceCodeBlocks, enhanceTables, appendAssistantActions, appendUserActions, setEditMessageCallback } from './chat-actions.js';
import { downloadImageFromUrl } from '../services/image-generator.js';

export { setEditMessageCallback };

export function enhanceImages(container) {
    const images = container.querySelectorAll('img:not(.preview-thumbnail):not(.msg-img-attachment)');
    images.forEach(img => {
        if (img.parentElement?.classList.contains('ai-image-wrapper')) return;

        const card = document.createElement('div');
        card.className = 'ai-image-card';

        const header = document.createElement('div');
        header.className = 'ai-image-header';

        const imageTag = document.createElement('div');
        imageTag.className = 'ai-image-tag';

        const sparkleIcon = document.createElement('i');
        sparkleIcon.dataset.lucide = 'sparkles';
        sparkleIcon.className = 'ai-image-sparkle';

        const imageTitle = document.createElement('span');
        imageTitle.className = 'ai-image-title';
        imageTitle.textContent = img.alt || 'Gambar Dihasilkan AI';

        imageTag.appendChild(sparkleIcon);
        imageTag.appendChild(imageTitle);

        const imageActions = document.createElement('div');
        imageActions.className = 'ai-image-actions';

        const dlBtn = document.createElement('button');
        dlBtn.className = 'ai-image-btn btn-dl-img';
        dlBtn.title = 'Download Gambar';
        dlBtn.setAttribute('aria-label', 'Download Gambar');
        dlBtn.innerHTML = '<i data-lucide="download"></i><span>Download</span>';

        const viewBtn = document.createElement('button');
        viewBtn.className = 'ai-image-btn btn-view-img';
        viewBtn.title = 'Buka Gambar (Full Size)';
        viewBtn.setAttribute('aria-label', 'Buka Gambar');
        viewBtn.innerHTML = '<i data-lucide="external-link"></i>';

        imageActions.appendChild(dlBtn);
        imageActions.appendChild(viewBtn);

        header.appendChild(imageTag);
        header.appendChild(imageActions);

        const wrapper = document.createElement('div');
        wrapper.className = 'ai-image-wrapper';

        img.parentNode.insertBefore(card, img);
        wrapper.appendChild(img);
        card.appendChild(header);
        card.appendChild(wrapper);

        dlBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            downloadImageFromUrl(img.src, `ai_gambar_${Date.now()}.jpg`);
        });

        viewBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            window.open(img.src, '_blank', 'noopener,noreferrer');
        });

        img.addEventListener('click', () => {
            window.open(img.src, '_blank', 'noopener,noreferrer');
        });
    });
}

let incomingTargetText = '';
let lastRenderTimestamp = 0;
let isStreamActive = false;
let streamAnimationId = null;
let userScrolledUp = false;


export function initChatScroll() {
    const canvas = document.getElementById('chat-canvas');
    const scrollBtn = document.getElementById('btn-scroll-bottom');
    if (!canvas || canvas.dataset.scrollTrackingAttached) return;
    canvas.dataset.scrollTrackingAttached = 'true';

    const checkScroll = () => {
        const threshold = 120;
        const distanceFromBottom = canvas.scrollHeight - canvas.scrollTop - canvas.clientHeight;
        userScrolledUp = distanceFromBottom > threshold;

        if (scrollBtn) {
            if (userScrolledUp && canvas.scrollHeight > canvas.clientHeight + 80) {
                scrollBtn.classList.remove('hidden');
            } else {
                scrollBtn.classList.add('hidden');
            }
        }
    };

    canvas.addEventListener('wheel', checkScroll, { passive: true });
    canvas.addEventListener('touchmove', checkScroll, { passive: true });
    canvas.addEventListener('scroll', checkScroll, { passive: true });

    if (scrollBtn) {
        scrollBtn.addEventListener('click', () => {
            userScrolledUp = false;
            canvas.scrollTo({ top: canvas.scrollHeight, behavior: 'smooth' });
            scrollBtn.classList.add('hidden');
        });
    }
}

export function scrollChatToBottom(smooth = false) {
    const canvas = document.getElementById('chat-canvas');
    if (!canvas || userScrolledUp) return;
    if (smooth) canvas.scrollTo({ top: canvas.scrollHeight, behavior: 'smooth' });
    else canvas.scrollTop = canvas.scrollHeight;
    document.getElementById('btn-scroll-bottom')?.classList.add('hidden');
}

function toggleChatVisibility(showMessages) {
    const container = document.getElementById('messages-container');
    const emptyState = document.getElementById('empty-state');
    if (!container || !emptyState) return null;
    emptyState.classList.toggle('hidden', showMessages);
    container.classList.toggle('hidden', !showMessages);

    const mainContent = document.getElementById('main-content');
    if (mainContent) {
        mainContent.classList.toggle('has-messages', showMessages);
        mainContent.classList.toggle('is-empty', !showMessages);
    }
    const actionPills = document.getElementById('action-pills-row');
    if (actionPills) {
        actionPills.classList.toggle('hidden', showMessages);
    }

    return container;
}

export function appendUserMessage(msg) {
    const container = toggleChatVisibility(true);
    if (!container) return;
    container.appendChild(createMessageElement(msg));
    userScrolledUp = false;
    scrollChatToBottom(false);
}

export function renderMessages(chat) {
    const hasMessages = Boolean(chat && chat.messages.length > 0);
    const container = toggleChatVisibility(hasMessages);
    if (!container) return;
    cancelAnimationFrame(streamAnimationId);
    streamAnimationId = null;
    isStreamActive = false;
    container.innerHTML = '';
    if (hasMessages) {
        chat.messages.forEach(msg => container.appendChild(createMessageElement(msg)));
    }
    userScrolledUp = false;
    scrollChatToBottom(false);
}

function createMessageElement(msg) {
    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper ${msg.role}`;

    if (msg.role === 'assistant') {
        const header = document.createElement('div');
        header.className = 'message-header';
        header.innerHTML = `
            <span class="role-badge">Assistant</span>
            <span class="timestamp">${formatTime(new Date(msg.timestamp || Date.now()))}</span>
        `;
        wrapper.appendChild(header);
    }

    const content = document.createElement('div');
    content.className = 'message-content';

    if (msg.role === 'assistant') {
        content.innerHTML = parseMarkdown(msg.content);
        enhanceCodeBlocks(content);
        enhanceTables(content);
        enhanceImages(content);
        wrapper.appendChild(content);
        appendAssistantActions(wrapper, content, msg.content);
    } else {
        content.textContent = msg.content;
        if (msg.attachments?.length > 0) {
            const tray = document.createElement('div');
            tray.className = 'message-attachments';
            msg.attachments.forEach(a => {
                if (a.category === 'image' || a.type?.startsWith('image/')) {
                    const img = document.createElement('img');
                    img.src = a.data || '';
                    img.alt = a.name || 'Gambar';
                    img.className = 'msg-img-attachment';
                    img.style.width = '52px';
                    img.style.height = '52px';
                    img.style.objectFit = 'cover';
                    img.style.borderRadius = 'var(--rounded-md)';
                    img.style.border = '1px solid var(--color-hairline-strong)';
                    tray.appendChild(img);
                } else {
                    const icon = a.category === 'zip' ? 'archive' :
                                 (a.category === 'pdf' ? 'file-text' :
                                 (a.category === 'presentation' ? 'presentation' :
                                 (a.category === 'spreadsheet' ? 'table' :
                                 (a.category === 'document' ? 'file-text' : 'file-code'))));
                    const badge = document.createElement('div');
                    badge.className = `msg-file-badge ${a.category || 'text'}`;

                    const iconEl = document.createElement('i');
                    iconEl.dataset.lucide = icon;
                    iconEl.className = 'msg-file-icon';

                    const nameSpan = document.createElement('span');
                    nameSpan.className = 'msg-file-name';
                    nameSpan.title = a.name || '';
                    nameSpan.textContent = a.name || '';

                    const sizeSpan = document.createElement('span');
                    sizeSpan.className = 'msg-file-size';
                    sizeSpan.textContent = a.sizeFormatted || '';

                    badge.appendChild(iconEl);
                    badge.appendChild(nameSpan);
                    badge.appendChild(sizeSpan);
                    tray.appendChild(badge);
                }
            });
            content.appendChild(tray);
        }
        wrapper.appendChild(content);
        appendUserActions(wrapper, content, msg);
    }

    if (typeof lucide !== 'undefined') {
        lucide.createIcons({ attrs: { 'stroke-width': '1.5' } });
    }

    return wrapper;
}

function setupStreamingWrapper(initialText = '', isResume = false, streamMode = 'default') {
    incomingTargetText = initialText;
    lastRenderTimestamp = 0;
    isStreamActive = true;
    userScrolledUp = false;

    if (streamAnimationId) {
        cancelAnimationFrame(streamAnimationId);
        streamAnimationId = null;
    }

    initChatScroll();

    const container = toggleChatVisibility(true);
    let content;
    if (isResume) {
        const lastWrapper = container?.lastElementChild;
        if (lastWrapper?.classList.contains('assistant')) {
            lastWrapper.classList.add('streaming');
            content = lastWrapper.querySelector('.message-content');
            if (content) {
                content.id = 'current-stream';
                lastWrapper.querySelector('.assistant-actions')?.remove();
            }
        }
    }

    if (!content) {
        const wrapper = document.createElement('div');
        wrapper.className = 'message-wrapper assistant streaming';

        let placeholderHtml = '';
        if (streamMode === 'web') {
            placeholderHtml = `
                <div class="stream-loader minimal web">
                    <i data-lucide="globe" class="loader-icon-spin"></i>
                    <span class="loader-text">Searching</span>
                    <span class="loader-dots">
                        <span class="dot"></span>
                        <span class="dot"></span>
                        <span class="dot"></span>
                    </span>
                </div>
            `;
        } else if (streamMode === 'thinking') {
            placeholderHtml = `
                <div class="stream-loader minimal thinking">
                    <i data-lucide="sparkles" class="loader-icon-pulse"></i>
                    <span class="loader-text">Thinking</span>
                    <span class="loader-dots">
                        <span class="dot"></span>
                        <span class="dot"></span>
                        <span class="dot"></span>
                    </span>
                </div>
            `;
        } else {
            placeholderHtml = `
                <div class="stream-loader dots-only">
                    <span class="pulse-dot"></span>
                    <span class="pulse-dot"></span>
                    <span class="pulse-dot"></span>
                </div>
            `;
        }

        wrapper.innerHTML = `
            <div class="message-header">
                <span class="role-badge">Assistant</span>
                <span class="timestamp">${formatTime(new Date())}</span>
            </div>
            <div class="message-content" id="current-stream">${initialText ? parseMarkdown(initialText) : placeholderHtml}</div>
        `;
        container?.appendChild(wrapper);

        if (typeof lucide !== 'undefined') {
            lucide.createIcons({ attrs: { 'stroke-width': '1.5' } });
        }
    }

    scrollChatToBottom(false);
    streamAnimationId = requestAnimationFrame(streamRenderLoop);
}

export function appendStreamingMessage(initialText = '', streamMode = 'default') {
    setupStreamingWrapper(initialText, false, streamMode);
}

export function resumeStreamingMessage(initialText = '') {
    setupStreamingWrapper(initialText, true, 'default');
}

export function updateStreamingMessage(text) {
    incomingTargetText = String(text || '');
    if (!streamAnimationId && isStreamActive) {
        streamAnimationId = requestAnimationFrame(streamRenderLoop);
    }
}

export function finalizeStreamingMessage(text = incomingTargetText) {
    incomingTargetText = String(text || '');
    isStreamActive = false;
    cancelAnimationFrame(streamAnimationId);
    streamAnimationId = null;
    const content = document.getElementById('current-stream');
    if (content) finalizeStreamRender(content);
}

function streamRenderLoop(timestamp) {
    streamAnimationId = null;
    const content = document.getElementById('current-stream');
    if (!content || !isStreamActive) return;
    if (timestamp - lastRenderTimestamp >= 60 && content.dataset.rendered !== incomingTargetText) {
        lastRenderTimestamp = timestamp;
        content.dataset.rendered = incomingTargetText;
        if (incomingTargetText) content.innerHTML = parseMarkdown(repairIncompleteMarkdown(incomingTargetText));
        scrollChatToBottom(false);
    }
    // Wait for new data without polling on every frame; keep the target mounted.
    if (incomingTargetText && content.dataset.rendered !== incomingTargetText) streamAnimationId = requestAnimationFrame(streamRenderLoop);
}

function finalizeStreamRender(content) {
    content.removeAttribute('id');
    delete content.dataset.rendered;
    const wrapper = content.parentElement;
    wrapper.classList.remove('streaming');
    content.innerHTML = parseMarkdown(incomingTargetText);
    enhanceCodeBlocks(content);
    enhanceTables(content);
    enhanceImages(content);
    wrapper.querySelectorAll('.assistant-actions').forEach(el => el.remove());
    appendAssistantActions(wrapper, content, incomingTargetText);
    if (window.lucide) window.lucide.createIcons();
    scrollChatToBottom(false);
}
