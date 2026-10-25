/**
 * Service i18n & UX Writing Profesional
 * Mendukung Bahasa Indonesia dan Inggris dengan deteksi otomatis bahasa perangkat pengguna
 */

const LANG_KEY = 'ai_workspace_lang';

const DICTIONARY = {
    id: {
        new_chat: 'Chat baru',
        hero_title: 'Ada yang ingin dikerjakan?',
        hero_eyebrow: 'RUANG KERJA PRIBADI',
        hero_subtitle: 'Pilih provider, gunakan API key Anda, dan mulai percakapan.',
        composer_note: 'API key milik Anda. Riwayat tersimpan di perangkat ini.',
        summarize: 'Ringkas dokumen',
        explore: 'Jelajahi ide',
        review_code: 'Tinjau kode',
        solve: 'Pecahkan masalah',
        search_models: 'Cari atau filter model AI...',
        placeholder_input: 'Tanya apa saja, riset web, atau buat file...',
        web_search: 'Web Search',
        web_search_active: 'Web Search Aktif (Live browsing internet)',
        web_researching: 'Searching...',
        ai_thinking: 'Thinking...',
        processing: 'Thinking...',
        thought_process: 'Thinking',
        sources_researched: 'Sources',
        stop: 'Stop respon',
        send: 'Kirim',
        attach: 'Attach File (Gambar, PDF, ZIP, Kode)',
        settings: 'Pengaturan',
        general: 'Umum',
        theme: 'Tema',
        api_model: 'API & Model',
        memory: 'Memori AI',
        personalization: 'System Instructions',
        generation_params: 'Pengaturan Model',
        conversation_data: 'Riwayat Chat',
        clear_all: 'Hapus Semua Chat',
        copy: 'Salin',
        copied: 'Tersalin!',
        download_file: 'Download File',
        download_md: 'Export (.md)',
        light: 'Light',
        dark: 'Dark',
        system: 'System',
        auto: 'Auto',
        language: 'Bahasa',
        connected: 'Connected',
        not_connected: 'Offline',
        add_memory: 'Simpan',
        memory_title: 'Memori AI (Cross-Chat)',
        empty_memory: 'Belum ada memori. Tambah info penting agar AI selalu ingat konteks Anda.',
        clear_memories: 'Hapus Semua Memori',
        save: 'Tersimpan',
        edit: 'Edit Prompt',
        edit_prompt_title: 'Edit prompt & respon ulang',
        cancel: 'Batal',
        send_and_respond: 'Simpan & Regenerate',
        prompt_empty_warning: 'Pesan tidak boleh kosong',
        prompt_updated_toast: 'Prompt diupdate, AI generate respon baru...'
    },
    en: {
        new_chat: 'New chat',
        hero_title: 'What would you like to work on?',
        hero_eyebrow: 'YOUR PERSONAL WORKSPACE',
        hero_subtitle: 'Choose a provider, add your API key, and start a conversation.',
        composer_note: 'Your API key. Your history, saved on this device.',
        summarize: 'Summarize a document',
        explore: 'Explore an idea',
        review_code: 'Review code',
        solve: 'Solve a problem',
        search_models: 'Search or filter AI models...',
        placeholder_input: 'Ask anything, search the web, or generate files...',
        web_search: 'Web Search',
        web_search_active: 'Web Search Active (Live web browsing)',
        web_researching: 'Searching...',
        ai_thinking: 'Thinking...',
        processing: 'Thinking...',
        thought_process: 'Thinking',
        sources_researched: 'Sources',
        stop: 'Stop generating',
        send: 'Send',
        attach: 'Attach Files (Images, PDF, ZIP, Code)',
        settings: 'Settings',
        general: 'General',
        theme: 'Theme',
        api_model: 'API & Model',
        memory: 'AI Memory',
        personalization: 'System Instructions',
        generation_params: 'Model Parameters',
        conversation_data: 'Chat History',
        clear_all: 'Clear All Chats',
        copy: 'Copy',
        copied: 'Copied!',
        download_file: 'Download File',
        download_md: 'Export (.md)',
        light: 'Light',
        dark: 'Dark',
        system: 'System',
        auto: 'Auto',
        language: 'Language',
        connected: 'Connected',
        not_connected: 'Offline',
        add_memory: 'Save',
        memory_title: 'AI Memory (Cross-Chat)',
        empty_memory: 'No saved memories yet. Add key preferences for the AI to remember.',
        clear_memories: 'Clear All Memories',
        save: 'Saved',
        edit: 'Edit Prompt',
        edit_prompt_title: 'Edit this prompt & regenerate',
        cancel: 'Cancel',
        send_and_respond: 'Save & Regenerate',
        prompt_empty_warning: 'Message cannot be empty',
        prompt_updated_toast: 'Prompt updated, AI is generating new response...'
    }
};

export function getSavedLanguageSetting() {
    try { return localStorage.getItem(LANG_KEY) || 'auto'; } catch { return 'auto'; }
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
        try { localStorage.setItem(LANG_KEY, lang); } catch { /* Current view can still update. */ }
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
