/**
 * Service untuk manajemen memori persisten lintas percakapan (Cross-Chat Long-Term Memory)
 */

const MEMORY_STORAGE_KEY = 'ai_workspace_memories';

export function getMemories() {
    try {
        const raw = localStorage.getItem(MEMORY_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        console.warn('Gagal membaca memori AI:', e);
        return [];
    }
}

export function saveMemories(memories) {
    try {
        localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(memories));
        return true;
    } catch (e) {
        console.error('Gagal menyimpan memori AI:', e);
        return false;
    }
}

export function addMemory(text) {
    if (!text || !text.trim()) return null;
    const memories = getMemories();
    const item = {
        id: 'mem_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        text: text.trim(),
        createdAt: Date.now()
    };
    memories.unshift(item);
    saveMemories(memories);
    return item;
}

export function deleteMemory(id) {
    const memories = getMemories();
    const filtered = memories.filter(m => m.id !== id);
    saveMemories(filtered);
    return filtered;
}

export function clearAllMemories() {
    localStorage.removeItem(MEMORY_STORAGE_KEY);
}

/**
 * Format seluruh memori yang ada untuk diinjeksikan ke dalam System Prompt model AI
 */
export function formatMemoriesForSystemPrompt() {
    const memories = getMemories();
    if (!memories || memories.length === 0) return '';

    const memoryLines = memories.map(m => `- ${m.text}`).join('\n');
    return `\n\n[MEMORI DAN PREFERENSI PENGGUNA]\nBerikut adalah catatan memori penting tentang pengguna yang harus selalu Anda ingat dan terapkan di seluruh topik/channel:\n${memoryLines}\n`;
}
