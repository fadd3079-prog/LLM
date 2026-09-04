Saya sudah mengaudit \*\*seluruh tree proyek `LLM-main`\*\*, termasuk integrasi antarmodul, state, provider API, streaming, file processing, memory, keamanan DOM, persistence, HTML/CSS, serta dokumentasinya. Saya juga menjalankan pemeriksaan parsing ES Module, dependency/import graph, referensi asset, struktur DOM, dan beberapa simulasi logic untuk membuktikan bug yang dicurigai.



\## Kesimpulan utama



Dalam kondisi source saat ini, proyek \*\*belum layak production\*\*. Bahkan ada \*\*1 blocker P0 yang dapat membuat aplikasi gagal startup sama sekali\*\*. Setelah blocker tersebut diperbaiki, masih ada beberapa bug P1 yang berpotensi menyebabkan:



\* request dikirim ke provider yang salah;

\* streaming kehilangan token;

\* API key bocor ke chat/history/request;

\* stored XSS;

\* provider lokal tidak dapat digunakan tanpa API key;

\* lampiran salah terhapus atau hilang;

\* riwayat gagal tersimpan karena `localStorage`;

\* race condition saat stop/start generation;

\* provider/model yang sudah deprecated tetap dipakai.



Namun fondasi proyek \*\*tidak perlu ditulis ulang dari nol\*\*. Pembagian modulnya cukup baik dan semua relative import dapat di-resolve tanpa circular dependency.



\---



\# 1. Kondisi codebase



Hasil inventarisasi:



| Komponen                           |         Hasil |

| ---------------------------------- | ------------: |

| Total file                         |           ±41 |

| JavaScript                         |  ±5.678 baris |

| CSS                                |  ±8.023 baris |

| HTML                               |    ±535 baris |

| Modul JS                           |            26 |

| Relative import rusak              |         \*\*0\*\* |

| Circular dependency                |         \*\*0\*\* |

| ES module gagal parse              |         \*\*1\*\* |

| Duplicate HTML `id`                |         \*\*0\*\* |

| Local CSS/JS/image reference rusak |         \*\*0\*\* |

| Test suite                         | \*\*tidak ada\*\* |

| Linter                             | \*\*tidak ada\*\* |

| Build system/package.json          | \*\*tidak ada\*\* |

| CI                                 | \*\*tidak ada\*\* |



Arsitekturnya pada dasarnya:



```text

index.html

&#x20;  ↓

js/app.js

&#x20;  ├── store/

&#x20;  │   ├── index.js

&#x20;  │   └── persister.js

&#x20;  │

&#x20;  ├── api/

&#x20;  │   ├── provider.js

&#x20;  │   └── stream-parser.js

&#x20;  │

&#x20;  ├── components/

&#x20;  │   ├── chat.js

&#x20;  │   ├── input.js

&#x20;  │   ├── modal.js

&#x20;  │   ├── modal-models.js

&#x20;  │   ├── sidebar.js

&#x20;  │   └── ...

&#x20;  │

&#x20;  ├── services/

&#x20;  │   ├── app-knowledge.js

&#x20;  │   ├── memory.js

&#x20;  │   ├── api-key-detector.js

&#x20;  │   └── image-generator.js

&#x20;  │

&#x20;  └── utils/

&#x20;      ├── file-processor.js

&#x20;      ├── markdown.js

&#x20;      └── ...

```



Secara separation of concerns ini sudah cukup masuk akal.



\---



\# 2. P0 — aplikasi berpotensi tidak bisa boot



\### `js/services/app-knowledge.js:32`



Ada raw triple-backtick di dalam JavaScript template literal:



````js

\- Jika diminta membuat berkas (...) -> langsung buatkan file lengkap

&#x20; dengan blok kode berformat ```bahasa:nama\_file.ext.

````



Karena keseluruhan system prompt sendiri dibuat menggunakan backtick template literal, ` ``` ` tersebut menutup string secara tidak semestinya.



Saya menjalankan parser ES Module terhadap seluruh \*\*26 modul JS\*\*:



```text

25 modul : PASS

1 modul  : FAIL



js/services/app-knowledge.js

Unexpected identifier 'bahasa'

```



Lebih penting lagi, `app.js` mengimpor modul tersebut ketika startup.



Jadi ini bukan sekadar fitur tertentu yang rusak. \*\*Module graph aplikasi dapat gagal dievaluasi dan aplikasi tidak jalan.\*\*



\### Perbaikan



Escape backtick:



```js

\\`\\`\\`bahasa:nama\_file.ext

```



atau jangan memasukkan code fence literal ke template tersebut.



\*\*Severity: P0 / BLOCKER\*\*



\---



\# 3. P1 — `baseUrl` provider salah setelah berpindah provider



Ini salah satu bug arsitektural terbesar.



`store/index.js:50–60`:



```js

export function setProvider(providerId) {

&#x20;   ...

&#x20;   state.config.provider = providerId;

&#x20;   state.config.apiKey = state.config.apiKeys\[providerId] || '';



&#x20;   if (state.config.providerModels\[providerId]) {

&#x20;       state.selectedModel = state.config.providerModels\[providerId];

&#x20;   }

}

```



