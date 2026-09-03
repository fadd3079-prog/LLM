import { getPendingAttachments, clearPendingAttachments, addPendingAttachment, removePendingAttachment } from '../store/index.js';
import { validateFile, processFile } from '../utils/file-processor.js';
import { showToast } from '../utils/toast.js';

export function initInputUI(onSendMessage) {
    const chatInput = document.getElementById('chat-input');
    const btnSend = document.getElementById('btn-send');
    const btnAttach = document.getElementById('btn-attach');
    const fileInput = document.getElementById('file-input');
    const imagePreviewTray = document.getElementById('image-preview-tray');
    const dropOverlay = document.getElementById('drop-overlay');

    const adjustHeight = () => {
        chatInput.style.height = 'auto';
        chatInput.style.height = Math.min(chatInput.scrollHeight, 180) + 'px';
    };

    const updateSendButtonState = () => {
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
            if (!btnSend.disabled) {
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
        if (!btnSend.disabled) {
            submitMessage();
        }
    });

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
            if (e.dataTransfer && e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
                dragCounter++;
                dropOverlay.classList.remove('hidden');
                dropOverlay.classList.add('active');
            }
        });

        window.addEventListener('dragleave', (e) => {
            dragCounter--;
            if (dragCounter <= 0) {
                dragCounter = 0;
                dropOverlay.classList.remove('active');
                dropOverlay.classList.add('hidden');
            }
        });

        window.addEventListener('drop', async (e) => {
            dragCounter = 0;
            dropOverlay.classList.remove('active');
            dropOverlay.classList.add('hidden');

            const files = e.dataTransfer?.files;
            if (files && files.length > 0) {
                await processFiles(Array.from(files));
            }
        });
    }

    function renderImagePreviews() {
        const attachments = getPendingAttachments();
        if (attachments.length === 0) {
            imagePreviewTray.classList.add('hidden');
            imagePreviewTray.innerHTML = '';
            return;
        }
        imagePreviewTray.classList.remove('hidden');
        imagePreviewTray.innerHTML = '';

        attachments.forEach((attachment, index) => {
            const item = document.createElement('div');
            const isImage = attachment.category === 'image';
            item.className = `image-preview-item ${isImage ? 'is-img' : 'is-file'}`;

            if (isImage) {
                item.innerHTML = `
                    <img src="${attachment.data}" alt="${attachment.name}" loading="lazy">
                    <button class="remove-btn" aria-label="Hapus lampiran" title="Hapus" data-index="${index}">
                        <i data-lucide="x"></i>
                    </button>
                `;
            } else {
                let iconName = 'file-text';
                if (attachment.category === 'pdf') iconName = 'file-text';
                else if (attachment.category === 'zip') iconName = 'archive';
                else if (attachment.category === 'text') iconName = 'file-code';

                item.innerHTML = `
                    <div class="file-badge-preview">
                        <i data-lucide="${iconName}" class="badge-icon ${attachment.category}"></i>
                        <div class="badge-texts">
                            <span class="badge-name" title="${attachment.name}">${attachment.name}</span>
                            <span class="badge-size">${attachment.sizeFormatted}</span>
                        </div>
                    </div>
                    <button class="remove-btn" aria-label="Hapus lampiran" title="Hapus" data-index="${index}">
                        <i data-lucide="x"></i>
                    </button>
                `;
            }
            imagePreviewTray.appendChild(item);
        });

        if (typeof lucide !== 'undefined') {
            lucide.createIcons({ attrs: { 'stroke-width': '1.5' } });
        }

        imagePreviewTray.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.currentTarget.dataset.index, 10);
                removePendingAttachment(index);
                renderImagePreviews();
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
        onSendMessage(text, attachments);
    }

    initDragAndDrop();
    adjustHeight();
    updateSendButtonState();

    return {
        enableInput: (enabled) => {
            chatInput.disabled = !enabled;
            btnAttach.disabled = !enabled;
            fileInput.disabled = !enabled;
            if (!enabled) btnSend.disabled = true;
            else updateSendButtonState();
        },
        clearInput: () => {
            chatInput.value = '';
            chatInput.style.height = 'auto';
            clearPendingAttachments();
            renderImagePreviews();
            btnSend.disabled = true;
        },
        focus: () => chatInput.focus()
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
