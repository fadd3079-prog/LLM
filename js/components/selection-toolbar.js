import { setChatInputValue } from './input.js';
import { copyToClipboard } from '../utils/clipboard.js';
import { showToast } from '../utils/toast.js';

export function initSelectionToolbar(onSendMessage) {
    const toolbar = document.getElementById('selection-toolbar');
    if (!toolbar) return;

    const actionsView = document.getElementById('sel-actions-view');
    const inputView = document.getElementById('sel-input-view');
    const promptInput = document.getElementById('sel-prompt-input');
    const btnSend = document.getElementById('sel-btn-send');
    const btnBack = document.getElementById('sel-btn-back');

    let currentSelectedText = '';
    let isInputActive = false;

    function resetViews() {
        isInputActive = false;
        actionsView?.classList.remove('hidden');
        inputView?.classList.add('hidden');
        if (promptInput) promptInput.value = '';
    }

    function showToolbar(rect) {
        // Measure or estimate size
        const isMobile = window.innerWidth <= 768;
        const toolbarWidth = isInputActive
            ? Math.min(420, window.innerWidth - 24)
            : (isMobile ? Math.min(320, window.innerWidth - 24) : 380);
        const toolbarHeight = 44;
        const margin = 10;

        let left = rect.left + (rect.width / 2) - (toolbarWidth / 2);
        let top = rect.top - toolbarHeight - margin;

        // Clamp horizontally within screen
        const maxLeft = window.innerWidth - toolbarWidth - 12;
        left = Math.max(12, Math.min(left, maxLeft));

        // If above selection goes off-screen, display below selection
        if (top < 12) {
            top = rect.bottom + margin;
        }

        toolbar.style.left = `${Math.round(left)}px`;
        toolbar.style.top = `${Math.round(top)}px`;
        toolbar.classList.remove('hidden');

        if (typeof lucide !== 'undefined') {
            lucide.createIcons({ attrs: { 'stroke-width': '1.5' } });
        }
    }

    function hideToolbar() {
        if (toolbar.classList.contains('hidden')) return;
        toolbar.classList.add('hidden');
        resetViews();
        currentSelectedText = '';
    }

    function switchToInputMode() {
        isInputActive = true;
        actionsView?.classList.add('hidden');
        inputView?.classList.remove('hidden');

        if (typeof lucide !== 'undefined') {
            lucide.createIcons({ attrs: { 'stroke-width': '1.5' } });
        }

        // Re-center toolbar for the input width
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
            const rect = selection.getRangeAt(0).getBoundingClientRect();
            showToolbar(rect);
        }

        setTimeout(() => {
            promptInput?.focus();
        }, 50);
    }

    function getSelectedTextInChat() {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed || !selection.rangeCount) return null;

        const range = selection.getRangeAt(0);
        const container = range.commonAncestorContainer;
        const messageContent = container.nodeType === 1
            ? container.closest?.('.message-content')
            : container.parentElement?.closest?.('.message-content');

        if (!messageContent) return null;

        // Only allow selection inside assistant messages
        const wrapper = messageContent.closest('.message-wrapper.assistant');
        if (!wrapper) return null;

        const text = selection.toString().trim();
        if (text.length < 2) return null;

        return { text, rect: range.getBoundingClientRect() };
    }

    function evaluateSelection() {
        // If user is currently typing in the mini input, don't interrupt
        if (isInputActive) return;

        const result = getSelectedTextInChat();
        if (result) {
            currentSelectedText = result.text;
            resetViews();
            showToolbar(result.rect);
        } else {
            hideToolbar();
        }
    }

    // Mouse selection
    document.addEventListener('mouseup', (e) => {
        if (toolbar.contains(e.target)) return;
        setTimeout(evaluateSelection, 20);
    });

    // Touch devices selection
    document.addEventListener('touchend', (e) => {
        if (toolbar.contains(e.target)) return;
        setTimeout(evaluateSelection, 250);
    });

    // Handle selection collapse
    document.addEventListener('selectionchange', () => {
        if (isInputActive) return;
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) {
            setTimeout(() => {
                if (isInputActive) return;
                const sel = window.getSelection();
                if (!sel || sel.isCollapsed) {
                    hideToolbar();
                }
            }, 150);
        }
    });

    // Hide toolbar when chat scrolls
    const canvas = document.getElementById('chat-canvas');
    if (canvas) {
        canvas.addEventListener('scroll', () => {
            if (!isInputActive) {
                hideToolbar();
            }
        }, { passive: true });
    }

    // Dismiss on click outside
    document.addEventListener('mousedown', (e) => {
        if (!toolbar.contains(e.target)) {
            const result = getSelectedTextInChat();
            if (!result) {
                hideToolbar();
            }
        }
    });

    // Escape key listener to close or cancel input
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (isInputActive) {
                resetViews();
                const sel = getSelectedTextInChat();
                if (sel) showToolbar(sel.rect);
                else hideToolbar();
            } else {
                hideToolbar();
            }
        }
    });

    // Submit custom instruction
    function submitCustomInstruction() {
        if (!currentSelectedText) return;

        const instruction = promptInput?.value?.trim() || '';
        const prompt = instruction
            ? `Mengenai kutipan berikut:\n> "${currentSelectedText}"\n\n${instruction}`
            : `Tolong jelaskan lebih mendalam mengenai kutipan berikut:\n\n> "${currentSelectedText}"`;

        if (typeof onSendMessage === 'function') {
            onSendMessage(prompt);
        } else {
            setChatInputValue(prompt);
        }

        window.getSelection()?.removeAllRanges();
        hideToolbar();
    }

    // Mini input events
    promptInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            submitCustomInstruction();
        }
    });

    btnSend?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        submitCustomInstruction();
    });

    btnBack?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        resetViews();
        const sel = getSelectedTextInChat();
        if (sel) showToolbar(sel.rect);
        else hideToolbar();
    });

    // Action button clicks
    toolbar.addEventListener('click', async (e) => {
        const btn = e.target.closest('.sel-action-btn');
        if (!btn || !currentSelectedText) return;

        const action = btn.dataset.action;

        switch (action) {
            case 'ask':
                switchToInputMode();
                break;

            case 'explain': {
                const prompt = `Tolong jelaskan secara mendalam mengenai bagian berikut:\n\n> "${currentSelectedText}"`;
                if (typeof onSendMessage === 'function') {
                    onSendMessage(prompt);
                } else {
                    setChatInputValue(prompt);
                }
                window.getSelection()?.removeAllRanges();
                hideToolbar();
                break;
            }

            case 'summarize': {
                const prompt = `Tolong ringkas poin-poin penting dari bagian berikut:\n\n> "${currentSelectedText}"`;
                if (typeof onSendMessage === 'function') {
                    onSendMessage(prompt);
                } else {
                    setChatInputValue(prompt);
                }
                window.getSelection()?.removeAllRanges();
                hideToolbar();
                break;
            }

            case 'quote': {
                setChatInputValue(`> ${currentSelectedText}\n\n`);
                showToast('Kutipan dimasukkan ke kolom chat', 'info');
                window.getSelection()?.removeAllRanges();
                hideToolbar();
                break;
            }

            case 'copy': {
                const success = await copyToClipboard(currentSelectedText);
                if (success) showToast('Teks berhasil disalin ke clipboard', 'success');
                window.getSelection()?.removeAllRanges();
                hideToolbar();
                break;
            }
        }
    });
}