Provider berubah, API key berubah, model berubah.



Tetapi \*\*`baseUrl` tidak berubah\*\*.



Lalu `app.js:323`:



```js

baseUrl:

&#x20;   state.config.baseUrl ||

&#x20;   state.config.customBaseUrls?.\[state.config.provider] ||

&#x20;   ''

```



Masalahnya `state.config.baseUrl` sejak awal berisi:



```text

https://openrouter.ai/api/v1

```



Sehingga expression pertama sudah truthy.



Contoh:



```text

awal:

provider = openrouter

baseUrl  = https://openrouter.ai/api/v1



↓



switch ke Groq



provider = groq

baseUrl  = https://openrouter.ai/api/v1   ← masih ini



↓



request Groq dikirim menggunakan endpoint OpenRouter

```



Ini juga menjalar ke katalog model di `modal-models.js:111–119`.



\### Ada bug kedua yang memperparahnya



`modal.js:73–81` menyembunyikan field Base URL untuk cloud provider.



Tetapi saat modal ditutup:



```js

if (baseUrlInput) {

&#x20;   setProviderBaseUrl(

&#x20;       state.config.provider,

&#x20;       baseUrlInput.value.trim()

&#x20;   );

}

```



tetap dijalankan.



Jadi skenario seperti:



```text

Ollama

base URL = http://localhost:11434/v1



switch → Groq



field baseURL disembunyikan

value lama masih berada dalam input



close Settings



↓



Groq dapat disimpan dengan base URL Ollama

```



\*\*Severity: P1 / major provider integration failure\*\*



\### Akar masalah



Ada dua source of truth:



```text

config.baseUrl

config.customBaseUrls\[provider]

```



Harus dipilih satu.



Idealnya:



```js

providers: {

&#x20; groq: {

&#x20;   apiKey: "...",

&#x20;   baseUrl: "...",

&#x20;   model: "..."

&#x20; },



&#x20; openrouter: {

&#x20;   apiKey: "...",

&#x20;   baseUrl: "...",

&#x20;   model: "..."

&#x20; }

}

```



\---



\# 4. P1 — parser SSE dapat kehilangan token streaming



`js/api/stream-parser.js`:



```js

const lines = chunk.split('\\n');



...



try {

&#x20;   const parsed = JSON.parse(trimmed.slice(6));

} catch (e) {

&#x20;   // Ignore incomplete line splits

}

```



Ini keliru karena:



> satu `reader.read()` \*\*tidak sama dengan satu SSE event\*\*.



Network dapat mengirim:



```text

chunk 1:

data: {"choices":\[{"delta":{"content":"Hel



chunk 2:

lo"}}]}

```



Chunk pertama gagal `JSON.parse()` lalu dibuang.



Chunk kedua tidak lagi diawali event SSE lengkap.



Akibatnya:



```text

Expected: Hello

Actual:   ""

```



Saya menguji pola split tersebut dan memang kontennya hilang.



`provider.js:518–541` mengonfirmasi bahwa setiap network chunk langsung dilempar ke `parseSSEChunk()` tanpa carry-over buffer.



\### Dampaknya



Bisa menimbulkan:



\* token hilang;

\* kata terpotong;

\* reasoning hilang;

\* `\[DONE]` tidak terbaca;

\* hasil streaming random tergantung bagaimana TCP/browser membagi data.



Ini tipe bug yang sering sulit direproduksi karena dipengaruhi network.



\### Yang benar



Harus memiliki persistent buffer:



```text

buffer += decoder.decode(chunk)



ambil semua event lengkap

↓

simpan remainder yang belum lengkap

↓

gabungkan dengan network chunk berikutnya

```



Juga perlu memanggil final:



```js

decoder.decode()

```



untuk flush decoder.



\*\*Severity: P1\*\*



\---



\# 5. P1 — penghapusan attachment menggunakan ID tetapi store menganggap index



`input.js:294–299`:



```js

const id = btn.dataset.id;

removePendingAttachment(id);

```



Sedangkan `store/index.js:200–202`:



```js

export function removePendingAttachment(index) {

&#x20;   state.pendingAttachments.splice(index, 1);

}

```



Yang dikirim misalnya:



```text

att\_172839123\_abc

```



tetapi `splice()` membutuhkan angka.



String nonnumerik akhirnya berperilaku seperti index `0`.



Saya simulasikan:



```text

attachments:

\[A, B, C]



klik hapus B



Expected:

\[A, C]



Actual:

\[B, C]

```



Attachment pertama yang justru terhapus.



\### Solusi



Semantik API harus jelas:



```js

removePendingAttachmentById(id)

```



dan:



```js

state.pendingAttachments =

&#x20;   state.pendingAttachments.filter(x => x.id !== id);

```



\*\*Severity: P1\*\*



\---



\# 6. P1 — Ollama / LM Studio / custom endpoint tanpa API key diblokir oleh `app.js`



Provider layer sebenarnya sudah benar.



