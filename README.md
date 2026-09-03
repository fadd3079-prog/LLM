# LLM Web Client

Web client chat model-model LLM (OpenRouter & NVIDIA NIM)

## Fitur

- **Bebas Pilih Model**: Pake API OpenRouter, bebas gonta-ganti model (Claude 3.5, GPT-4o, Gemini 2.5, DeepSeek R1/V3, Llama 3, dll)
- **Streaming Halus**: Respon teks streaming lancar, ga bergetar, dan otomatis lanjut kalau browser sempat ke-refresh di tengah jalan
- **Upload Berbagai File**: Bisa ekstrak dan baca PDF, ZIP, Markdown, file kode, teks biasa, sampai gambar (multimodal)
- **Tabel & Kode Rapi**: Format tabel ala MS Word yang rapi, plus syntax highlighting kode lengkap dengan tombol copy
- **Privat di LocalStorage**: Riwayat percakapan, pengaturan, dan API key tersimpan lokal di browser lu sendiri
- **Tema & Personalisasi**: Pilihan tema Terang, Gelap, atau ngikut OS, plus custom system prompt buat ngatur gaya jawab AI



1. Clone repo:
   ```bash
   git clone https://github.com/fadd3079-prog/LLM.git
   ```
2. run index.html


## Tech Stack

- HTML5
- Vanilla CSS (custom design system, tanpa Tailwind)
- Vanilla JavaScript (ES Modules, modular architecture)
- Library pendukung (via CDN): Lucide Icons, Marked, Highlight.js, PDF.js, JSZip
