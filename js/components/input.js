import { getPendingAttachments, clearPendingAttachments, addPendingAttachment, removePendingAttachmentById } from '../store/index.js';
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

        const fragment = document.createDocumentFragment();

        // Render completed attachments (DOM construction - no innerHTML for user data)
        attachments.forEach(item => {
            const chip = document.createElement('div');
            chip.className = `attachment-chip ${item.category === 'image' || item.type?.startsWith('image/') ? 'image-chip' : `file-chip ${item.category || 'text'}`}`;
            chip.dataset.id = item.id;
            chip.title = item.name || '';

            if (item.category === 'image' || item.type?.startsWith('image/')) {
                const thumbWrap = document.createElement('div');
                thumbWrap.className = 'attachment-thumb-wrap';
                const img = document.createElement('img');
                img.src = item.data || '';
                img.alt = item.name || '';
                img.className = 'attachment-thumb';
                thumbWrap.appendChild(img);

                const info = document.createElement('div');
                info.className = 'attachment-chip-info';
                const nameSpan = document.createElement('span');
                nameSpan.className = 'attachment-chip-name';
                nameSpan.textContent = item.name || '';
                const metaSpan = document.createElement('span');
                metaSpan.className = 'attachment-chip-meta';
                metaSpan.textContent = item.sizeFormatted || 'Gambar';
                info.appendChild(nameSpan);
                info.appendChild(metaSpan);

                const removeBtn = document.createElement('button');
                removeBtn.className = 'attachment-chip-remove';
                removeBtn.dataset.id = item.id;
                removeBtn.type = 'button';
                removeBtn.setAttribute('aria-label', `Hapus ${item.name || ''}`);
                removeBtn.title = 'Hapus berkas';
                const xIcon = document.createElement('i');
                xIcon.dataset.lucide = 'x';
                removeBtn.appendChild(xIcon);

                chip.appendChild(thumbWrap);
                chip.appendChild(info);
                chip.appendChild(removeBtn);
            } else {
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

                const iconBadge = document.createElement('div');
                iconBadge.className = `attachment-icon-badge ${item.category || 'text'}`;
                const lucideIcon = document.createElement('i');
                lucideIcon.dataset.lucide = icon;
                iconBadge.appendChild(lucideIcon);

                const info = document.createElement('div');
                info.className = 'attachment-chip-info';
                const nameSpan = document.createElement('span');
                nameSpan.className = 'attachment-chip-name';
                nameSpan.textContent = item.name || '';
                const metaSpan = document.createElement('span');
                metaSpan.className = 'attachment-chip-meta';

                let metaText = item.sizeFormatted || '';
                if (item.pageCount) {
                    metaText += ` • ${item.pageCount} Hal`;
                } else if (item.slideCount) {
                    metaText += ` • ${item.slideCount} Slide`;
                } else if (item.ext) {
                    metaText += ` • ${item.ext.toUpperCase()}`;
                }
                metaSpan.textContent = metaText;
                info.appendChild(nameSpan);
                info.appendChild(metaSpan);

                const removeBtn = document.createElement('button');
                removeBtn.className = 'attachment-chip-remove';
                removeBtn.dataset.id = item.id;
                removeBtn.type = 'button';
                removeBtn.setAttribute('aria-label', `Hapus ${item.name || ''}`);
                removeBtn.title = 'Hapus berkas';
                const xIcon = document.createElement('i');
                xIcon.dataset.lucide = 'x';
                removeBtn.appendChild(xIcon);

                chip.appendChild(iconBadge);
                chip.appendChild(info);
                chip.appendChild(removeBtn);
            }
            fragment.appendChild(chip);
        });

        // Render actively processing/uploading files
        processingFiles.forEach(item => {
            const cat = item.category || 'text';
            const chip = document.createElement('div');
            chip.className = `attachment-chip loading-chip ${cat}`;
            chip.dataset.id = item.id;
            chip.title = `Memproses ${item.name || ''}...`;

            const iconBadge = document.createElement('div');
            iconBadge.className = `attachment-icon-badge loading ${cat}`;
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.classList.add('loading-spinner-svg');
            svg.setAttribute('viewBox', '0 0 24 24');
            svg.setAttribute('fill', 'none');
            svg.setAttribute('stroke', 'currentColor');
            const track = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            track.classList.add('spinner-track');
            track.setAttribute('cx', '12');
            track.setAttribute('cy', '12');
            track.setAttribute('r', '9');
            track.setAttribute('stroke-width', '2.5');
            const head = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            head.classList.add('spinner-head');
            head.setAttribute('cx', '12');
            head.setAttribute('cy', '12');
            head.setAttribute('r', '9');
            head.setAttribute('stroke-width', '2.5');
            head.setAttribute('stroke-dasharray', '24 38');
            head.setAttribute('stroke-linecap', 'round');
            svg.appendChild(track);
            svg.appendChild(head);
            iconBadge.appendChild(svg);

            const info = document.createElement('div');
            info.className = 'attachment-chip-info';
            const nameSpan = document.createElement('span');
            nameSpan.className = 'attachment-chip-name';
            nameSpan.textContent = item.name || '';
            const metaSpan = document.createElement('span');
            metaSpan.className = 'attachment-chip-meta loading-meta';
            const pulseDot = document.createElement('span');
            pulseDot.className = 'loading-pulse-dot';
            const metaText = document.createElement('span');
            metaText.className = 'loading-meta-text';
            metaText.textContent = `Memproses ${item.sizeFormatted || ''}...`;
            metaSpan.appendChild(pulseDot);
            metaSpan.appendChild(metaText);
            info.appendChild(nameSpan);
            info.appendChild(metaSpan);

            const removeBtn = document.createElement('button');
            removeBtn.className = 'attachment-chip-remove loading-cancel';
            removeBtn.dataset.id = item.id;
            removeBtn.type = 'button';
            removeBtn.setAttribute('aria-label', `Batal ${item.name || ''}`);
            removeBtn.title = 'Batalkan unggahan';
            const xIcon = document.createElement('i');
            xIcon.dataset.lucide = 'x';
            removeBtn.appendChild(xIcon);

            const progressTrack = document.createElement('div');
            progressTrack.className = 'chip-progress-track';
            const progressBar = document.createElement('div');
            progressBar.className = 'chip-progress-bar';
            progressTrack.appendChild(progressBar);

            chip.appendChild(iconBadge);
            chip.appendChild(info);
            chip.appendChild(removeBtn);
            chip.appendChild(progressTrack);
            fragment.appendChild(chip);
        });

        imagePreviewTray.innerHTML = '';
        imagePreviewTray.appendChild(fragment);

        if (typeof lucide !== 'undefined') {
            lucide.createIcons({ attrs: { 'stroke-width': '1.8' } });
        }

        imagePreviewTray.querySelectorAll('.attachment-chip-remove:not(.loading-cancel)').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                removePendingAttachmentById(id);
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
        // Catatan: pendingAttachments tidak dikosongkan di sini.
        // Input layer hanya melepas tampilan; aplikasi yang memutuskan
        // apakah lampiran benar-benar dipakai (lihat handler di app.js).
        // Jika aplikasi menolak (misal API key kosong), state tetap utuh
        // sehingga pengguna tidak perlu unggah ulang.
        renderImagePreviews();

        onSendMessage(text, attachments, { webSearch: isWebSearchActive }, {
            clearAttachments: () => clearPendingAttachments()
        });
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
