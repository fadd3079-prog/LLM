const scripts = new Map();
export function loadScript(src) {
    if (!scripts.has(src)) scripts.set(src, new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = () => { scripts.delete(src); script.remove(); reject(new Error('Gagal memuat pembaca berkas. Periksa koneksi lalu coba lagi.')); };
        document.head.appendChild(script);
    }));
    return scripts.get(src);
}
export async function ensureZip() {
    if (!window.JSZip) await loadScript('vendor/jszip.min.js');
    return window.JSZip;
}
export async function ensurePdf() {
    if (!window.pdfjsLib) window.pdfjsLib = await import('../../vendor/pdf.min.mjs');
    return window.pdfjsLib;
}
