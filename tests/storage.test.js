import test from 'node:test';
import assert from 'node:assert/strict';
import { saveStateToStorage, loadStateFromStorage } from '../js/store/persister.js';
import { parseMarkdown } from '../js/utils/markdown.js';
import { validateFile } from '../js/utils/file-processor.js';

test('fallback persistence preserves all history without pruning or reordering input', async () => {
    const map = new Map();
    globalThis.localStorage = { setItem: (key, value) => map.set(key, value), getItem: key => map.get(key), removeItem: key => map.delete(key) };
    const chats = Array.from({ length: 60 }, (_, i) => ({ id: `chat-${i}`, messages: [{ content: 'text'.repeat(100) }] }));
    const data = { config: { provider: 'custom' }, chats };
    assert.equal(await saveStateToStorage(data), true);
    assert.deepEqual((await loadStateFromStorage()).chats, chats);
    assert.equal(data.chats.length, 60);
});
test('Markdown fails closed when sanitizer is missing', () => {
    globalThis.marked = { parse: () => '<img src=x onerror=alert(1)>' };
    const html = parseMarkdown('<img src=x onerror=alert(1)>');
    assert.ok(!html.includes('<img'));
    assert.ok(html.includes('&lt;img'));
    delete globalThis.marked;
});
test('unsupported binary and legacy office formats are rejected honestly', () => {
    for (const name of ['old.doc', 'old.ppt', 'old.xls', 'archive.rar', 'image.svg', 'run.exe']) {
        assert.equal(validateFile({ name, type: 'application/octet-stream', size: 20 }).valid, false);
    }
    assert.equal(validateFile({ name: 'code.php', type: '', size: 20 }).valid, true);
    assert.equal(validateFile({ name: 'big.pdf', type: 'application/pdf', size: 21 * 1024 * 1024 }).valid, false);
});
