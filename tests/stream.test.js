import test from 'node:test';
import assert from 'node:assert/strict';
import { createSSEParser } from '../js/api/stream-parser.js';
import { streamChat, resolveBaseUrl } from '../js/api/provider.js';

const event = (content, newline = '\n') => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}${newline}${newline}`;
test('SSE preserves every token across every possible chunk boundary and mixed newlines', () => {
    const input = event('Halo 👋', '\r\n') + event(' dunia') + 'data: [DONE]\n\n' + event('ignored');
    for (let split = 0; split <= input.length; split++) {
        const parser = createSSEParser();
        let text = '', done = 0;
        const delta = content => text += content;
        const finish = () => done++;
        parser.feed(input.slice(0, split), delta, finish);
        parser.feed(input.slice(split), delta, finish);
        parser.flush(delta, finish);
        assert.equal(text, 'Halo 👋 dunia');
        assert.equal(done, 1);
    }
});
test('Anthropic deltas, reasoning and trailing event without delimiter', () => {
    const parser = createSSEParser();
    const output = [];
    const input = 'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"thinking":"hmm"}}\n\n' + 'data: {"type":"content_block_delta","delta":{"text":"answer"}}';
    for (const char of input) parser.feed(char, (text, meta) => output.push({ text, ...meta }));
    parser.flush((text, meta) => output.push({ text, ...meta }));
    assert.equal(output[0].reasoning, 'hmm');
    assert.equal(output[1].text, 'answer');
});
test('stream errors and malformed complete events surface instead of disappearing', () => {
    assert.throws(() => createSSEParser().feed('data: {"error":{"message":"quota exceeded"}}\n\n'), /quota exceeded/);
    assert.throws(() => createSSEParser().feed('data: {broken}\n\n'), /tidak valid/);
    assert.throws(() => createSSEParser().feed(event('hi'), () => { throw new Error('callback'); }), /callback/);
});
test('base URLs cannot inherit another provider or accept unsafe schemes', () => {
    assert.equal(resolveBaseUrl('groq'), 'https://api.groq.com/openai/v1');
    assert.equal(resolveBaseUrl('ollama'), 'http://localhost:11434/v1');
    assert.equal(resolveBaseUrl('custom', 'https://example.com/v1/chat/completions/'), 'https://example.com/v1');
    for (const url of ['javascript:alert(1)', 'https://user:pass@host/v1', 'https://host/v1?key=secret']) assert.throws(() => resolveBaseUrl('custom', url));
});
test('request uses selected endpoint, optional local key, correct web tool and UTF-8 stream', async t => {
    const calls = [];
    const bytes = new TextEncoder().encode(event('Siap ✅') + 'data: [DONE]\n\n');
    t.mock.method(globalThis, 'fetch', async (url, init) => {
        calls.push({ url, init });
        let index = 0;
        return new Response(new ReadableStream({ pull(controller) { if (index < bytes.length) controller.enqueue(bytes.slice(index, ++index)); else controller.close(); } }));
    });
    let result;
    await streamChat([{ role: 'user', content: 'halo' }], 'ollama', '', 'local-model', () => {}, text => result = text, err => assert.fail(err));
    assert.equal(result, 'Siap ✅');
    assert.equal(calls[0].url, 'http://localhost:11434/v1/chat/completions');
    assert.equal(calls[0].init.headers.Authorization, undefined);
    globalThis.window = { location: { href: 'http://localhost' } };
    await streamChat([], 'openrouter', 'test', 'model', () => {}, () => {}, assert.fail, { webSearch: true });
    assert.deepEqual(JSON.parse(calls[1].init.body).tools, [{ type: 'openrouter:web_search' }]);
    delete globalThis.window;
});
test('midstream API failure is not reported as success', async t => {
    t.mock.method(globalThis, 'fetch', async () => new Response('data: {"error":{"message":"overloaded"}}\n\n'));
    let error;
    await streamChat([], 'custom', '', 'test', () => {}, () => assert.fail('unexpected completion'), err => error = err);
    assert.match(error, /overloaded/);
});

test('OpenAI reasoning requests omit unsupported sampling and use completion token budget', async t => {
    let payload;
    t.mock.method(globalThis, 'fetch', async (_, init) => {
        payload = JSON.parse(init.body);
        return new Response(JSON.stringify({ choices: [{ message: { content: 'Siap' } }] }), { headers: { 'content-type': 'application/json' } });
    });
    let result;
    await streamChat([], 'openai', 'test-key', 'o3', () => {}, text => result = text, assert.fail, { temperature: 0.5, maxTokens: 4096 });
    assert.equal(payload.max_completion_tokens, 4096);
    assert.equal(payload.max_tokens, undefined);
    assert.equal(payload.temperature, undefined);
    assert.equal(result, 'Siap');
});

test('stream phase metadata distinguishes reasoning from visible answer text', async t => {
    const events = [
        { reasoning_content: 'Menganalisis konteks' },
        { content: 'Jawaban yang siap dibaca' }
    ].map(delta => `data: ${JSON.stringify({ choices: [{ delta }] })}\n\n`).join('');
    t.mock.method(globalThis, 'fetch', async () => new Response(events + 'data: [DONE]\n\n'));
    const phases = [];
    await streamChat([], 'custom', '', 'test', (_, meta) => phases.push(meta), () => {}, assert.fail);
    assert.deepEqual(phases, [
        { hasOutput: false, hasReasoning: true },
        { hasOutput: true, hasReasoning: true }
    ]);
});
