/**
 * Service untuk Text-to-Speech menggunakan Fish Audio API
 */

const FISH_API_KEY = 'sk-fish-KolKr07Njot-aZFbqDG4kOzwb72AZaggrQ_7iq4MOFw';
const DEFAULT_VOICE_ID = '05b36da8574341d0803391491850db20';
const FISH_TTS_ENDPOINT = 'https://api.fish.audio/v1/tts';

export function isTTSRequest(text) {
    if (!text) return false;
    const trimmed = text.trim().toLowerCase();
    
    return trimmed.startsWith('/tts ') || 
           trimmed.startsWith('/speak ') || 
           trimmed.startsWith('/voice ') ||
           trimmed.startsWith('bicara ') ||
           trimmed.startsWith('ucapkan ');
}

export function extractTTSText(text) {
    if (!text) return '';
    const trimmed = text.trim();
    
    const patterns = [
        /^\/(tts|speak|voice)\s+(.+)/i,
        /^(bicara|ucapkan)\s+(.+)/i
    ];
    
    for (const pattern of patterns) {
        const match = trimmed.match(pattern);
        if (match && match[2]) {
            return match[2].trim();
        }
    }
    
    return trimmed;
}

export async function generateTTS(text, options = {}) {
    const voiceId = options.voiceId || DEFAULT_VOICE_ID;
    const format = options.format || 'mp3';
    const model = options.model || 's2.1-pro-free';
    
    try {
        const response = await fetch(FISH_TTS_ENDPOINT, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${FISH_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text: text,
                reference_id: voiceId,
                format: format,
            }),
        });
        
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Fish Audio API error: ${response.status} - ${error}`);
        }
        
        const audioBuffer = await response.arrayBuffer();
        return audioBuffer;
    } catch (err) {
        console.error('Gagal generate TTS:', err);
        throw err;
    }
}

export function playAudioBuffer(audioBuffer) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    return audioContext.decodeAudioData(audioBuffer)
        .then(audioBuffer => {
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext.destination);
            source.start(0);
            return new Promise(resolve => {
                source.onended = resolve;
            });
        });
}

export async function generateAndPlayTTS(text, options = {}) {
    const audioBuffer = await generateTTS(text, options);
    await playAudioBuffer(audioBuffer);
}

export function downloadAudioBuffer(audioBuffer, filename = 'tts_output.mp3') {
    const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 300);
}