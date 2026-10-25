import { parseMarkdown } from '../utils/markdown.js';
import { repairIncompleteMarkdown } from '../api/stream-parser.js';
import { animateElement, animateLayout, motionAllowed } from '../utils/motion.js';
import { reconcileStreamHTML, settleStreamHTML } from '../utils/stream-dom.js';
import { t } from '../services/i18n.js';
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
let lastRenderedText = '';
let renderCost = 0;
let streamPhase = 'writing';
let scrollAnimationId = null;


export function initChatScroll() {
    const canvas = document.getElementById('chat-canvas');
    const scrollBtn = document.getElementById('btn-scroll-bottom');
    if (!canvas || canvas.dataset.scrollTrackingAttached) return;
    canvas.dataset.scrollTrackingAttached = 'true';

    const checkScroll = () => {
        if (scrollAnimationId && !userScrolledUp) return;
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

    const readerInteraction = e => {
        cancelAnimationFrame(scrollAnimationId);
        scrollAnimationId = null;
        if (e.type === 'touchmove' || e.deltaY < 0) userScrolledUp = true;
    };
    canvas.addEventListener('wheel', readerInteraction, { passive: true });
    canvas.addEventListener('touchmove', readerInteraction, { passive: true });
    canvas.addEventListener('scroll', checkScroll, { passive: true });

    if (scrollBtn) {
        scrollBtn.addEventListener('click', () => {
            userScrolledUp = false;
            scrollChatToBottom(true);
            scrollBtn.classList.add('hidden');
        });
    }
}

export function scrollChatToBottom(smooth = false) {
    const canvas = document.getElementById('chat-canvas');
    if (!canvas || userScrolledUp) return;
    if (!smooth || !motionAllowed()) {
        cancelAnimationFrame(scrollAnimationId);
        scrollAnimationId = null;
        canvas.scrollTop = canvas.scrollHeight;
    } else if (!scrollAnimationId) {
        let previous = 0;
        const follow = timestamp => {
            scrollAnimationId = null;
            if (userScrolledUp || !canvas.isConnected) return;
            const target = canvas.scrollHeight - canvas.clientHeight;
            const gap = target - canvas.scrollTop;
            if (gap <= 1 || !motionAllowed()) { canvas.scrollTop = target; return; }
            const elapsed = previous ? Math.min(timestamp - previous, 50) : 16.67;
            previous = timestamp;
            canvas.scrollTop += gap * (1 - Math.exp(-elapsed / 65));
            scrollAnimationId = requestAnimationFrame(follow);
        };
        scrollAnimationId = requestAnimationFrame(follow);
    }
    document.getElementById('btn-scroll-bottom')?.classList.add('hidden');
}

function toggleChatVisibility(showMessages) {
    const composer = document.querySelector('.input-area-inner');
    const previous = document.getElementById('main-content')?.classList.contains('has-messages') !== showMessages ? composer?.getBoundingClientRect() : null;
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

    if (previous) animateLayout(composer, previous);
    return container;
}

export function appendUserMessage(msg) {
    const container = toggleChatVisibility(true);
    if (!container) return;
    const element = createMessageElement(msg);
    container.appendChild(element);
    animateElement(element, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 280 });
    userScrolledUp = false;
    scrollChatToBottom(false);
}

