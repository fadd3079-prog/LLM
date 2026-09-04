export function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    // Bersihkan toast sebelumnya agar tampilan tetap minimalis dan tidak menumpuk
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: 'check',
        error: 'alert-circle',
        info: 'info',
        warning: 'alert-triangle'
    };

    const icon = document.createElement('i');
    icon.dataset.lucide = icons[type] || 'info';
    const span = document.createElement('span');
    span.textContent = message;
    toast.appendChild(icon);
    toast.appendChild(span);
    container.appendChild(toast);

    if (typeof lucide !== 'undefined') {
        lucide.createIcons({ attrs: { 'stroke-width': '2' } });
    }

    // Dismiss halus setelah 2.2 detik
    setTimeout(() => {
        toast.style.animation = 'toastDropOut 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards';
        setTimeout(() => {
            if (toast.parentElement === container) {
                container.removeChild(toast);
            }
        }, 220);
    }, 2200);
}