import { parseMarkdown } from '../utils/markdown.js';
import { repairIncompleteMarkdown, calculateConsumptionStep } from '../api/stream-parser.js';
import { formatTime } from '../utils/dom.js';
import { enhanceCodeBlocks, enhanceTables, appendAssistantActions } from './chat-actions.js';

let incomingTargetText = '';
let consumedLength = 0;
let lastRenderTimestamp = 0;
let isStreamActive = false;
let streamAnimationId = null;
let userScrolledUp = false;

const RENDER_INTERVAL_MS = 24;

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
        wrapper.appendChild(content);
        appendAssistantActions(wrapper, content);
    } else {
        content.textContent = msg.content;
        if (msg.attachments?.length > 0) {
            const tray = document.createElement('div');
            tray.className = 'message-attachments';
            tray.innerHTML = msg.attachments.map(a => {
                if (a.category === 'image' || a.type?.startsWith('image/')) {
                    return `<img src="${a.data}" alt="${a.name}" class="msg-img-attachment" style="width:52px;height:52px;object-fit:cover;border-radius:var(--rounded-md);border:1px solid var(--color-hairline-strong);">`;
                }
                const icon = a.category === 'zip' ? 'archive' : (a.category === 'pdf' ? 'file-text' : 'file-code');
                return `<div class="msg-file-badge ${a.category || 'text'}"><i data-lucide="${icon}" class="msg-file-icon"></i><span class="msg-file-name" title="${a.name}">${a.name}</span><span class="msg-file-size">${a.sizeFormatted || ''}</span></div>`;
            }).join('');
            content.appendChild(tray);
        }
        wrapper.appendChild(content);
    }

    if (typeof lucide !== 'undefined') {
        lucide.createIcons({ attrs: { 'stroke-width': '1.5' } });
    }

    return wrapper;
}

function setupStreamingWrapper(initialText = '', isResume = false) {
    incomingTargetText = initialText;
    consumedLength = initialText.length;
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
        wrapper.innerHTML = `
            <div class="message-header">
                <span class="role-badge">Assistant</span>
                <span class="timestamp">${formatTime(new Date())}</span>
            </div>
            <div class="message-content" id="current-stream">${initialText ? parseMarkdown(initialText) : '<div class="typing"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>'}</div>
        `;
        container?.appendChild(wrapper);
    }

    scrollChatToBottom(false);
    streamAnimationId = requestAnimationFrame(streamRenderLoop);
}

export function appendStreamingMessage(initialText = '') {
    setupStreamingWrapper(initialText, false);
}

export function resumeStreamingMessage(initialText = '') {
    setupStreamingWrapper(initialText, true);
}

export function updateStreamingMessage(text) {
    incomingTargetText = text;
    if (!streamAnimationId && isStreamActive) {
        streamAnimationId = requestAnimationFrame(streamRenderLoop);
    }
}

export function finalizeStreamingMessage() {
    isStreamActive = false;
    if (!streamAnimationId) {
        streamAnimationId = requestAnimationFrame(streamRenderLoop);
    }
}

function streamRenderLoop(timestamp) {
    const content = document.getElementById('current-stream');
    if (!content) {
        streamAnimationId = null;
        return;
    }

    const unconsumed = incomingTargetText.length - consumedLength;

    if (unconsumed > 0) {
        if (!lastRenderTimestamp) lastRenderTimestamp = timestamp;
        const elapsed = timestamp - lastRenderTimestamp;

        if (elapsed >= RENDER_INTERVAL_MS) {
            lastRenderTimestamp = timestamp;
            const step = calculateConsumptionStep(unconsumed);
            consumedLength = Math.min(incomingTargetText.length, consumedLength + step);

            const currentSubstr = incomingTargetText.slice(0, consumedLength);
            const repairedMarkdown = repairIncompleteMarkdown(currentSubstr);
            content.innerHTML = parseMarkdown(repairedMarkdown);
            scrollChatToBottom(false);
        }

        streamAnimationId = requestAnimationFrame(streamRenderLoop);
    } else if (isStreamActive) {
        streamAnimationId = requestAnimationFrame(streamRenderLoop);
    } else {
        finalizeStreamRender(content);
    }
}

function finalizeStreamRender(content) {
    streamAnimationId = null;
    content.removeAttribute('id');
    const wrapper = content.parentElement;
    if (wrapper) {
        wrapper.classList.remove('streaming');
        content.innerHTML = parseMarkdown(incomingTargetText);
        enhanceCodeBlocks(content);
        enhanceTables(content);
        appendAssistantActions(wrapper, content);
        if (typeof lucide !== 'undefined') {
            lucide.createIcons({ attrs: { 'stroke-width': '1.5' } });
        }
    }
    scrollChatToBottom(false);
}