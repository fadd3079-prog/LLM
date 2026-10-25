// One parser per request: network chunks are not event boundaries.
export function createSSEParser() {
    let buffer = '';
    let finished = false;
    function processEvent(raw, onDelta, onDone) {
        const payload = raw.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).replace(/^ /, '')).join('\n');
        if (!payload.trim()) return;
        if (payload.trim() === '[DONE]') { finished = true; onDone?.(); return; }
        let parsed;
        try { parsed = JSON.parse(payload); }
        catch { throw new Error('Respons streaming tidak valid atau terpotong. Coba kirim ulang.'); }
        if (parsed.error || parsed.type === 'error') throw new Error(parsed.error?.message || 'Provider menghentikan streaming.');
        if (parsed.type === 'message_stop') { finished = true; onDone?.(); return; }
        const delta = parsed.choices?.[0]?.delta || {};
        const content = parsed.type === 'content_block_delta' ? parsed.delta?.text || '' : delta.content || '';
        const reasoning = parsed.delta?.thinking || delta.reasoning_content || delta.reasoning || '';
        const citations = [...(Array.isArray(parsed.citations) ? parsed.citations : []), ...(Array.isArray(delta.annotations) ? delta.annotations.map(a => a.url_citation?.url).filter(Boolean) : [])];
        if (typeof content === 'string' && (content || reasoning || citations.length)) onDelta?.(content, { reasoning, citations });
    }
    return {
        feed(chunk, onDelta, onDone) {
            if (finished) return;
            buffer += chunk;
            let boundary;
            while (!finished && (boundary = /\r?\n\r?\n/.exec(buffer))) {
                const event = buffer.slice(0, boundary.index);
                buffer = buffer.slice(boundary.index + boundary[0].length);
                processEvent(event, onDelta, onDone);
            }
        },
        flush(onDelta, onDone) {
            if (!finished && buffer.trim()) processEvent(buffer, onDelta, onDone);
            buffer = '';
        },
        reset() { buffer = ''; finished = false; }
    };
}

export function repairIncompleteMarkdown(text) {
    if (!text) return '';
    let repaired = text;

    // 1. Fenced Code Blocks: count occurrences of triple backticks
    const codeBlockCount = (repaired.match(/```/g) || []).length;
    if (codeBlockCount % 2 !== 0) {
        return repaired + '\n```';
    }

    // Isolate text outside completed code blocks
    const outsideCode = repaired.replace(/```[\s\S]*?```/g, '');

    // 2. Inline Code: single backtick
    const inlineBacktickCount = (outsideCode.match(/`/g) || []).length;
    if (inlineBacktickCount % 2 !== 0) {
        repaired += '`';
    }

    // 3. Bold: double asterisks (**)
    const boldAsteriskCount = (outsideCode.match(/\*\*/g) || []).length;
    if (boldAsteriskCount % 2 !== 0) {
        repaired += '**';
    }

    // 4. Strikethrough: double tildes (~~)
    const strikeCount = (outsideCode.match(/~~/g) || []).length;
    if (strikeCount % 2 !== 0) {
        repaired += '~~';
    }

    // 5. Italic: single asterisk (*)
    const withoutBold = outsideCode.replace(/\*\*/g, '');
    const italicAsteriskCount = (withoutBold.match(/\*/g) || []).length;
    if (italicAsteriskCount % 2 !== 0) {
        repaired += '*';
    }

    // 6. Incomplete markdown links: [text](http...
    if (/\[[^\]]+\]\([^)]*$/.test(outsideCode)) {
        repaired += ')';
    }

    return repaired;
}

export function calculateConsumptionStep(unconsumed) {
    if (unconsumed > 400) return Math.ceil(unconsumed / 5);
    if (unconsumed > 150) return Math.ceil(unconsumed / 8);
    if (unconsumed > 60) return Math.ceil(unconsumed / 12);
    if (unconsumed > 20) return 3;
    if (unconsumed > 6) return 2;
    return 1;
}
