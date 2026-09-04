import { getPendingAttachments, clearPendingAttachments, addPendingAttachment, removePendingAttachment } from '../store/index.js';
import { validateFile, processFile } from '../utils/file-processor.js';
import { showToast } from '../utils/toast.js';

export function initInputUI(onSendMessage, onStopGeneration) {
    const chatInput = document.getElementById('chat-input');
    const btnSend = document.getElementById('btn-send');
    const btnAttach = document.getElementById('btn-attach');
    const btnWebSearch = document.getElementById('btn-web-search');
    const fileInput = document.getElementById('file-input');
    const imagePreviewTray = document.getElementById('image-preview-tray');
    const dropOverlay = document.getElementById('drop-overlay');

    let isGeneratingState = false;
    let isWebSearchActive = false;

    const adjustHeight = () => {
        chatInput.style.height = 'auto';
        chatInput.style.height = Math.min(chatInput.scrollHeight, 180) + 'px';
    };

    const updateSendButtonState = () => {
        if (isGeneratingState) {
            btnSend.disabled = false;
            return;
        }
        btnSend.disabled = chatInput.value.trim() === '' && getPendingAttachments().length === 0;
    };

    async function processFiles(files) {
        if (!files || files.length === 0) return;

        for (const file of files) {
            const validation = validateFile(file);
            if (!validation.valid) {
                showToast(validation.error, 'error');
                continue;
            }
            try {
                const processed = await processFile(file);
                addPendingAttachment(processed);
            } catch (err) {
                showToast(`Gagal membaca ${file.name}: ${err.message}`, 'error');
            }
        }
        renderImagePreviews();
        adjustHeight();
        updateSendButtonState();
    }

    chatInput.addEventListener('input', () => {
        adjustHeight();
        updateSendButtonState();
    });

    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (isGeneratingState) {
                if (typeof onStopGeneration === 'function') onStopGeneration();
            } else if (!btnSend.disabled) {
                submitMessage();
            }
        }
    });

    chatInput.addEventListener('paste', async (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        const pastedFiles = [];
        for (const item of items) {
            if (item.kind === 'file') {
                const file = item.getAsFile();
                if (file) pastedFiles.push(file);
            }
        }
        if (pastedFiles.length > 0) {
            await processFiles(pastedFiles);
        }
    });

    btnSend.addEventListener('click', () => {
        if (isGeneratingState) {
            if (typeof onStopGeneration === 'function') onStopGeneration();
        } else if (!btnSend.disabled) {
            submitMessage();
        }
    });

    // Toggle Riset Web Terkini
    if (btnWebSearch) {
        btnWebSearch.addEventListener('click', () => {
            isWebSearchActive = !isWebSearchActive;
            btnWebSearch.classList.toggle('active', isWebSearchActive);
            btnWebSearch.setAttribute('aria-pressed', isWebSearchActive ? 'true' : 'false');
            if (isWebSearchActive) {
                showToast('Web Search aktif: AI akan live browsing data terbaru', 'info');
            } else {
                showToast('Web Search nonaktif', 'info');
            }
        });
    }

    btnAttach.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            await processFiles(files);
            fileInput.value = '';
        }
    });

    function initDragAndDrop() {
        if (!dropOverlay) return;

        let dragCounter = 0;

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            window.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });

        window.addEventListener('dragenter', (e) => {
            dragCounter++;
            if (e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
                dropOverlay.classList.remove('hidden');
            }
        });

        window.addEventListener('dragleave', () => {
            dragCounter--;
            if (dragCounter <= 0) {
                dragCounter = 0;
                dropOverlay.classList.add('hidden');
            }
        });

        window.addEventListener('drop', async (e) => {
            dragCounter = 0;
            dropOverlay.classList.add('hidden');
            const files = Array.from(e.dataTransfer.files);
            if (files.length > 0) {
                await processFiles(files);
            }
        });
    }

    function renderImagePreviews() {
        if (!imagePreviewTray) return;

        const attachments = getPendingAttachments();
        if (attachments.length === 0) {
            imagePreviewTray.classList.add('hidden');
            imagePreviewTray.innerHTML = '';
            return;
        }

        imagePreviewTray.classList.remove('hidden');
        imagePreviewTray.innerHTML = attachments.map(item => {
            if (item.category === 'image' || item.type?.startsWith('image/')) {
                return `
                    <div class="preview-item image-item" data-id="${item.id}">
                        <img src="${item.data}" alt="${item.name}" class="preview-thumbnail">
                        <button class="btn-remove-attachment" data-id="${item.id}" aria-label="Hapus ${item.name}">
                            <i data-lucide="x"></i>
                        </button>
                    </div>
                `;
            }

            const iconMap = {
                pdf: 'file-text',
                zip: 'archive',
                code: 'file-code',
                text: 'file-text'
            };
            const icon = iconMap[item.category] || 'file';

            return `
                <div class="preview-item file-item ${item.category || 'text'}" data-id="${item.id}">
                    <div class="file-item-icon">
                        <i data-lucide="${icon}"></i>
                    </div>
                    <div class="file-item-info">
                        <span class="file-item-name" title="${item.name}">${item.name}</span>
                        <span class="file-item-size">${item.sizeFormatted || ''}</span>
                    </div>
                    <button class="btn-remove-attachment" data-id="${item.id}" aria-label="Hapus ${item.name}">
                        <i data-lucide="x"></i>
                    </button>
                </div>
            `;
        }).join('');

        if (typeof lucide !== 'undefined') {
            lucide.createIcons({ attrs: { 'stroke-width': '1.5' } });
        }

        imagePreviewTray.querySelectorAll('.btn-remove-attachment').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                removePendingAttachment(id);
                renderImagePreviews();
                adjustHeight();
                updateSendButtonState();
            });
        });
    }

    function submitMessage() {
        const text = chatInput.value.trim();
        const attachments = getPendingAttachments();
        if (!text && attachments.length === 0) return;

        chatInput.value = '';
        chatInput.style.height = 'auto';
        btnSend.disabled = true;
        clearPendingAttachments();
        renderImagePreviews();

        onSendMessage(text, attachments, { webSearch: isWebSearchActive });
    }

    initDragAndDrop();
    adjustHeight();
    updateSendButtonState();

    return {
        enableInput: (enabled) => {
            chatInput.disabled = !enabled;
            btnAttach.disabled = !enabled;
            fileInput.disabled = !enabled;
            if (!enabled) {
                // Diatur oleh setGenerating
            } else {
                updateSendButtonState();
            }
        },
        setGenerating: (isGenerating) => {
            isGeneratingState = isGenerating;
            if (isGenerating) {
                btnSend.disabled = false;
                btnSend.classList.add('btn-stop');
                btnSend.title = 'Stop respon';
                btnSend.setAttribute('aria-label', 'Stop respon');
                btnSend.innerHTML = '<i data-lucide="square"></i>';
            } else {
                btnSend.classList.remove('btn-stop');
                btnSend.title = 'Kirim Pesan';
                btnSend.setAttribute('aria-label', 'Kirim Pesan');
                btnSend.innerHTML = '<i data-lucide="arrow-up"></i>';
                updateSendButtonState();
            }
            if (typeof lucide !== 'undefined') {
                lucide.createIcons({ attrs: { 'stroke-width': '1.5' } });
            }
        },
        clearInput: () => {
            chatInput.value = '';
            chatInput.style.height = 'auto';
            clearPendingAttachments();
            renderImagePreviews();
            btnSend.disabled = true;
        },
        focus: () => chatInput.focus(),
        isWebSearchActive: () => isWebSearchActive
    };
}

export function setChatInputValue(text) {
    const chatInput = document.getElementById('chat-input');
    const btnSend = document.getElementById('btn-send');
    if (!chatInput) return;
    chatInput.value = text;
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 180) + 'px';
    if (btnSend) btnSend.disabled = chatInput.value.trim() === '';
    chatInput.focus();

    const startIdx = text.indexOf('[');
    const endIdx = text.indexOf(']');
    if (startIdx !== -1 && endIdx !== -1) {
        chatInput.setSelectionRange(startIdx, endIdx + 1);
    } else {
        chatInput.setSelectionRange(text.length, text.length);
    }
}