`provider.js:243`:



```js

if (!cfg.isLocal \&\& !apiKey \&\& !cfg.isCustom) {

```



Artinya:



```text

local  → API key tidak wajib

custom → API key tidak wajib

```



UI juga mengatakan:



```text

API Key (Opsional)



Server lokal biasanya tidak membutuhkan API Key.

```



Tetapi `app.js:404`:



```js

if (!state.config.apiKey) {

&#x20;   modal.open('api');

&#x20;   showToast('Masukkan API Key terlebih dahulu...', 'error');

&#x20;   return;

}

```



Jadi request bahkan tidak sampai ke provider layer.



Artinya dukungan:



```text

Ollama

LM Studio

Custom unauthenticated endpoint

```



secara praktis \*\*rusak\*\*.



\*\*Severity: P1\*\*



\---



\# 7. P1 — attachment dihapus sebelum request divalidasi



`input.js:322–334`:



```js

const attachments = getPendingAttachments();



...



clearPendingAttachments();



...



onSendMessage(text, attachments, ...);

```



Misalnya user upload 5 file lalu menekan Send.



Setelah itu `app.js` baru menemukan:



```js

if (!state.config.apiKey) {

&#x20;   ...

&#x20;   return;

}

```



Tetapi preview attachment sudah dibersihkan.



Akibatnya user harus upload ulang seluruh file.



\### Seharusnya



Clear attachment \*\*setelah send benar-benar diterima\*\* oleh application layer.



\*\*Severity: P1/P2\*\*



\---



\# 8. Security P1 — API key dapat tersimpan sebagai isi chat



Ini bagian yang sangat perlu dibenahi.



`app.js:344` melakukan:



```js

const apiConfig = detectAndParseApiConfig(text);

```



Artinya user bisa mengetik/paste:



```text

OPENAI\_API\_KEY=sk-xxxxxxxx

```



dan aplikasi otomatis mendeteksinya.



Tetapi pada pure setup:



```js

const userMsg = addMessage('user', text);

```



Raw text tadi ikut masuk chat.



Jadi secret tersimpan dalam:



```text

chat history

&#x20;   ↓

localStorage

```



Kalau detector menganggap text bukan pure setup, execution bahkan dapat berlanjut ke chat normal.



Artinya API key bisa ikut menjadi:



```json

{

&#x20; "role": "user",

&#x20; "content": "... sk-xxxxxxxx ..."

}

```



dan dikirim ke provider.



\### Lebih buruk lagi



Detector menggunakan pattern generik seperti:



```text

Bearer ...

sk-...

API\_KEY=...

```



Sehingga diskusi biasa tentang konfigurasi atau security juga dapat menyebabkan active provider/config berubah tanpa disengaja.



\### Rekomendasi



\*\*Jangan gunakan ordinary chat sebagai credential input.\*\*



API key seharusnya hanya masuk melalui Settings.



Kalau feature auto-detection tetap dipertahankan:



```text

detect

↓

extract secret

↓

REDACT secret

↓

jangan simpan raw input

↓

jangan kirim raw input ke LLM

↓

minta explicit confirmation

```



\*\*Severity: P1 Security\*\*



\---



\# 9. Security P1 — stored XSS



Untuk jawaban AI, proyek sebenarnya sudah melakukan hal yang benar:



`utils/markdown.js`:



```js

DOMPurify.sanitize(...)

```



dan external link diberi:



```text

noopener noreferrer

```



Ini bagus.



Namun ada beberapa tempat lain yang memasukkan data dinamis langsung melalui `innerHTML`.



Contoh paling berbahaya:



`modal.js:152–157`:



```js

memoryList.innerHTML = memories.map(m => `

&#x20;   ...

&#x20;   <span class="memory-text">${m.text}</span>

`).join('');

```



`m.text` adalah data yang bisa berasal dari user/model.



Kalau tersimpan:



```html

<img src=x onerror="...">

```



maka membuka Settings dapat mengeksekusi HTML tersebut.



Sink serupa terdapat di:



```text

components/input.js

components/chat.js

components/header-models.js

components/modal-models.js

utils/toast.js

```



khususnya nama file, nama model, memory, dan remote metadata.



Ini berbahaya karena halaman yang sama juga memiliki akses ke:



```text

localStorage API keys

chat history

memories

```



Stored XSS berpotensi mengakses semuanya.



\### Solusi



Untuk seluruh data dinamis yang bukan HTML:



```js

element.textContent = value;

```



bukan:



```js

element.innerHTML = value;

```



`innerHTML` hanya dipakai untuk markup statis yang Anda kontrol sendiri.



\*\*Severity: P1 Security\*\*



\---



\# 10. Security — localStorage bukan penyimpanan API key yang “aman”



UI menampilkan:



```text

API Key tersimpan aman secara privat di LocalStorage

```



dan success card:



```text

Tersimpan aman di LocalStorage

Status: Terhubung

```



Klaim tersebut terlalu kuat.



`localStorage`:



