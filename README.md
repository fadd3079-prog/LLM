# LLM Web Client

Web client buat ngobrol sama model-model LLM (OpenRouter & NVIDIA NIM). Dibuat seringan mungkin pake vanilla web stack, jalan langsung di browser tanpa butuh backend atau setup ribet

## Fitur

- **Bebas Pilih Model**: Pake API OpenRouter, bebas gonta-ganti model (Claude 3.5, GPT-4o, Gemini 2.5, DeepSeek R1/V3, Llama 3, dll).
- **Streaming Halus**: Respon teks streaming lancar, ga bergetar, dan otomatis lanjut kalau browser sempat ke-refresh di tengah jalan.
- **Upload Berbagai File**: Bisa ekstrak dan baca PDF, ZIP, Markdown, file kode, teks biasa, sampai gambar (multimodal).
- **Tabel & Kode Rapi**: Format tabel ala MS Word yang rapi, plus syntax highlighting kode lengkap dengan tombol copy.
- **Privat di LocalStorage**: Riwayat percakapan, pengaturan, dan API key tersimpan lokal di browser lu sendiri.
- **Tema & Personalisasi**: Pilihan tema Terang, Gelap, atau ngikut OS, plus custom system prompt buat ngatur gaya jawab AI.

## Cara Pake

Ga perlu install dependensi atau build-build-an.

1. Clone repo ini:
   ```bash
   git clone https://github.com/fadd3079-prog/LLM.git
   ```
2. Buka file `index.html` langsung di browser (atau pake Live Server di VS Code).
3. Masuk ke **Pengaturan**, masukin API Key lu (misal dari [OpenRouter](https://openrouter.ai/keys)).
4. Pilih model AI yang mau dipake, beres tinggal chat.

## Tech Stack

- HTML5
- Vanilla CSS (custom design system, tanpa Tailwind)
- Vanilla JavaScript (ES Modules, modular architecture)
- Library pendukung (via CDN): Lucide Icons, Marked, Highlight.js, PDF.js, JSZip
