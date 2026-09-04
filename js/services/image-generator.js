/**
 * Service untuk pembuatan gambar AI (Image Generation) berkualitas tinggi
 */

export function isImageGenerationRequest(text) {
    if (!text) return false;
    const trimmed = text.trim();

    // Command eksplisit
    if (/^\/(image|img|gambar)\s+/i.test(trimmed)) {
        return true;
    }

    // Pola kalimat bahasa Indonesia / Inggris
    const patterns = [
        /^(buatkan|buat|generate|bikin|ciptakan|create|draw)\s+(gambar|image|foto|visual|lukisan|ilustrasi)\s+(.+)/i,
        /^(tolong|bisa)?\s*(buatkan|generate|bikin)\s+(gambar|image|foto|visual)\s+(.+)/i
    ];

    return patterns.some(p => p.test(trimmed));
}

export function extractImagePrompt(text) {
    if (!text) return '';
    const trimmed = text.trim();

    // Command eksplisit: /image prompt
    const cmdMatch = trimmed.match(/^\/(image|img|gambar)\s+(.+)/i);
    if (cmdMatch && cmdMatch[2]) {
        return cmdMatch[2].trim();
    }

    // Pola kalimat
    const patterns = [
        /^(buatkan|buat|generate|bikin|ciptakan|create|draw)\s+(gambar|image|foto|visual|lukisan|ilustrasi)\s+(?:tentang|berupa|dari|sebuah|seekor)?\s*(.+)/i,
        /^(tolong|bisa)?\s*(buatkan|generate|bikin)\s+(gambar|image|foto|visual)\s+(?:tentang|berupa|dari|sebuah|seekor)?\s*(.+)/i
    ];

    for (const pattern of patterns) {
        const match = trimmed.match(pattern);
        if (match) {
            const promptCandidate = match[match.length - 1];
            if (promptCandidate) return promptCandidate.trim();
        }
    }

    return trimmed;
}

export function getGeneratedImageUrl(prompt, options = {}) {
    const cleanPrompt = encodeURIComponent(prompt.trim());
    const seed = Math.floor(Math.random() * 1000000);
    const width = options.width || 1024;
    const height = options.height || 1024;
    const model = options.model || 'flux'; // Flux model produces ultra realistic images

    return `https://image.pollinations.ai/prompt/${cleanPrompt}?width=${width}&height=${height}&seed=${seed}&nologo=true&model=${model}`;
}

/**
 * Unduh gambar dari URL
 */
export async function downloadImageFromUrl(imageUrl, filename = 'ai_generated_image.jpg') {
    try {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
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
        return true;
    } catch (err) {
        console.error('Gagal mengunduh gambar:', err);
        // Fallback buka di tab baru
        window.open(imageUrl, '_blank');
        return false;
    }
}