```text

✓ lokal pada origin browser

✗ tidak encrypted secret vault

✗ dapat dibaca JavaScript origin yang sama

✗ dapat dibaca script XSS

✗ dapat dibaca dependency/CDN yang compromised

```



Sedangkan `index.html` memuat beberapa library dari CDN.



Beberapa dependency bahkan tidak dipin ke exact version, misalnya penggunaan `@latest`/latest package path.



Tidak terlihat CSP/SRI yang kuat.



\### Untuk production



Arsitektur ideal:



```text

Browser

&#x20;  ↓

your backend / BFF

&#x20;  ↓

provider API

```



API key server-side.



Jika memang aplikasi harus BYOK/browser-only, setidaknya komunikasikan secara akurat bahwa secret disimpan lokal tetapi \*\*bukan secure enclave\*\*.



\---



\# 11. Race condition Stop → Send lagi



Saat Stop:



```text

abort old controller

↓

activeAbortController = null

isGenerating = false

enable input

```



User langsung dapat memulai generation baru.



Tetapi old request pada `provider.js:460`:



```js

if (err.name === 'AbortError') {

&#x20;   onComplete('');

}

```



masih memanggil completion callback request lama.



Callback tersebut kemudian dapat menyentuh global:



```text

activeAbortController

activeStream

isGenerating

input state

```



Padahal request baru sudah berjalan.



Skenario:



```text

Request A

&#x20;  ↓

STOP A

&#x20;  ↓

Request B dimulai

&#x20;  ↓

callback Abort A terlambat masuk

&#x20;  ↓

callback A reset global state

&#x20;  ↓

Request B dianggap selesai / controller hilang

```



Solusi yang robust adalah generation/request ID:



```js

const generationId = crypto.randomUUID();

```



Semua callback:



```js

if (generationId !== activeGenerationId) return;

```



atau validasi controller identity.



\*\*Severity: P1/P2\*\*



\---



\# 12. Pindah/hapus chat saat streaming juga race-prone



Generation state bersifat global:



```text

state.isGenerating

activeAbortController

single streaming DOM target

```



Tetapi user tetap bisa melakukan operasi chat.



Stream lama mempertahankan reference ke chat/message lama sementara DOM sudah menampilkan chat lain.



Ini dapat menyebabkan:



```text

stream tidak terlihat;

DOM target hilang;

message di chat lama terus berubah;

global input state tidak sinkron.

```



Paling sederhana:



```text

disable destructive chat operations while streaming

```



atau implementasi stream state per-chat.



\---



\# 13. Race pada model catalog



`modal-models.js`:



```js

const provider = state.config.provider;



const list = await fetchModels(...);



state.models = list;

```



Tidak ada verifikasi bahwa provider masih sama setelah `await`.



Contoh:



```text

fetch OpenRouter → lambat

switch Groq

fetch Groq → selesai

models = Groq



fetch OpenRouter lama → akhirnya selesai

models = OpenRouter

```



Sekarang provider Groq tetapi dropdown berisi model OpenRouter.



Gunakan:



```text

request ID

AbortController

atau

if (provider !== state.config.provider) return;

```



\---



\# 14. “Connected” bukan benar-benar connection test



Beberapa UI menyatakan:



```text

Terhubung

Siap Digunakan

Berhasil Terhubung

```



berdasarkan fakta bahwa string API key ada.



Tidak ada ping/API validation yang membuktikan:



```text

key valid

endpoint reachable

model valid

quota tersedia

CORS bekerja

```



Lebih tepat:



```text

API Key tersimpan

```



dan sediakan tombol:



```text

Test Connection

```



\---



\# 15. File size 50 MB bertabrakan dengan `localStorage`



`file-processor.js` menerima:



```js

50 \* 1024 \* 1024

```



= 50 MB per file.



Tetapi data file kemudian bisa menjadi:



```text

base64 images

pageImages\[]

chat.messages\[].attachments

↓

JSON.stringify(state)

↓

localStorage

```



Base64 sendiri menambah ukuran sekitar 33%.



Sedangkan browser `localStorage` biasanya memiliki quota yang jauh lebih kecil daripada puluhan MB dan bersifat synchronous.



Jadi secara arsitektural:



```text

allow 50 MB

\+

persist full attachment into localStorage

```



tidak kompatibel.



Lebih buruk, failure pada `saveStateToStorage()` ditangkap tetapi sebagian caller tidak menangani hasil gagal tersebut.



User dapat merasa chat sudah tersimpan, lalu refresh:



```text

history hilang

```



\### Gunakan



```text

localStorage

→ small preferences/index only



IndexedDB / OPFS

→ chats, blobs, attachments

```



\---



\# 16. Persistence saat streaming terlalu mahal



Selama streaming, state lengkap dapat diserialisasi berulang.



Pada chat besar:



```text

JSON.stringify(entire state)

\+

localStorage.setItem(...)

```



berjalan di main thread.



Di sisi renderer, growing Markdown juga dirender kembali berkali-kali.



Jadi beban selama response panjang kira-kira:



