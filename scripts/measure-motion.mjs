import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

// Local synthetic streaming benchmark. This samples rAF cadence, not physical
// display/GPU throughput; real devices and provider latency can differ.
const server = spawn(process.execPath, ['scripts/serve.mjs'], { env: { ...process.env, PORT: '8091' }, stdio: ['ignore', 'pipe', 'inherit'] });
let browser;
try {
    await once(server.stdout, 'data');
    browser = await chromium.launch({ headless: true });
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
        const page = await browser.newPage({ viewport, locale: 'id-ID' });
        await page.goto('http://127.0.0.1:8091');
        await page.locator('#chat-input').waitFor();
        const result = await page.evaluate(async () => {
            const chat = await import('/js/components/chat.js');
            chat.appendStreamingMessage('');
            const frames = [], tasks = [];
            let previous, sampling = true;
            const sample = time => {
                if (previous) frames.push(time - previous);
                previous = time;
                if (sampling) requestAnimationFrame(sample);
            };
            const observer = new PerformanceObserver(list => tasks.push(...list.getEntries().map(entry => entry.duration)));
            observer.observe({ type: 'longtask', buffered: false });
            requestAnimationFrame(sample);
            await new Promise(resolve => setTimeout(resolve, 500));
            let text = '';
            for (let i = 0; i < 70; i++) {
                text += i % 7 === 0 ? `\n\n### Tahap ${i / 7 + 1}\n\n` : 'Output bertahap dengan **teks tebal**, tautan [referensi](https://example.com), dan isi yang tetap stabil. ';
                chat.updateStreamingMessage(text);
                await new Promise(resolve => setTimeout(resolve, 55));
            }
            chat.finalizeStreamingMessage(text);
            await new Promise(resolve => setTimeout(resolve, 250));
            sampling = false;
            observer.disconnect();
            frames.sort((a, b) => a - b);
            const sum = frames.reduce((a, b) => a + b, 0);
            return {
                samples: frames.length,
                meanRafFps: Number((frames.length * 1000 / sum).toFixed(1)),
                p95FrameMs: Number(frames[Math.floor(frames.length * .95)].toFixed(2)),
                maxFrameMs: Number(frames.at(-1).toFixed(2)),
                longTasksOver50ms: tasks.length,
                longestTaskMs: Math.round(Math.max(0, ...tasks)),
                outputCharacters: text.length,
                danglingTextRuns: document.querySelectorAll('[data-stream-text]').length
            };
        });
        console.log(JSON.stringify({ viewport, ...result }));
        await page.close();
    }
} finally {
    await browser?.close();
    server.kill();
}
