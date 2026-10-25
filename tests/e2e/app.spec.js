import { test, expect } from '@playwright/test';
import JSZip from 'jszip';

async function setup(page, options = {}) {
    await page.addInitScript(({ provider, key }) => {
        if (sessionStorage.getItem('test-seeded')) return;
        sessionStorage.setItem('test-seeded', 'true');
        localStorage.setItem('ai_workspace_data', JSON.stringify({ config: { provider, apiKey: key, apiKeys: { [provider]: key }, customBaseUrls: {}, providerModels: {} }, selectedModel: provider === 'custom' ? 'test-model' : 'google/gemini-2.5-flash', chats: [] }));
    }, { provider: options.provider || 'custom', key: options.key || '' });
    await page.route('**/models', route => route.fulfill({ json: { data: [{ id: 'test-model', name: 'Test Model' }, { id: 'other-model', name: '<img src=x onerror=alert(1)>' }] } }));
    const content = '## Jawaban\n\nHalo **Mufaddhol**.\n\n```js:contoh.js\nconsole.log(1);\n```\n\n| A | B |\n|---|---|\n| 1 | 2 |';
    await page.route('**/chat/completions', route => route.fulfill({ contentType: 'text/event-stream', body: `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\ndata: [DONE]\n\n` }));
    await page.goto('/');
    await expect(page.locator('#chat-input')).toBeEnabled();
    await expect(page.locator('#active-model-name')).toHaveText(/test-model|Gemini|Fish/);
}
async function openSettings(page) { await page.locator('#btn-open-settings-prompt').click(); await expect(page.locator('#settings-modal')).toBeVisible(); }
async function closeSettings(page) { await page.locator('#btn-close-modal').click(); await expect(page.locator('#settings-modal')).not.toBeVisible(); }
async function openSidebar(page) { if (await page.locator('#btn-open-sidebar').isVisible()) await page.locator('#btn-open-sidebar').click(); }
async function send(page, text = 'Halo dunia') { await page.locator('#chat-input').fill(text); await page.locator('#btn-send').click(); }
async function waitResponse(page) { await expect(page.locator('.message-wrapper.assistant')).toContainText('Halo Mufaddhol'); await expect(page.locator('#btn-send')).toHaveAttribute('aria-label', 'Kirim Pesan'); }

test('boots without JavaScript errors or external startup requests', async ({ page }) => {
    const errors = [], external = [];
    page.on('pageerror', err => errors.push(err.message));
    page.on('request', req => { if (!req.url().startsWith('http://127.0.0.1:8080')) external.push(req.url()); });
    await setup(page);
    await expect(page.locator('.hero-title')).toBeVisible();
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
    expect(await page.locator('script[src*="pdf"],script[src*="jszip"]').count()).toBe(0);
});

test('provider switching isolates endpoint, key and model; manual model works', async ({ page }) => {
    await setup(page);
    await openSettings(page);
    await page.locator('#modal-provider').selectOption('ollama');
    await expect(page.locator('#modal-base-url')).toHaveValue('http://localhost:11434/v1');
    await page.locator('#modal-base-url').fill('http://127.0.0.1:1111/v1');
    await page.locator('#modal-base-url').press('Tab');
    await page.locator('#modal-api-key').fill('local-test');
    await page.locator('#modal-provider').selectOption('groq');
    await expect(page.locator('#modal-base-url')).toHaveValue('https://api.groq.com/openai/v1');
    await expect(page.locator('#modal-api-key')).toHaveValue('');
    await page.locator('#modal-provider').selectOption('ollama');
    await expect(page.locator('#modal-base-url')).toHaveValue('http://127.0.0.1:1111/v1');
    await expect(page.locator('#modal-api-key')).toHaveValue('local-test');
    await page.locator('#modal-model-id').fill('my-local-model');
    await page.locator('#btn-use-model-id').click();
    await closeSettings(page);
    await expect(page.locator('#active-model-name')).toHaveText('my-local-model');
    await page.reload();
    await expect(page.locator('#active-model-name')).toHaveText('my-local-model');
});

test('missing key preserves draft text and attachments', async ({ page }) => {
    await setup(page, { provider: 'openrouter' });
    await page.locator('#file-input').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('Catatan penting') });
    await expect(page.locator('.attachment-chip:not(.loading-chip)')).toHaveCount(1);
    await send(page, 'Ringkas catatan ini');
    await expect(page.locator('#settings-modal')).toBeVisible();
    await closeSettings(page);
    await expect(page.locator('#chat-input')).toHaveValue('Ringkas catatan ini');
    await expect(page.locator('.attachment-chip')).toHaveCount(1);
    await expect(page.locator('.message-wrapper')).toHaveCount(0);
});