```text

growing response

↓

parse Markdown dari awal

↓

sanitize DOM dari awal

↓

replace innerHTML

↓

stringify state lengkap

↓

localStorage

↓

ulang

```



Ini akan semakin mahal seiring panjang response.



Solusi:



```text

stream raw/incremental text 50–150 ms

final Markdown render saat selesai

persist lebih jarang

persist delta/message saja

```



\---



\# 17. Banyak format attachment diklaim didukung tetapi sebenarnya tidak



Classifier menerima:



| Jenis        | Ekstensi                        |

| ------------ | ------------------------------- |

| Presentation | `pptx`, `ppt`, `ppsx`, `odp`    |

| Document     | `docx`, `doc`, `odt`, `rtf`     |

| Spreadsheet  | `xlsx`, `xls`, `ods`            |

| Archive      | `zip`, `rar`, `7z`, `tar`, `gz` |



Tetapi extractornya pada dasarnya menggunakan:



```text

JSZip + OOXML internal structure

```



Contoh:



```text

ppt/slides/...

word/document.xml

xl/worksheets/...

```



Itu sesuai:



```text

.pptx

.docx

.xlsx

```



tetapi \*\*bukan\*\* parser valid untuk:



```text

.ppt

.doc

.xls

.odp

.odt

.ods

.rar

.7z

.tar

.gz

.rtf

```



Jadi UI mengaku support format yang extractor sebenarnya tidak support.



Ini perlu dibedakan antara:



```text

recognized extension

```



dan:



```text

actually parseable format

```



\*\*Severity: P2 correctness\*\*



\---



\# 18. PDF >30 halaman mempunyai logic classification yang salah



Text extraction:



```js

const maxPages = Math.min(pdf.numPages, 30);

```



Tetapi image-based detection:



```js

totalTextChars / pageCount

```



`totalTextChars` hanya berasal dari maksimal 30 halaman.



`pageCount` berasal dari seluruh PDF.



Misalnya:



```text

PDF digital = 300 halaman

text dihitung = hanya halaman 1–30

pembagi       = 300

```



Rata-rata karakter/page menjadi terlalu kecil.



Akibatnya PDF digital panjang dapat salah dianggap sebagai scanned document.



Seharusnya:



```js

totalTextChars / maxPages

```



atau jumlah actual pages yang dianalisis.



\---



\# 19. PDF menyatakan “seluruh halaman” padahal maksimal 25



Saat dianggap image-based:



```js

const renderLimit = Math.min(pdf.numPages, 25);

```



Tetapi prompt yang dibuat:



```text

Seluruh halaman dokumen ini telah dikonversi...

Baca dan analisis seluruh materi...

```



Untuk PDF 100 halaman:



```text

actual visual pages = 25

claim               = seluruh 100

```



Model kemudian didorong menganggap telah melihat bagian yang sebenarnya tidak diberikan.



Ini bisa menciptakan hallucination.



\---



\# 20. XLSX hanya mengambil sebagian kecil workbook



Extractor hanya:



```js

Math.min(sheetFiles.length, 3)

```



dan per worksheet maksimal:



```js

rowCount < 100

```



Jadi:



```text

maks 3 sheet

maks 100 row/sheet

```



Selain itu parsing cell XML menggunakan regex sederhana, sehingga formula, rich cell structure, inline strings, merged cells dan struktur workbook tertentu tidak sepenuhnya direpresentasikan.



Ini boleh sebagai preview, tetapi UI/system prompt tidak boleh mengklaim analisis keseluruhan workbook.



\---



\# 21. Tidak ada context/token budgeting



File text dapat cukup besar.



ZIP bahkan dapat mengekstrak banyak file.



PDF dapat menambahkan banyak base64 image.



Namun tidak ada layer seperti:



```text

model context window

&#x20;    ↓

system prompt tokens

&#x20;    ↓

conversation tokens

&#x20;    ↓

attachment tokens

&#x20;    ↓

reserved output tokens

```



untuk menghitung apakah payload muat.



Akibatnya potensial:



```text

context length exceeded

HTTP 400

cost tinggi

latency tinggi

browser memory spike

```



Harus ada centralized `ContextBudgetManager`.



\---



\# 22. Tidak ada capability matrix model/provider



Kode cenderung memperlakukan provider sebagai OpenAI-compatible dengan kemampuan serupa.



Padahal berbeda model/provider bisa berbeda pada:



```text

vision

reasoning

web search

temperature

max\_tokens

stream semantics

image input

tool calls

context size

```



Saat ini attachment image/pageImages tetap bisa disiapkan walaupun selected model tidak vision-capable.



Web Search toggle juga muncul secara umum, padahal implementasinya:



```js

if (options.webSearch \&\& provider === 'openrouter') {

&#x20;   payload.plugins = \[{ id: 'web' }];

}

```



Jadi pada Groq/OpenAI/provider lain UI dapat mengatakan web search aktif tetapi backend code \*\*tidak melakukan apa-apa\*\*.



