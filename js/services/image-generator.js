export async function downloadImageFromUrl(imageUrl, filename = 'ai_generated_image.jpg') {
    try {
        const response = await fetch(imageUrl);
        if (!response.ok) throw new Error('Gagal mengunduh gambar');
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
        window.open(imageUrl, '_blank', 'noopener,noreferrer');
        return false;
    }
}
