import { test, expect } from '@playwright/test';

async function openScene(page) {
    await page.goto('/');
    await expect(page.locator('#chat-input')).toBeEnabled();
}
async function startScene(page) {
    await page.evaluate(async () => {
        window.scene = await import('/js/components/chat.js');
        window.scene.appendStreamingMessage('');
    });
}
async function output(page, text, meta) {
    await page.evaluate(({ text, meta }) => window.scene.updateStreamingMessage(text, meta), { text, meta });
}
async function finish(page, text, phase) {
    await page.evaluate(({ text, phase }) => window.scene.finalizeStreamingMessage(text, phase), { text, phase });
}

test('thinking signal, writing status and completion follow real output phases', async ({ page }) => {
    await openScene(page);
    await startScene(page);
    await expect(page.locator('.thinking-caption')).toHaveText('Menunggu respons model');
    await expect(page.locator('.generation-status-label')).toHaveText('Berpikir');
    expect(await page.locator('.thinking-signal span').first().evaluate(el => getComputedStyle(el).animationName)).toBe('thinkingWave');
    await output(page, 'Paragraf pertama');
    await expect(page.locator('.generation-status-label')).toHaveText('Menulis');
    await expect(page.locator('.thinking-indicator')).toHaveCount(0);
    await finish(page, 'Paragraf pertama selesai.');
    await expect(page.locator('[data-generation-phase=complete]')).toHaveAttribute('aria-busy', 'false');
    await expect(page.locator('.generation-status-label')).toHaveText('Selesai');
    await expect(page.locator('.streaming')).toHaveCount(0);
    await expect(page.locator('[data-stream-text]')).toHaveCount(0);
    await expect(page.locator('.assistant-actions')).toHaveCount(1);
});

test('existing paragraphs keep their DOM nodes while text and new blocks stream', async ({ page }) => {
    await openScene(page);
    await startScene(page);
    await output(page, 'Kalimat awal');
    await expect(page.locator('#current-stream p')).toHaveText('Kalimat awal');
    await page.evaluate(() => window.firstParagraph = document.querySelector('#current-stream p'));
    await output(page, 'Kalimat awal yang dilanjutkan.\n\nParagraf baru.');
    await expect(page.locator('#current-stream p')).toHaveText(['Kalimat awal yang dilanjutkan.', 'Paragraf baru.']);
    expect(await page.evaluate(() => window.firstParagraph === document.querySelector('#current-stream p'))).toBe(true);
    await finish(page, 'Kalimat awal yang dilanjutkan.\n\nParagraf baru.');
    expect(await page.evaluate(() => window.firstParagraph === document.querySelector('.message-content p'))).toBe(true);
});

test('reasoning disclosure stays closed when the next reasoning delta arrives', async ({ page }) => {
    await openScene(page);
    await startScene(page);
    await output(page, '<details open><summary>Penalaran</summary>Bagian awal</details>', { hasOutput: false, hasReasoning: true });
    await expect(page.locator('details')).toBeVisible();
    await expect(page.locator('.generation-status-label')).toHaveText('Berpikir');
    await page.locator('summary').click();
    await output(page, '<details open><summary>Penalaran</summary>Bagian awal dan lanjutan</details>', { hasOutput: false, hasReasoning: true });
    await expect(page.locator('details')).toContainText('lanjutan');
    expect(await page.locator('details').evaluate(el => el.open)).toBe(false);
});

test('reduced motion keeps output immediate and disables decorative loops', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openScene(page);
    await startScene(page);
    expect(await page.locator('.thinking-signal span').first().evaluate(el => getComputedStyle(el).animationName)).toBe('none');
    await output(page, 'Jawaban lengkap tanpa jeda buatan.');
    await expect(page.locator('#current-stream')).toContainText('Jawaban lengkap tanpa jeda buatan.');
    expect(await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length)).toBe(0);
    await finish(page, 'Jawaban lengkap tanpa jeda buatan.');
    await expect(page.locator('[data-stream-text]')).toHaveCount(0);
});

test('stop and error statuses are distinct and new streams contain no stale text', async ({ page }) => {
    await openScene(page);
    await startScene(page);
    await output(page, 'Teks parsial');
    await finish(page, 'Teks parsial', 'stopped');
    await expect(page.locator('.generation-status-label')).toHaveText('Dihentikan');
    await startScene(page);
    await expect(page.locator('#current-stream')).not.toContainText('Teks parsial');
    await finish(page, 'Koneksi gagal.', 'error');
    await expect(page.locator('[data-generation-phase=error]')).toHaveCount(1);
    await expect(page.locator('.generation-status-label').last()).toHaveText('Gagal');
});

test('auto-follow yields to the reader and jump-to-latest restores it', async ({ page }) => {
    await openScene(page);
    await startScene(page);
    let text = Array.from({ length: 35 }, (_, i) => `Paragraf ${i + 1}. Isi jawaban yang cukup panjang untuk membaca riwayat.`).join('\n\n');
    await output(page, text);
    await expect(page.locator('#current-stream p')).toHaveCount(35);
    await expect.poll(() => page.locator('#chat-canvas').evaluate(el => el.scrollHeight - el.clientHeight - el.scrollTop)).toBeLessThan(3);
    await page.locator('#chat-canvas').hover();
    await page.mouse.wheel(0, -700);
    await expect(page.locator('#btn-scroll-bottom')).toBeVisible();
    const before = await page.locator('#chat-canvas').evaluate(el => el.scrollTop);
    text += '\n\nBagian baru saat pengguna sedang membaca.';
    await output(page, text);
    await expect(page.locator('#current-stream')).toContainText('Bagian baru');
    const after = await page.locator('#chat-canvas').evaluate(el => el.scrollTop);
    expect(Math.abs(before - after)).toBeLessThan(8);
    await page.locator('#btn-scroll-bottom').click();
    await expect.poll(() => page.locator('#chat-canvas').evaluate(el => el.scrollHeight - el.clientHeight - el.scrollTop)).toBeLessThan(3);
});