OpenRouter sendiri memang mendukung web plugin tersebut saat ini, tetapi format citation modernnya juga dapat muncul melalui `message.annotations\[].url\_citation`; parser proyek hanya memeriksa `parsed.citations`/`delta.citations`. Jadi citation UI dapat melewatkan citation resmi tersebut. (\[OpenRouter]\[1])



\---



\# 23. Cohere integration tidak sesuai endpoint



Saat ini Cohere default base URL:



```text

https://api.cohere.com/v2

```



kemudian generic provider flow membuat:



```text

/v2/chat/completions

```



Masalahnya Cohere native Chat API bukan endpoint tersebut.



Cohere menyediakan OpenAI compatibility melalui endpoint khusus `/compatibility/v1`, sedangkan native v2 menggunakan pola API Cohere sendiri. (\[Cohere Documentation]\[2])



Jadi adapter Cohere sekarang secara konseptual mencampurkan:



```text

native base URL

\+

OpenAI-compatible path/body

```



\*\*Severity: P1 provider integration\*\*



\---



\# 24. Daftar Anthropic hardcoded sudah retired



Curated list proyek antara lain:



```text

claude-3-5-sonnet-20241022

claude-3-5-haiku-20241022

claude-3-opus-20240229

```



Pada \*\*4 September 2026\*\*, model-model tersebut sudah retired menurut dokumentasi resmi Anthropic. Sonnet 3.5 retired pada Oktober 2025, Opus 3 pada Januari 2026, dan Haiku 3.5 pada Februari 2026. (\[Claude Platform]\[3])



Jadi fallback/default Anthropic dapat gagal walaupun API key valid.



Solusi bukan hanya mengganti tiga string. Yang lebih tepat:



```text

dynamic catalog

\+

fallback catalog versioned

\+

provider model lifecycle handling

```



\---



\# 25. Curated Groq juga sangat stale



Hardcoded list mencakup antara lain:



```text

mixtral-8x7b-32768

gemma2-9b-it

deepseek-r1-distill-llama-70b

llama-3.1-8b-instant

llama-3.3-70b-versatile

```



Beberapa telah dihentikan sepanjang 2025, dan lifecycle model Groq terus berubah. Bahkan model Llama 3.1/3.3 tertentu mengalami perubahan availability pada 2026 tergantung tier. (\[GroqCloud]\[4])



Jadi curated list sebaiknya hanya fallback minimal, bukan authoritative model catalog.



\---



\# 26. System prompt terlalu besar dan mengklaim capability yang tidak benar



`app-knowledge.js` berukuran sekitar \*\*12 ribu karakter\*\*, kira-kira ribuan token, lalu dimasukkan ke setiap conversation.



Di dalamnya ada instruksi seperti:



```text

memiliki mata visual

baca setiap...

riset secara mendalam...

tanpa batasan...

jangan menolak...

seluruh materi...

```



Masalahnya capability tersebut tidak selalu tersedia.



Misalnya selected model:



```text

tidak vision capable

tidak punya web search

hanya menerima sebagian PDF

```



tetapi system prompt mengatakan seolah semua capability tersedia.



Dampaknya:



```text

token overhead

biaya

instruction dilution

hallucination

konflik dengan provider policy

jawaban terlalu percaya diri

```



System prompt seharusnya dibangun berdasarkan capability aktual:



```text

base prompt

\+

vision capability?

\+

web capability?

\+

attachment summary?

\+

memory?

```



bukan satu mega-prompt universal.



\---



\# 27. Long-term memory rawan persistent prompt injection



`memory.js` menyimpan semua memory tanpa:



```text

limit

deduplication

expiry

size cap

validation

```



Kemudian:



```js

const memoryLines =

&#x20;   memories.map(m => `- ${m.text}`).join('\\n');

```



dan system prompt mengatakan memory tersebut:



```text

harus selalu Anda ingat dan terapkan

```



Model bahkan dapat menghasilkan command semacam:



```text

\[MEMORY\_ADD: ...]

```



yang kemudian diekstrak.



Artinya hostile content dari:



```text

website

document

prompt injection

model hallucination

```



berpotensi berubah menjadi \*\*persistent high-priority context\*\* untuk conversation berikutnya.



Memory seharusnya dianggap:



```text

untrusted user data

```



bukan instruction.



\---



\# 28. Image generation diam-diam menggunakan layanan berbeda



`services/image-generator.js` membuat URL ke:



```text

image.pollinations.ai

```



Jadi request gambar tidak benar-benar menggunakan selected LLM provider.



Flow:



```text

user pilih provider X

↓

minta gambar

↓

prompt dikirim ke Pollinations

```



UI tidak terlalu jelas bahwa prompt berpindah ke external provider lain.



Selain itu aplikasi langsung menampilkan:



```text

Gambar AI berhasil dibuat

```



tanpa menunggu image `load` sukses.



Jadi 404/network failure tetap dapat mendapatkan success toast.



\---



\# 29. Chat selection tidak selalu dipersist



Beberapa callback `renderChats()` melakukan:



```js

state.currentChatId = id;

refreshUI();

```



tanpa:



```js

saveStore();

```



