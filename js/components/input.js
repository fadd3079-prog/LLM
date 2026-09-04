import { getPendingAttachments, clearPendingAttachments, addPendingAttachment, removePendingAttachment } from '../store/index.js';
import { validateFile, processFile, formatBytes, getFileCategory } from '../utils/file-processor.js';
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
    let processingFiles = [];

    const adjustHeight = () => {
        chatInput.style.height = 'auto';
        chatInput.style.height = Math.min(chatInput.scrollHeight, 180) + 'px';
    };

    const updateSendButtonState = () => {
        if (isGeneratingState) {
            btnSend.disabled = false;
            return;
        }
        const hasText = chatInput.value.trim() !== '';
        const hasAttachments = getPendingAttachments().length > 0;
        const isProcessing = processingFiles.length > 0;
        btnSend.disabled = isProcessing || (!hasText && !hasAttachments);
    };

    async function processFiles(files) {
        if (!files || files.length === 0) return;

        const validItems = [];
        for (const file of files) {
            const validation = validateFile(file);
            if (!validation.valid) {
                showToast(validation.error, 'error');
                continue;
            }
            const loadingItem = {
                id: 'loading_' + Math.random().toString(36).substring(2, 9) + Date.now(),
                name: file.name,
                sizeFormatted: formatBytes(file.size),
                category: getFileCategory(file),
                cancelled: false
            };
            processingFiles.push(loadingItem);
            validItems.push({ file, loadingItem });
        }

        if (processingFiles.length > 0) {
            btnAttach.classList.add('uploading');
            renderImagePreviews();
            adjustHeight();
            updateSendButtonState();
        }

        if (validItems.length === 0) return;

        await Promise.all(validItems.map(async ({ file, loadingItem }) => {
            try {
                const processed = await processFile(file);
                if (!loadingItem.cancelled) {
                    addPendingAttachment(processed);
                }
            } catch (err) {
                if (!loadingItem.cancelled) {
                    showToast(`Gagal membaca ${file.name}: ${err.message}`, 'error');
                }
            } finally {
                processingFiles = processingFiles.filter(item => item.id !== loadingItem.id);
                if (processingFiles.length === 0) {
                    btnAttach.classList.remove('uploading');
                }
                renderImagePreviews();
                adjustHeight();
                updateSendButtonState();
            }
        }));
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
                dropOverlay.classList.add('active');
            }
        });

        window.addEventListener('dragleave', () => {
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
            const files = Array.from(e.dataTransfer.files);
            if (files.length > 0) {
                await processFiles(files);
            }
        });
    }

    function renderImagePreviews() {
        if (!imagePreviewTray) return;

        const attachments = getPendingAttachments();
        const totalCount = attachments.length + processingFiles.length;

        if (totalCount === 0) {
            imagePreviewTray.classList.add('hidden');
            imagePreviewTray.innerHTML = '';
            return;
        }

        imagePreviewTray.classList.remove('hidden');

        // Render completed attachments
        const attachmentsHtml = attachments.map(item => {
            if (item.category === 'image' || item.type?.startsWith('image/')) {
                return `
                    <div class="attachment-chip image-chip" data-id="${item.id}" title="${item.name}">
                        <div class="attachment-thumb-wrap">
                            <img src="${item.data}" alt="${item.name}" class="attachment-thumb">
                        </div>
                        <div class="attachment-chip-info">
                            <span class="attachment-chip-name">${item.name}</span>
                            <span class="attachment-chip-meta">${item.sizeFormatted || 'Gambar'}</span>
                        </div>
                        <button class="attachment-chip-remove" data-id="${item.id}" type="button" aria-label="Hapus ${item.name}" title="Hapus berkas">
                            <i data-lucide="x"></i>
                        </button>
                    </div>
                `;
            }

            const iconMap = {
                pdf: 'file-text',
                presentation: 'presentation',
                document: 'file-text',
                spreadsheet: 'table-2',
                zip: 'archive',
                code: 'file-code',
                text: 'file-text'
            };
            const icon = iconMap[item.category] || 'file-text';

            let metaText = item.sizeFormatted || '';
            if (item.pageCount) {
                metaText += ` • ${item.pageCount} Hal`;
            } else if (item.slideCount) {
                metaText += ` • ${item.slideCount} Slide`;
            } else if (item.ext) {
                metaText += ` • ${item.ext.toUpperCase()}`;
            }

            return `
                <div class="attachment-chip file-chip ${item.category || 'text'}" data-id="${item.id}" title="${item.name}">
                    <div class="attachment-icon-badge ${item.category || 'text'}">
                        <i data-lucide="${icon}"></i>
                    </div>
                    <div class="attachment-chip-info">
                        <span class="attachment-chip-name">${item.name}</span>
                        <span class="attachment-chip-meta">${metaText}</span>
                    </div>
                    <button class="attachment-chip-remove" data-id="${item.id}" type="button" aria-label="Hapus ${item.name}" title="Hapus berkas">
                        <i data-lucide="x"></i>
                    </button>
                </div>
            `;
        }).join('');

        // Render actively processing/uploading files with elegant lightweight animation
        const loadingHtml = processingFiles.map(item => {
            const cat = item.category || 'text';
            return `
                <div class="attachment-chip loading-chip ${cat}" data-id="${item.id}" title="Memproses ${item.name}...">
                    <div class="attachment-icon-badge loading ${cat}">
                        <svg class="loading-spinner-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <circle class="spinner-track" cx="12" cy="12" r="9" stroke-width="2.5"></circle>
                            <circle class="spinner-head" cx="12" cy="12" r="9" stroke-width="2.5" stroke-dasharray="24 38" stroke-linecap="round"></circle>
                        </svg>
                    </div>
                    <div class="attachment-chip-info">
                        <span class="attachment-chip-name">${item.name}</span>
                        <span class="attachment-chip-meta loading-meta">
                            <span class="loading-pulse-dot"></span>
                            <span class="loading-meta-text">Memproses ${item.sizeFormatted}...</span>
                        </span>
                    </div>
                    <button class="attachment-chip-remove loading-cancel" data-id="${item.id}" type="button" aria-label="Batal ${item.name}" title="Batalkan unggahan">
                        <i data-lucide="x"></i>
                    </button>
                    <div class="chip-progress-track">
                        <div class="chip-progress-bar"></div>
                    </div>
                </div>
            `;
        }).join('');

        imagePreviewTray.innerHTML = attachmentsHtml + loadingHtml;

        if (typeof lucide !== 'undefined') {
            lucide.createIcons({ attrs: { 'stroke-width': '1.8' } });
        }

        imagePreviewTray.querySelectorAll('.attachment-chip-remove:not(.loading-cancel)').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                removePendingAttachment(id);
                renderImagePreviews();
                adjustHeight();
                updateSendButtonState();
            });
        });

        imagePreviewTray.querySelectorAll('.loading-cancel').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                const target = processingFiles.find(item => item.id === id);
                if (target) target.cancelled = true;
                processingFiles = processingFiles.filter(item => item.id !== id);
                if (processingFiles.length === 0) {
                    btnAttach.classList.remove('uploading');
                }
                renderImagePreviews();
                adjustHeight();
                updateSendButtonState();
            });
        });
    }

    function submitMessage() {
        if (processingFiles.length > 0) return;
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
            processingFiles.forEach(item => { item.cancelled = true; });
            processingFiles = [];
            btnAttach.classList.remove('uploading');
            clearPendingAttachments();
            renderImagePreviews();
            btnSend.disabled = true;
        },
        focus: () => {
            if (!chatInput || chatInput.disabled) return;
            chatInput.focus();
            const len = chatInput.value.length;
            chatInput.setSelectionRange(len, len);
        },
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
