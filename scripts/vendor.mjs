import { copyFile, mkdir, cp } from 'node:fs/promises';
await mkdir('vendor', { recursive: true });
for (const [src, dest] of [
    ['marked/lib/marked.umd.js', 'marked.min.js'],
    ['dompurify/dist/purify.min.js', 'purify.min.js'],
    ['lucide/dist/umd/lucide.min.js', 'lucide.min.js'],
    ['jszip/dist/jszip.min.js', 'jszip.min.js'],
    ['pdfjs-dist/legacy/build/pdf.min.mjs', 'pdf.min.mjs'],
    ['pdfjs-dist/legacy/build/pdf.worker.min.mjs', 'pdf.worker.min.mjs'],
    ['html2pdf.js/dist/html2pdf.bundle.min.js', 'html2pdf.bundle.min.js'],
    ['dompurify/LICENSE', 'DOMPurify-LICENSE'],
    ['marked/LICENSE.md', 'Marked-LICENSE.md'],
    ['lucide/LICENSE', 'Lucide-LICENSE'],
    ['jszip/LICENSE.markdown', 'JSZip-LICENSE.md'],
    ['pdfjs-dist/LICENSE', 'PDFjs-LICENSE'],
    ['html2pdf.js/LICENSE', 'html2pdf-LICENSE']
]) await copyFile(`node_modules/${src}`, `vendor/${dest}`);

for (const dir of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) await cp(`node_modules/pdfjs-dist/${dir}`, `vendor/${dir}`, { recursive: true });
await import('./icons.mjs');
