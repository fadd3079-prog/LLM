export function parseSSEChunk(chunk, onDelta, onDone) {
    const lines = chunk.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed === 'data: [DONE]') {
            if (onDone) onDone();
            return;
        }
        if (trimmed.startsWith('data: ')) {
            try {
                const parsed = JSON.parse(trimmed.slice(6));
                const delta = parsed.choices?.[0]?.delta || {};
                const content = delta.content || '';
                const reasoning = delta.reasoning || delta.thought || '';
                const citations = parsed.citations || delta.citations || null;

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
