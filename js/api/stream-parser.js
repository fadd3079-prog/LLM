export function createSSEParser() {
    let buffer = '';
    let finished = false;

    function processEvents(onDelta, onDone) {
        let eventEnd;
        // Handle both \n\n and \r\n\r\n as event delimiters
        while ((eventEnd = findEventBoundary(buffer)) !== -1) {
            const rawEvent = buffer.slice(0, eventEnd);
            buffer = buffer.slice(eventEnd + getBoundaryLength(buffer, eventEnd));
            processEvent(rawEvent, onDelta, onDone);
            if (finished) return;
        }
    }

    function findEventBoundary(buf) {
        // Check for \n\n first (most common)
        let idx = buf.indexOf('\n\n');
        if (idx !== -1) return idx;
        // Check for \r\n\r\n
        idx = buf.indexOf('\r\n\r\n');
        if (idx !== -1) return idx;
        return -1;
    }

    function getBoundaryLength(buf, eventEnd) {
        if (buf[eventEnd] === '\r' && buf[eventEnd + 1] === '\n' && buf[eventEnd + 2] === '\r' && buf[eventEnd + 3] === '\n') {
            return 4;
        }
        return 2;
    }

    function processEvent(rawEvent, onDelta, onDone) {
        const lines = rawEvent.split(/\r?\n/);
        const dataLines = [];
        let eventType = '';

        for (const line of lines) {
            if (line.startsWith('event:')) {
                eventType = line.slice(6).trim();
            } else if (line.startsWith('data:')) {
                dataLines.push(line.slice(5).trim());
            } else if (line.startsWith(':')) {
                // Comment line, ignore
            }
        }

        if (dataLines.length === 0) return;

        const payload = dataLines.join('\n');
        if (!payload) return;

        if (payload === '[DONE]') {
            finished = true;
            if (onDone) onDone();
            return;
        }

        try {
            const parsed = JSON.parse(payload);

            // Format OpenAI, Gemini, Groq, DeepSeek, Mistral, Together, Cerebras, Ollama, LM Studio
            const delta = parsed.choices?.[0]?.delta || {};
            let content = delta.content || '';
            const reasoning = delta.reasoning_content || delta.reasoning || delta.thought || '';
            const citations = parsed.citations || delta.citations || null;

            // Format Anthropic Messages API (content_block_delta)
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                content = parsed.delta.text;
            }
            if (parsed.type === 'message_delta' && parsed.delta?.stop_reason) {
                if (onDone) onDone();
            }

            if ((content || reasoning || citations) && onDelta) {
                onDelta(content, { reasoning, citations });
            }
        } catch (e) {
            // JSON.parse failure: event may be truncated in TCP;
            // ignore and wait for buffer to be filled from next chunk.
        }
    }

    return {
        feed(chunk, onDelta, onDone) {
            if (finished) return;
            buffer += chunk;
            processEvents(onDelta, onDone);
        },
        flush(onDelta, onDone) {
            if (finished) return;
            const remainder = buffer.trim();
            buffer = '';
            if (!remainder) return;
            const lines = remainder.split(/\r?\n/);
            const dataLines = [];
            for (const line of lines) {
                if (line.startsWith('data:')) {
                    dataLines.push(line.slice(5).trim());
                }
            }
            if (dataLines.length === 0) return;

            const payload = dataLines.join('\n');
            if (payload === '[DONE]') {
                if (onDone) onDone();
                return;
            }
            try {
                const parsed = JSON.parse(payload);
                const delta = parsed.choices?.[0]?.delta || {};
                const content = delta.content || '';
                const reasoning = delta.reasoning_content || delta.reasoning || delta.thought || '';
                const citations = parsed.citations || delta.citations || null;
                if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                    if (onDelta) onDelta(parsed.delta.text, { reasoning: '', citations: null });
                    return;
                }
                if ((content || reasoning || citations) && onDelta) {
                    onDelta(content, { reasoning, citations });
                }
            } catch (e) {
                // Ignore invalid remainder.
            }
        },
        reset() {
            buffer = '';
            finished = false;
        }
    };
}

// Backwards-compat stateless shim.
export function parseSSEChunk(chunk, onDelta, onDone) {
    const lines = chunk.split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed === 'data: [DONE]') {
            if (onDone) onDone();
            return;
        }
        if (trimmed.startsWith('data:')) {
            const payload = trimmed.slice(5).trim();
            if (!payload) continue;
            try {
                const parsed = JSON.parse(payload);
                const delta = parsed.choices?.[0]?.delta || {};
                let content = delta.content || '';
                const reasoning = delta.reasoning_content || delta.reasoning || delta.thought || '';
                const citations = parsed.citations || delta.citations || null;

                if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                    content = parsed.delta.text;
                }
                if (parsed.type === 'message_delta' && parsed.delta?.stop_reason) {
                    if (onDone) onDone();
                }

                if ((content || reasoning || citations) && onDelta) {
                    onDelta(content, { reasoning, citations });
                }
            } catch (e) {
                // Ignore incomplete line splits
            }
        }
    }
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
