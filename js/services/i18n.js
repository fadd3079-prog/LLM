/**
 * Service i18n & UX Writing Profesional
 * Mendukung Bahasa Indonesia dan Inggris dengan deteksi otomatis bahasa perangkat pengguna
 */

const LANG_KEY = 'ai_workspace_lang';

const DICTIONARY = {
    id: {
        new_chat: 'Obrolan Baru',
        search_models: 'Pilih atau cari model AI...',
        placeholder_input: 'Tanyakan apa saja, riset topik, atau buat file...',
        web_search: 'Riset Web',
        web_search_active: 'Riset Web Aktif (Pencarian internet real-time)',
        web_researching: 'Menjelajahi internet & meriset sumber informasi terkini...',
        ai_thinking: 'Menganalisis & menyusun proses penalaran logis...',
        processing: 'Menyiapkan jawaban...',
        thought_process: 'Proses Penalaran',
        sources_researched: 'Sumber Riset Terverifikasi',
        stop: 'Hentikan respon AI',
        send: 'Kirim Pesan',
        attach: 'Lampirkan Berkas (Gambar, PDF, ZIP, Kode)',
        settings: 'Pengaturan',
        general: 'Umum',
        theme: 'Tema',
        api_model: 'API & Model',
        memory: 'Memori AI',
        personalization: 'Instruksi Sistem',
        generation_params: 'Parameter Generasi',
        conversation_data: 'Data Percakapan',
        clear_all: 'Hapus Semua Percakapan',
        copy: 'Salin',
        copied: 'Tersalin!',
        download_file: 'Unduh File',
        download_md: 'Unduh (.md)',
        light: 'Terang',
        dark: 'Gelap',
        system: 'Sistem',
        auto: 'Otomatis',
        language: 'Bahasa Antarmuka',
        connected: 'Terhubung',
        not_connected: 'Belum Terhubung',
        add_memory: 'Tambah',
        memory_title: 'Memori Lintas Percakapan',
        empty_memory: 'Belum ada memori tersimpan.',
        clear_memories: 'Hapus Semua Memori',
        save: 'Tersimpan',
        edit: 'Edit Prompt',
        edit_prompt_title: 'Edit prompt ini & respon ulang',
        cancel: 'Batal',
        send_and_respond: 'Kirim & Respon Baru',
        prompt_empty_warning: 'Pesan tidak boleh kosong',
        prompt_updated_toast: 'Prompt diperbarui, AI merespon ulang...'
    },
    en: {
        new_chat: 'New Chat',
        search_models: 'Select or search AI models...',
        placeholder_input: 'Ask anything, research a topic, or generate files...',
        web_search: 'Web Search',
        web_search_active: 'Web Search Active (Real-time live browsing)',
        web_researching: 'Searching the web & researching real-time sources...',
        ai_thinking: 'Analyzing & formulating logical reasoning...',
        processing: 'Formulating response...',
        thought_process: 'Thinking Process',
        sources_researched: 'Verified Research Sources',
        stop: 'Stop generating',
        send: 'Send message',
        attach: 'Attach Files (Images, PDF, ZIP, Code)',
        settings: 'Settings',
        general: 'General',
        theme: 'Theme',
        api_model: 'API & Model',
        memory: 'AI Memory',
        personalization: 'System Instructions',
        generation_params: 'Generation Parameters',
        conversation_data: 'Chat Data',
        clear_all: 'Clear All Conversations',
        copy: 'Copy',
        copied: 'Copied!',
        download_file: 'Download File',
        download_md: 'Export (.md)',
        light: 'Light',
        dark: 'Dark',
        system: 'System',
        auto: 'Auto',
        language: 'Interface Language',
        connected: 'Connected',
        not_connected: 'Disconnected',
        add_memory: 'Add',
        memory_title: 'Cross-Chat Memory',
        empty_memory: 'No saved memories yet.',
        clear_memories: 'Clear All Memories',
        save: 'Saved',
        edit: 'Edit Prompt',
        edit_prompt_title: 'Edit this prompt & regenerate',
        cancel: 'Cancel',
        send_and_respond: 'Send & Regenerate',
        prompt_empty_warning: 'Message cannot be empty',
        prompt_updated_toast: 'Prompt updated, AI is generating new response...'
    }
};

export function getSavedLanguageSetting() {
    return localStorage.getItem(LANG_KEY) || 'auto';
}

export function getCurrentLanguage() {
    const setting = getSavedLanguageSetting();
    if (setting === 'id' || setting === 'en') return setting;

    // Deteksi otomatis dari bahasa browser/perangkat
    const navLang = (navigator.language || navigator.userLanguage || '').toLowerCase();
    return navLang.startsWith('id') ? 'id' : 'en';
}

export function setLanguage(lang) {
    if (lang === 'auto' || lang === 'id' || lang === 'en') {
        localStorage.setItem(LANG_KEY, lang);
        applyLanguageToDOM();
    }
}

export function t(key) {
    const lang = getCurrentLanguage();
    return DICTIONARY[lang]?.[key] || DICTIONARY.en?.[key] || key;
}

export function applyLanguageToDOM() {
    const currentLang = getCurrentLanguage();
    document.documentElement.lang = currentLang;

    // Update elemen dengan data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (key && DICTIONARY[currentLang]?.[key]) {
            el.textContent = DICTIONARY[currentLang][key];
        }
    });

    // Update elemen dengan data-i18n-placeholder
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (key && DICTIONARY[currentLang]?.[key]) {
            el.placeholder = DICTIONARY[currentLang][key];
        }
    });

    // Update elemen dengan data-i18n-title
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        if (key && DICTIONARY[currentLang]?.[key]) {
            el.title = DICTIONARY[currentLang][key];
        }
    });
}
