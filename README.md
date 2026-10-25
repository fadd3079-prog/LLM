# AI Workspace

Aplikasi chat BYOK (bring your own key) yang berjalan sebagai situs statis. Tanpa akun, framework, atau proses build untuk menjalankan aplikasi.

## Menjalankan

Gunakan Node.js 22 atau lebih baru:

```bash
npm ci
npm start
```

Buka `http://localhost:8080`. Alternatif tanpa Node: jalankan `python -m http.server 8080` dari direktori proyek. Jangan membuka `index.html` melalui `file://` karena aplikasi menggunakan ES modules.

1. Buka **Pengaturan → API & Model**.
2. Pilih provider. Masukkan API key melalui kolom pengaturan, bukan pesan chat.
3. Pilih model dari katalog, atau isi **Model ID manual** lalu klik **Gunakan**.
4. Untuk Ollama/LM Studio, jalankan server lokal dan sesuaikan Base URL. API key bersifat opsional.

Setiap provider menyimpan key, model, dan endpoint secara terpisah. Kolom Base URL/Proxy juga dapat diarahkan ke reverse proxy **milik Anda sendiri** yang meneruskan format API provider tersebut. API key dikirim ke alamat ini; gunakan endpoint yang Anda percayai.

## Fitur

- Chat streaming dengan OpenAI-compatible APIs serta Anthropic Messages API.
- Stop, edit prompt dan buat ulang jawaban, pin, hapus, serta pindah percakapan.
- Model katalog dari provider dan input model ID manual. Daftar awal hanya contoh; ketersediaan model mengikuti provider dan akun.
- Upload, paste gambar, dan drag-and-drop lampiran. Hapus lampiran berdasarkan ID dan pertahankan draft jika pengiriman ditolak.
- Pembaca PDF (teks dan raster halaman scan), DOCX, PPTX, XLSX, CSV/TSV, ZIP, gambar PNG/JPEG/WebP/GIF, dan teks/kode.
- Markdown yang disanitasi, tabel yang dapat digulir, salin, download blok kode, serta ekspor pesan menjadi Markdown atau PDF.
- Memori yang ditambahkan manual, tema terang/gelap/sistem, dan bahasa Indonesia/Inggris.
- Audio melalui Fish Audio: pilih provider Fish Audio atau gunakan `/tts teks` dengan key Fish Audio yang sudah tersimpan. Pemutaran dan unduhan memakai hasil generasi yang sama; audio hanya tersedia selama sesi halaman.

## Batasan yang ditampilkan sesuai kemampuan aplikasi

- Browser mengirim permintaan langsung ke provider. Endpoint harus mengizinkan CORS dari origin situs ini. NVIDIA NIM dan provider lain dapat memerlukan reverse proxy yang Anda kelola; situs GitHub Pages tidak dapat menyediakan backend proxy.
- Model harus mendukung gambar untuk lampiran visual. Jangan mengirim gambar ke model teks saja.
- Web search di OpenRouter memakai server tool `openrouter:web_search`. Perplexity menggunakan pencarian bawaan model Sonar. Biaya dan ketersediaannya mengikuti provider; tombol aktivasi khusus OpenRouter dan dinonaktifkan untuk provider lain.
- Maksimal 8 lampiran per pesan dan 20 MB per berkas. PDF: hingga 30 halaman teks atau 8 halaman scan. XLSX: 3 sheet pertama, 100 baris per sheet, maksimal kolom IV. Arsip: maksimal 2.000 entri / 40 MB ukuran ekstraksi; 50 nama berkas dan 15 berkas teks dibaca. Teks panjang dibatasi menjadi 200.000 karakter.
- Format Office lama (`.doc`, `.xls`, `.ppt`), ODF, RAR/7z, SVG, dan berkas biner lain ditolak. Konversikan terlebih dahulu ke format yang didukung.
- Aplikasi tidak menjalankan kode, menghasilkan gambar melalui API chat, atau membuat berkas PowerPoint native. Permintaan gambar diteruskan sebagai chat biasa; aplikasi tidak menampilkan tautan gambar eksternal sebagai keberhasilan generasi.
- Memuat ulang halaman menghentikan jaringan streaming. Teks parsial dipertahankan dan diberi penanda terputus; permintaan tidak diulang otomatis.

## Penyimpanan dan privasi

Riwayat, lampiran, dan konfigurasi disimpan di IndexedDB pada browser yang digunakan. Data lama dari `ai_workspace_data` di localStorage dimigrasikan setelah berhasil disimpan. Tidak ada pemangkasan riwayat otomatis. Jika IndexedDB tidak tersedia, aplikasi mencoba localStorage dan menampilkan kesalahan jika penyimpanan gagal.

API key tetap dapat dibaca oleh JavaScript pada origin yang sama dan bukan brankas terenkripsi. Gunakan perangkat pribadi, jangan memasukkan key ke pesan, dan hapus key melalui pengaturan bila tidak diperlukan. Menghapus seluruh chat tidak menghapus API key atau memori; memori dikelola melalui tabnya sendiri.

Dependensi runtime disertakan di `vendor/` dengan versi terkunci dan lisensi. Tidak ada permintaan CDN saat startup. Pembaca Office/PDF dan ekspor PDF dimuat saat digunakan. API provider dan gambar eksternal di jawaban tetap memerlukan jaringan.

## Verifikasi dan pengembangan

```bash
npm run check
npm test
npx playwright install chromium
npm run test:e2e
```

Tes browser memakai respons provider simulasi; tidak mengirim key atau memakai kuota API berbayar. Uji endpoint produksi dengan key sendiri tetap diperlukan untuk memastikan izin akun, model, CORS, dan kuota provider.

Setelah mengubah versi dependensi, jalankan `npm run vendor` dan commit file `vendor/` yang dihasilkan. `scripts/icons.mjs` menghasilkan subset ikon Lucide yang digunakan aplikasi. `package-lock.json` mengunci instalasi untuk pengembangan dan CI.

## Interaksi dan animasi

Indikator AI mengikuti fase permintaan: menunggu, berpikir, menulis, selesai, dihentikan, atau gagal. Teks yang sudah tampil mempertahankan node DOM-nya; hanya tambahan teks yang mendapat fade singkat. Pemrosesan Markdown digabung per frame dan frekuensinya menyesuaikan biaya render. Tidak ada jeda mengetik buatan setelah respons provider selesai.

Gelombang berpikir, kursor, transisi panel, dan tombol memakai opacity/transform. Auto-scroll mengikuti output dengan requestAnimationFrame dan berhenti ketika pengguna menggulir ke atas. Tombol ke pesan terbaru mengaktifkannya kembali. Pengaturan `prefers-reduced-motion` mematikan efek dekoratif dan menyelesaikan animasi aktif.

```bash
npm run perf:motion
```

Benchmark lokal menyimulasikan streaming sekitar 6.500 karakter pada viewport desktop dan ponsel, lalu melaporkan cadence requestAnimationFrame, interval frame persentil ke-95, dan long task. Target animasi 60 FPS; pengukuran headless ini bukan jaminan performa layar/GPU semua perangkat. Tidak ada dependensi animasi runtime tambahan.

## GitHub Pages

Publikasikan root branch yang dipilih melalui **Settings → Pages**. Semua path runtime relatif sehingga aplikasi dapat dilayani di `/LLM/` maupun root domain. Berkas `vendor/` sudah disertakan; tidak diperlukan build atau environment variable. Server `npm start` hanya untuk pengembangan dan tidak dibutuhkan GitHub Pages.
