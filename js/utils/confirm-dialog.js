export function showConfirmDialog({
    title = 'Hapus Chat?',
    message = 'Chat ini akan dihapus permanen dari riwayat.',
    confirmText = 'Hapus',
    cancelText = 'Batal',
    type = 'danger',
    icon = 'trash-2'
} = {}) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirm-modal');
        if (!modal) {
            resolve(window.confirm(`${title}\n${message}`));
            return;
        }

        const titleEl = document.getElementById('confirm-modal-title');
        const msgEl = document.getElementById('confirm-modal-message');
        const iconWrap = document.getElementById('confirm-modal-icon');
        const btnCancel = document.getElementById('confirm-modal-btn-cancel');
        const btnConfirm = document.getElementById('confirm-modal-btn-confirm');

        if (titleEl) titleEl.textContent = title;
        if (msgEl) msgEl.textContent = message;
        if (btnCancel) btnCancel.textContent = cancelText;
        if (btnConfirm) {
            btnConfirm.textContent = confirmText;
            btnConfirm.className = `btn-confirm ${type === 'primary' ? 'primary' : 'danger'}`;
        }

        if (iconWrap) {
            iconWrap.className = `confirm-modal-icon-wrap ${type}`;
            iconWrap.innerHTML = `<i data-lucide="${icon}"></i>`;
            if (typeof lucide !== 'undefined') {
                lucide.createIcons({ attrs: { 'stroke-width': '2' } });
            }
        }

        let isResolved = false;

        const cleanup = () => {
            btnConfirm?.removeEventListener('click', handleConfirm);
            btnCancel?.removeEventListener('click', handleCancel);
            modal.removeEventListener('cancel', handleCancel);
            modal.removeEventListener('click', handleBackdrop);
        };

        const handleConfirm = () => {
            if (isResolved) return;
            isResolved = true;
            cleanup();
            modal.close();
            resolve(true);
        };

        const handleCancel = () => {
            if (isResolved) return;
            isResolved = true;
            cleanup();
            modal.close();
            resolve(false);
        };

        const handleBackdrop = (e) => {
            if (e.target === modal) {
                handleCancel();
            }
        };

        btnConfirm?.addEventListener('click', handleConfirm);
        btnCancel?.addEventListener('click', handleCancel);
        modal.addEventListener('cancel', handleCancel);
        modal.addEventListener('click', handleBackdrop);

        modal.showModal();
        btnCancel?.focus();
    });
}