Akibatnya memilih chat lalu langsung reload dapat membuka chat yang sebelumnya tersimpan, bukan selection terbaru.



Ini bukan data corruption tetapi consistency bug.



\---



\# 30. Markdown export bukan benar-benar Markdown



Export `.md` dilakukan dari rendered DOM menggunakan pendekatan berbasis `innerText`.



Akibatnya struktur seperti:



````markdown

\# Heading



\- list



\*\*bold\*\*



\[link](url)



```js

code

````



````



dapat berubah menjadi plain text.



File memang berakhiran:



```text

.md

````



tetapi syntax Markdown asli sudah hilang.



Yang seharusnya diekspor adalah \*\*source Markdown `message.content`\*\*, bukan `innerText` hasil render.



\---



\# 31. Syntax filename pada code fence tidak terintegrasi



System prompt menginstruksikan:



````text

```python:analisis\_data.py

````



Tetapi parser action code menggunakan language-class regex yang pada dasarnya berhenti sebelum colon.



Jadi `analisis\_data.py` tidak benar-benar diterjemahkan menjadi filename yang diminta.



System prompt dan implementation contract tidak sinkron.



\---



\# 32. CSS saat ini memiliki dua design system yang saling override



`index.html` memuat:



```text

theme.css

base.css

layout.css

components.css

modal.css

animations.css

style.css ← terakhir

```



Tetapi `style.css` sendiri mengulang banyak definition dari file modular.



Static analysis menemukan ratusan selector yang overlap antar file.



Contoh konsep yang saling timpa:



```text

font

chat width

colors

spacing

component styling

```



Karena `style.css` dimuat paling akhir, sebagian modular design system diam-diam dioverride legacy CSS.



Ada juga custom property yang dipakai tetapi tidak ditemukan definisinya secara konsisten, termasuk nama seperti:



```text

\--color-muted

```



sementara desain lain menggunakan naming yang berbeda.



\### Pilih salah satu



Ideal:



```text

tokens/theme

base

layout

components

utilities

animations

```



dan hapus legacy duplicate `style.css`.



\---



\# 33. README tidak lagi sesuai implementasi



README menyebut Highlight.js/syntax highlighting, tetapi integration actual Highlight.js tidak terlihat pada runtime code.



README juga pada dasarnya mengarahkan membuka:



```text

index.html

```



sementara project menggunakan ES Modules.



Untuk development yang konsisten sebaiknya dijalankan melalui HTTP server:



```text

localhost

```



bukan mengandalkan `file://`.



Dokumentasi juga masih menggambarkan provider lebih sedikit daripada provider yang sekarang ada dalam aplikasi.



\---



\# 34. Accessibility



Beberapa masalah yang saya temukan:



```text

maximum-scale=1 / user-scalable=no

```



mencegah pinch zoom.



Selain itu `<ul>` sidebar diisi langsung dengan `<div>` alih-alih `<li>`.



Model selector/popover belum memiliki keyboard interaction lengkap seperti arrow-key navigation/listbox semantics.



Ini bukan blocker, tetapi perlu sebelum produk dianggap polished/production-ready.



\---



\# 35. Theme `system` tidak live mengikuti OS



System theme membaca:



```js

matchMedia('(prefers-color-scheme: dark)')

```



tetapi tidak terlihat listener untuk perubahan preference.



Kalau user mengganti Windows:



```text

Light → Dark

```



saat aplikasi tetap terbuka, UI tidak otomatis mengikuti sampai refresh/reapply theme.



\---



\# 36. State schema terlalu banyak alias



Sekarang ada beberapa konsep yang diduplikasi:



```text

apiKey

apiKeys



baseUrl

customBaseUrls



selectedModel

providerModels



temperature root

config.temperature



maxTokens root

config.maxTokens

```



Ini akar dari banyak bug.



Contohnya `baseUrl` yang saya bahas bukan isolated bug; itu akibat \*\*dua source of truth\*\*.



Target schema yang lebih sehat kira-kira:



```js

{

&#x20; currentProvider: "groq",



&#x20; providers: {

&#x20;   groq: {

&#x20;     apiKey: "...",

&#x20;     baseUrl: "...",

&#x20;     selectedModel: "..."

&#x20;   },



&#x20;   openrouter: {

&#x20;     apiKey: "...",

&#x20;     baseUrl: "...",

&#x20;     selectedModel: "..."

&#x20;   }

&#x20; },



&#x20; generation: {

&#x20;   temperature: 0.7,

&#x20;   maxTokens: 4096

&#x20; },



&#x20; chats: \[],

&#x20; currentChatId: null

}

```



Satu konsep = satu authoritative state.



\---



\# 37. Provider abstraction terlalu generik



Saat ini hampir seluruh provider dipaksa melalui pola:



```text

OpenAI-compatible /chat/completions

```



dengan exception khusus Anthropic.



Pendekatan ini cepat untuk prototype tetapi semakin rapuh ketika jumlah provider bertambah.



Lebih sehat:



```text

ProviderAdapter

│

├── resolveEndpoint()

├── buildHeaders()

├── transformMessages()

├── buildPayload()

├── parseStream()

├── fetchModels()

└── capabilities

```



