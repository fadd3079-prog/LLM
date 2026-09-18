/**
 * Service untuk Text-to-Speech menggunakan Fish Audio API
 * 
 * Keamanan: Tidak ada API key yang di-hardcode. Kredensial harus
 * dikonfigurasi oleh pengguna melalui Settings / API Key input.
 * Fish Audio key disimpan di state.config.apiKeys['fish_audio'].
 */

import { state } from '../store/index.js';

const FISH_TTS_ENDPOINT = 'https://api.fish.audio/v1/tts';
const DEFAULT_VOICE_ID = '05b36da8574341d0803391491850db20';

let sharedAudioContext = null;
let currentAbortController = null;

function getAudioContext() {
    if (sharedAudioContext && sharedAudioContext.state !== 'closed') {
        if (sharedAudioContext.state === 'suspended') {
            sharedAudioContext.resume().catch(() => {});
        }
        return sharedAudioContext;
    }
    sharedAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    return sharedAudioContext;
}

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

export function getFishAudioApiKey() {
    if (!state.config.apiKeys) return '';
    return state.config.apiKeys['fish_audio'] || '';
}

export function setFishAudioApiKey(key) {
    if (!state.config.apiKeys) state.config.apiKeys = {};
    state.config.apiKeys['fish_audio'] = key;
}

export async function generateTTS(text, options = {}) {
    const apiKey = options.apiKey || getFishAudioApiKey();
    if (!apiKey) {
        throw new Error('Fish Audio API Key belum dikonfigurasi. Silakan tambahkan di Settings > API & Model > Fish Audio.');
    }

    const voiceId = options.voiceId || DEFAULT_VOICE_ID;
    const format = options.format || 'mp3';

    currentAbortController = new AbortController();

    try {
        const response = await fetch(FISH_TTS_ENDPOINT, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text: text,
                reference_id: voiceId,
                format: format,
            }),
            signal: currentAbortController.signal,
        });
        
        if (!response.ok) {
            const error = await response.text().catch(() => '');
            if (response.status === 401) {
                throw new Error('Fish Audio API Key tidak valid atau telah kedaluwarsa.');
            }
            if (response.status === 429) {
                throw new Error('Batas rate Fish Audio terlampaui. Coba lagi sebentar.');
            }
            throw new Error(`Fish Audio API error: ${response.status} - ${error}`);
        }
        
        const audioBuffer = await response.arrayBuffer();
        return audioBuffer;
    } catch (err) {
        if (err.name === 'AbortError') {
            throw new Error('Generasi TTS dibatalkan.');
        }
        console.error('Gagal generate TTS:', err);
        throw err;
    } finally {
        currentAbortController = null;
    }
}

export async function playAudioBuffer(audioBuffer) {
    const audioContext = getAudioContext();
    const decodedBuffer = await audioContext.decodeAudioData(audioBuffer.slice(0));
    const source = audioContext.createBufferSource();
    source.buffer = decodedBuffer;
    source.connect(audioContext.destination);
    source.start(0);
    return new Promise((resolve, reject) => {
        source.onended = resolve;
        source.onerror = (e) => reject(new Error('Gagal memutar audio'));
    });
}

export async function generateAndPlayTTS(text, options = {}) {
    const audioBuffer = await generateTTS(text, options);
    await playAudioBuffer(audioBuffer);
    return audioBuffer;
}

export function cancelTTS() {
    if (currentAbortController) {
        currentAbortController.abort();
        currentAbortController = null;
    }
}

export function downloadAudioBuffer(audioBuffer, filename = 'tts_output.mp3') {
    const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 300);
}