test('attachment removal uses ID, sends remaining files and clears previews', async ({ page }) => {
    await setup(page);
    let request;
    page.on('request', req => { if (req.url().endsWith('/chat/completions')) request = req.postDataJSON(); });
    await page.locator('#file-input').setInputFiles(['A', 'B', 'C'].map(name => ({ name: `${name}.txt`, mimeType: 'text/plain', buffer: Buffer.from(`isi-${name}`) })));
    await expect(page.locator('.attachment-chip:not(.loading-chip)')).toHaveCount(3);
    await page.getByRole('button', { name: 'Hapus B.txt', exact: true }).click();
    await expect(page.locator('.attachment-chip')).toHaveCount(2);
    await expect(page.locator('#image-preview-tray')).toContainText('A.txt');
    await expect(page.locator('#image-preview-tray')).toContainText('C.txt');
    await send(page);
    await waitResponse(page);
    expect(JSON.stringify(request)).toContain('isi-A');
    expect(JSON.stringify(request)).toContain('isi-C');
    expect(JSON.stringify(request)).not.toContain('isi-B');
    await expect(page.locator('#image-preview-tray')).not.toBeVisible();
    await page.reload();
    await expect(page.locator('.msg-file-name')).toHaveText(['A.txt', 'C.txt']);
});

test('streamed Markdown completes with code download, table and persistent history', async ({ page }) => {
    await setup(page);
    await send(page);
    await waitResponse(page);
    await expect(page.locator('.message-content table')).toHaveCount(1);
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download File', exact: true }).click();
    expect((await downloadPromise).suggestedFilename()).toBe('contoh.js');
    await page.reload();
    await expect(page.locator('.message-wrapper')).toHaveCount(2);
    await expect(page.locator('.assistant-actions')).toHaveCount(1);
});