Lalu:



```text

OpenRouterAdapter

GroqAdapter

AnthropicAdapter

GeminiAdapter

CohereAdapter

OllamaAdapter

...

```



Bukan satu function besar dengan condition provider di banyak tempat.



\---



\# 38. Hal yang sudah bagus



Audit ini bukan berarti semua code buruk. Beberapa fondasinya justru sehat:



| Area                            | Status                                          |

| ------------------------------- | ----------------------------------------------- |

| Modular ES6 organization        | Baik                                            |

| Relative import resolution      | Semua valid                                     |

| Circular dependencies           | Tidak ditemukan                                 |

| HTML duplicate IDs              | Tidak ditemukan                                 |

| Local asset paths               | Valid                                           |

| Markdown assistant sanitization | Sudah memakai DOMPurify                         |

| External Markdown links         | `noopener noreferrer`                           |

| User chat plain content         | banyak bagian sudah memakai safe text rendering |

| Store abstraction               | Sudah dipisahkan                                |

| Provider config registry        | Konsep dasarnya bagus                           |

| File processing modules         | Separation cukup jelas                          |

| AbortController                 | Sudah ada fondasi                               |

| Streaming abstraction           | Sudah dipisahkan                                |

| Memory service                  | Sudah modular                                   |

| i18n foundation                 | Sudah tersedia                                  |



Karena itu saya \*\*tidak menyarankan rewrite total\*\*.



Yang dibutuhkan adalah hardening dan refactor beberapa kontrak inti.



\---



\# Prioritas perbaikan



Saya akan mengerjakannya dalam urutan berikut bila proyek ini ingin distabilkan:



1\. \*\*Restore boot:\*\* perbaiki syntax `app-knowledge.js`, lalu tambahkan automated module parse/syntax check.

2\. \*\*Betulkan state/provider:\*\* hapus dual source `baseUrl`, `apiKey`, model config; buat canonical provider state.

3\. \*\*Betulkan SSE parser:\*\* persistent buffer + correct SSE event parser + decoder flush.

4\. \*\*Security pass:\*\* hilangkan raw API-key chat handling, tutup seluruh `innerHTML` XSS sink, audit secret storage.

5\. \*\*Betulkan attachment lifecycle:\*\* remove by ID, jangan clear sebelum send validated.

6\. \*\*Betulkan local/custom provider:\*\* key optional harus konsisten dari UI sampai application layer.

7\. \*\*Generation concurrency:\*\* generation ID/controller identity; amankan Stop → Restart dan chat switching.

8\. \*\*Provider adapter layer:\*\* terutama Cohere dan provider non-OpenAI-native.

9\. \*\*Capability matrix:\*\* vision/web/reasoning/context/output parameters per model/provider.

10\. \*\*Storage migration:\*\* attachment/chat besar ke IndexedDB, bukan `localStorage`.

11\. \*\*Context budget:\*\* truncation/token budgeting sebelum request.

12\. \*\*File parser contract:\*\* hanya advertise format yang benar-benar didukung; perbaiki PDF/XLSX truncation disclosure.

13\. \*\*Model lifecycle:\*\* hapus hardcoded retired model dan gunakan dynamic catalog + safe fallback.

14\. \*\*System prompt/memory:\*\* pendekkan prompt dan perlakukan memory sebagai untrusted data.

15\. \*\*CSS cleanup + accessibility + README.\*\*

16\. \*\*Tambahkan test suite:\*\* minimal state/provider unit tests, SSE parser tests, attachment tests, XSS tests, race-condition tests, dan smoke test startup.



\## Status akhirnya



Kalau diklasifikasikan secara engineering:



| Area                  | Penilaian saat ini                       |

| --------------------- | ---------------------------------------- |

| Struktur proyek       | \*\*cukup baik\*\*                           |

| Maintainability       | \*\*sedang\*\*                               |

| Runtime correctness   | \*\*bermasalah\*\*                           |

| Provider integration  | \*\*berisiko tinggi\*\*                      |

| Streaming reliability | \*\*bermasalah\*\*                           |

| File handling         | \*\*fitur luas tetapi terlalu optimistis\*\* |

| Storage architecture  | \*\*tidak scalable\*\*                       |

| Security              | \*\*perlu hardening serius\*\*               |

| Performance long-chat | \*\*perlu optimasi\*\*                       |

| Production readiness  | \*\*belum\*\*                                |



\*\*Temuan paling kritis:\*\* startup syntax blocker, stale/cross-provider `baseUrl`, SSE chunk corruption, API-key leakage path, stored XSS, local-provider key gate, dan state/provider schema yang tidak mempunyai single source of truth.



Saya juga membedakan masalah yang saya \*\*buktikan langsung melalui parsing/simulasi\*\* dari masalah integrasi eksternal. Saya tidak mengirim request nyata menggunakan API key Anda; status model/provider eksternal saya verifikasi terhadap dokumentasi provider saat ini. Jadi audit ini tidak bergantung pada kredensial pribadi.