export function renderMessages(chat) {
    const hasMessages = Boolean(chat && chat.messages.length > 0);
    const container = toggleChatVisibility(hasMessages);
    if (!container) return;
    cancelAnimationFrame(streamAnimationId);
    cancelAnimationFrame(scrollAnimationId);
    streamAnimationId = null;
    scrollAnimationId = null;
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
    lastRenderedText = '';
    lastRenderTimestamp = 0;
    renderCost = 0;
    isStreamActive = true;
    userScrolledUp = false;
    cancelAnimationFrame(streamAnimationId);
    streamAnimationId = null;
    initChatScroll();
    const container = toggleChatVisibility(true);
    let wrapper = isResume ? container?.lastElementChild : null;
    if (!wrapper?.classList.contains('assistant')) {
        wrapper = document.createElement('div');
        wrapper.className = 'message-wrapper assistant';
        const header = document.createElement('div');
        header.className = 'message-header';
        const role = document.createElement('span');
        role.className = 'role-badge';
        role.textContent = 'Assistant';
        const time = document.createElement('span');
        time.className = 'timestamp';
        time.textContent = formatTime(new Date());
        header.append(role, time);
        const content = document.createElement('div');
        content.className = 'message-content';
        wrapper.append(header, content);
        container?.append(wrapper);
    }
    wrapper.classList.add('streaming');
    wrapper.dataset.generationPhase = 'waiting';
    wrapper.setAttribute('aria-busy', 'true');
    wrapper.querySelector('.assistant-actions')?.remove();
    wrapper.querySelector('.generation-status')?.remove();
    const status = document.createElement('span');
    status.className = 'generation-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.innerHTML = '<span class="generation-status-dot" aria-hidden="true"></span><span class="generation-status-label"></span>';
    wrapper.querySelector('.message-header').append(status);
    status.querySelector('.generation-status-label').textContent = t(streamMode === 'web' ? 'motion_searching' : streamMode === 'audio' ? 'motion_audio' : 'motion_thinking');
    const content = wrapper.querySelector('.message-content');
    content.id = 'current-stream';
    if (initialText) reconcileStreamHTML(content, parseMarkdown(initialText));
    else {
        content.innerHTML = '<div class="thinking-indicator" aria-hidden="true"><span class="thinking-signal"><span></span><span></span><span></span><span></span></span><span class="thinking-caption"></span></div>';
        content.querySelector('.thinking-caption').textContent = t('motion_waiting');
    }
    animateElement(wrapper, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 280 });
    scrollChatToBottom(true);
    if (initialText) streamAnimationId = requestAnimationFrame(streamRenderLoop);
}

export function appendStreamingMessage(initialText = '', streamMode = 'default') {
    setupStreamingWrapper(initialText, false, streamMode);
}

export function resumeStreamingMessage(initialText = '') {
    setupStreamingWrapper(initialText, true, 'default');
}

export function updateStreamingMessage(text, meta = {}) {
    streamPhase = meta.hasOutput === false && meta.hasReasoning ? 'thinking' : 'writing';
    incomingTargetText = String(text || '');
    if (!streamAnimationId && isStreamActive) {
        streamAnimationId = requestAnimationFrame(streamRenderLoop);
    }
}

export function finalizeStreamingMessage(text = incomingTargetText, phase = 'complete') {
    incomingTargetText = String(text || '');
    isStreamActive = false;
    cancelAnimationFrame(streamAnimationId);
    streamAnimationId = null;
    const content = document.getElementById('current-stream');
    if (content) finalizeStreamRender(content, phase);
}

function streamRenderLoop(timestamp) {
    streamAnimationId = null;
    const content = document.getElementById('current-stream');
    if (!content || !isStreamActive) return;
    const interval = Math.max(48, Math.min(180, renderCost * 6));
    if (timestamp - lastRenderTimestamp >= interval && lastRenderedText !== incomingTargetText) {
        lastRenderTimestamp = timestamp;
        const start = performance.now();
        if (incomingTargetText) {
            content.querySelector('.thinking-indicator')?.remove();
            reconcileStreamHTML(content, parseMarkdown(repairIncompleteMarkdown(incomingTargetText)));
            setGenerationPhase(content.parentElement, streamPhase);
        }
        lastRenderedText = incomingTargetText;
        renderCost = performance.now() - start;
        scrollChatToBottom(true);
    }
    // Wait for new data without polling on every frame; keep the target mounted.
    if (incomingTargetText && lastRenderedText !== incomingTargetText) streamAnimationId = requestAnimationFrame(streamRenderLoop);
}

function setGenerationPhase(wrapper, phase) {
    if (wrapper.dataset.generationPhase === phase) return;
    wrapper.dataset.generationPhase = phase;
    const label = wrapper.querySelector('.generation-status-label');
    if (label) label.textContent = t(`motion_${phase}`);
}

function finalizeStreamRender(content, phase) {
    content.removeAttribute('id');
    content.querySelector('.thinking-indicator')?.remove();
    const wrapper = content.parentElement;
    reconcileStreamHTML(content, parseMarkdown(incomingTargetText));
    settleStreamHTML(content);
    wrapper.classList.remove('streaming');
    wrapper.setAttribute('aria-busy', 'false');
    setGenerationPhase(wrapper, phase);
    enhanceCodeBlocks(content);
    enhanceTables(content);
    enhanceImages(content);
    wrapper.querySelectorAll('.assistant-actions').forEach(el => el.remove());
    appendAssistantActions(wrapper, content, incomingTargetText);
    animateElement(wrapper.querySelector('.assistant-actions'), [{ opacity: 0, transform: 'translateY(3px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 240 });
    if (window.lucide) window.lucide.createIcons();
    scrollChatToBottom(true);
}