test('stream survives delayed chunks; stop then immediate send ignores old callbacks', async ({ page }) => {
    await setup(page);
    await page.evaluate(() => {
        const original = window.fetch;
        window.fetch = (url, init) => {
            if (!String(url).endsWith('/chat/completions')) return original(url, init);
            const encoder = new TextEncoder();
            const isSecond = JSON.parse(init.body).messages.at(-1).content.includes('kedua');
            const first = isSecond ? 'Respons kedua' : 'Bagian pertama';
            let timer;
            const stream = new ReadableStream({ start(c) {
                c.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: first } }] })}\n\n`));
                timer = setTimeout(() => {
                    c.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":" selesai"}}]}\n\ndata: [DONE]\n\n'));
                    c.close();
                }, isSecond ? 300 : 1600);
            }, cancel() { clearTimeout(timer); } });
            return Promise.resolve(new Response(stream));
        };
    });
    await send(page, 'pertama');
    await expect(page.locator('#current-stream')).toContainText('Bagian pertama');
    await page.waitForTimeout(300);
    await expect(page.locator('#current-stream')).toBeVisible();
    await page.locator('#btn-send').click();
    await send(page, 'kedua');
    await expect(page.locator('.message-wrapper.assistant').last()).toContainText('Respons kedua selesai');
    await expect(page.locator('#chat-input')).toBeEnabled();
    await expect(page.locator('.streaming')).toHaveCount(0);
});

test('selecting, pinning and deleting chats preserve the active conversation', async ({ page }) => {
    await setup(page);
    await send(page);
    await waitResponse(page);
    await openSidebar(page);
    await page.locator('.pin-btn').first().click();
    await expect(page.locator('#pinned-chats-list .chat-item')).toHaveCount(1);
    await page.locator('#btn-new-chat').click();
    await expect(page.locator('.hero-title')).toBeVisible();
    await openSidebar(page);
    await page.locator('#pinned-chats-list .chat-title').click();
    await expect(page.locator('.message-wrapper')).toHaveCount(2);
    await openSidebar(page);
    await page.locator('#pinned-chats-list .delete-btn').click();
    await page.locator('#confirm-modal-btn-confirm').click();
    // Close the mobile navigation to inspect the active empty chat.
    if (await page.locator('#sidebar').evaluate(el => el.classList.contains('open'))) await page.locator('#btn-collapse-sidebar').click();
    await expect(page.locator('.hero-title')).toBeVisible();
});

test('memory and model metadata are rendered as text; Markdown XSS is sanitized', async ({ page }) => {
    await setup(page);
    await openSettings(page);
    await page.locator('#tab-memory').click();
    await page.locator('#input-new-memory').fill('<img src=x onerror="window.pwned=1">');
    await page.locator('#btn-add-memory').click();
    await expect(page.locator('.memory-text')).toContainText('<img');
    expect(await page.locator('.memory-text img').count()).toBe(0);
    await closeSettings(page);
    await page.route('**/chat/completions', route => route.fulfill({ contentType: 'text/event-stream', body: `data: ${JSON.stringify({ choices: [{ delta: { content: '<img src=x onerror="window.pwned=1"><script>window.pwned=1</script>[klik](javascript:alert(1))' } }] })}\n\ndata: [DONE]\n\n` }));
    await send(page);
    await expect(page.locator('#btn-send')).toHaveAttribute('aria-label', 'Kirim Pesan');
    expect(await page.evaluate(() => window.pwned)).toBeUndefined();
    expect(await page.locator('.message-content [onerror], .message-content script, .message-content a[href^="javascript:"]').count()).toBe(0);
});

test('credentials pasted into ordinary chat never reach requests or history', async ({ page }) => {
    await setup(page);
    let posted = false;
    page.on('request', req => { if (req.url().endsWith('/chat/completions')) posted = true; });
    await send(page, 'OPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz012345678901234567890');
    await expect(page.locator('#settings-modal')).toBeVisible();
    expect(posted).toBe(false);
    await closeSettings(page);
    await expect(page.locator('.message-wrapper')).toHaveCount(0);
});

test('old interrupted request is marked on reload and storage migration preserves it', async ({ page }) => {
    await page.addInitScript(() => {
        if (sessionStorage.getItem('seed')) return;
        sessionStorage.setItem('seed', 'true');
        localStorage.setItem('ai_workspace_data', JSON.stringify({ config: { provider: 'custom' }, chats: [{ id: 'c1', title: 'Lama', messages: [{ id: 'u1', role: 'user', content: 'Pertanyaan' }, { id: 'a1', role: 'assistant', content: 'Sebagian jawaban' }] }], currentChatId: 'c1', activeStream: { chatId: 'c1', messageId: 'a1' } }));
    });
    await page.goto('/');
    await expect(page.locator('.message-wrapper.assistant')).toContainText('Respons terputus');
    await page.reload();
    await expect(page.locator('.message-wrapper.assistant')).toContainText('Sebagian jawaban');
    expect(await page.evaluate(() => localStorage.getItem('ai_workspace_data'))).toBeNull();
});

test('Office readers extract text and structured cells with local lazy dependencies', async ({ page }) => {
    await setup(page);
    const doc = new JSZip(); doc.file('word/document.xml', '<w:document xmlns:w="w"><w:p><w:r><w:t>Paragraf DOCX</w:t></w:r></w:p></w:document>');
    const ppt = new JSZip(); ppt.file('ppt/slides/slide1.xml', '<p:sld xmlns:p="p" xmlns:a="a"><a:p><a:r><a:t>Judul PPTX</a:t></a:r></a:p></p:sld>');
    const xls = new JSZip(); xls.file('xl/sharedStrings.xml', '<sst><si><t>Nama</t></si></sst>'); xls.file('xl/worksheets/sheet1.xml', '<worksheet><sheetData><row r="1"><c r="A1" s="1" t="s"><v>0</v></c><c r="C1" t="inlineStr"><is><t>Nilai</t></is></c><c r="D1"><v>42</v></c></row></sheetData></worksheet>');
    await page.locator('#file-input').setInputFiles(await Promise.all([['test.docx', doc], ['test.pptx', ppt], ['test.xlsx', xls]].map(async ([name, zip]) => ({ name, mimeType: 'application/octet-stream', buffer: await zip.generateAsync({ type: 'nodebuffer' }) }))));
    await expect(page.locator('.attachment-chip:not(.loading-chip)')).toHaveCount(3);
    const texts = await page.evaluate(async () => (await import('/js/store/index.js')).state.pendingAttachments.map(a => a.textContent));
    expect(texts[0]).toContain('Paragraf DOCX');
    expect(texts[1]).toContain('Judul PPTX');
    expect(texts[2]).toContain('Nama');
    expect(texts[2]).toContain('Nilai');
    expect(texts[2]).toContain('42');
});

test('responsive layout keeps composer and settings inside viewport', async ({ page }) => {
    await setup(page);
    for (const width of [320, 390, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 800 });
        await expect(page.locator('#chat-input')).toBeInViewport();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
        expect(overflow, `horizontal overflow at ${width}px`).toBe(false);
        await openSettings(page);
        const box = await page.locator('#settings-modal').boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
        await closeSettings(page);
    }
    await send(page);
    await waitResponse(page);
    await page.setViewportSize({ width: 320, height: 568 });
    await expect(page.locator('#chat-input')).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test('PDF reader extracts a local PDF using its worker', async ({ page }) => {
    await setup(page);
    const stream = 'BT /F1 18 Tf 40 100 Td (Isi PDF pengujian) Tj ET';
    const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    objects.forEach((obj, i) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`; });
    const xref = Buffer.byteLength(pdf);
    pdf += 'xref\n0 6\n0000000000 65535 f \n' + offsets.slice(1).map(n => `${String(n).padStart(10, '0')} 00000 n \n`).join('') + `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    await page.locator('#file-input').setInputFiles({ name: 'test.pdf', mimeType: 'application/pdf', buffer: Buffer.from(pdf) });
    await expect(page.locator('.attachment-chip:not(.loading-chip)')).toHaveCount(1);
    const text = await page.evaluate(async () => (await import('/js/store/index.js')).state.pendingAttachments[0].textContent);
    expect(text).toContain('Isi PDF pengujian');
});

test('PDF and Markdown exports produce downloadable files', async ({ page }) => {
    await setup(page);
    await send(page);
    await waitResponse(page);
    const mdPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download (.md)', exact: true }).click();
    expect((await mdPromise).suggestedFilename()).toMatch(/\.md$/);
    const pdfPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download PDF (.pdf)', exact: true }).click();
    const pdf = await pdfPromise;
    expect(pdf.suggestedFilename()).toMatch(/\.pdf$/);
    const bytes = [];
    for await (const chunk of await pdf.createReadStream()) bytes.push(chunk);
    expect(Buffer.concat(bytes).subarray(0, 5).toString()).toBe('%PDF-');
});

test('theme, language, settings keyboard tabs and mobile navigation remain usable', async ({ page }) => {
    await setup(page);
    await page.locator('#btn-quick-theme').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await openSettings(page);
    await page.locator('#tab-appearance').click();
    await page.locator('[data-lang=en]').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('.hero-title')).toHaveText('What would you like to work on?');
    await page.locator('#tab-appearance').press('ArrowRight');
    await expect(page.locator('#tab-api')).toHaveAttribute('aria-selected', 'true');
    await closeSettings(page);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#btn-open-sidebar').click();
    await expect(page.locator('#sidebar')).toHaveClass(/open/);
    await page.keyboard.press('Escape');
    await expect(page.locator('#sidebar')).not.toHaveClass(/open/);
});

test('editing a prompt replaces its old answer and keeps the revised history', async ({ page }) => {
    await setup(page);
    await send(page);
    await waitResponse(page);
    await page.locator('.user-actions .user-edit-btn').click();
    await page.locator('.user-edit-textarea').fill('Pertanyaan yang diperbaiki');
    await page.locator('.btn-submit-edit').click();
    await waitResponse(page);
    await expect(page.locator('.message-wrapper')).toHaveCount(2);
    await expect(page.locator('.message-wrapper.user')).toContainText('Pertanyaan yang diperbaiki');
    await page.reload();
    await expect(page.locator('.message-wrapper.user')).toContainText('Pertanyaan yang diperbaiki');
});

test('Fish Audio sends text once and exposes audio controls plus download', async ({ page }) => {
    await setup(page, { provider: 'fish_audio', key: 'test-fish-key' });
    let calls = 0;
    await page.route('https://api.fish.audio/v1/tts', route => {
        calls++;
        expect(route.request().postDataJSON().text).toBe('Halo dunia');
        return route.fulfill({ contentType: 'audio/mpeg', body: Buffer.from('test-audio') });
    });
    await send(page, '/tts Halo dunia');
    await expect(page.locator('audio')).toHaveCount(1);
    const download = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Unduh audio' }).click();
    expect((await download).suggestedFilename()).toBe('audio.mp3');
    expect(calls).toBe(1);
});
