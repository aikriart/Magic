// server.js — Express + OpenAI + UI со стилями и превью
import express from 'express';
import OpenAI from 'openai';

const app = express();
app.use(express.json());

// Health‑чек
app.get('/health', (_req, res) => res.json({ ok: true }));
app.get('/debug', (_req, res) => res.json({
  ok: true,
  node: process.version,
  hasOpenAIKey: !!process.env.OPENAI_API_KEY,
}));

// ======= СПИСОК СТИЛЕЙ (имя, текст‑модификатор, путь к превью) =======
const styles = [
  ["Calm Interior",  "minimalist decor, serene colors, natural light",           "/styles/calm-interior.jpg"],
  ["Retro Wave",     "70s vibe, vintage shades, sunglasses fashion",             "/styles/retro-wave.jpg"],
  ["Crystal Spark",  "sparkling jewelry on dark background",                     "/styles/crystal-spark.jpg"],
  ["Soft Bloom",     "soft pastel portrait, dreamy light",                       "/styles/soft-bloom.jpg"],
  ["Midnight Glam",  "dark lace, sensual glamour",                               "/styles/midnight-glam.jpg"],
  ["Urban Chic",     "city fashion, sunglasses, modern look",                    "/styles/urban-chic.jpg"],
  ["Cinematic Noir", "high‑contrast black‑and‑white portrait",                   "/styles/cinematic-noir.jpg"],
  ["Pastel Glow",    "freckles, soft light, pastel tones",                       "/styles/pastel-glow.jpg"],
  ["Neon Dreams",    "cyberpunk night city, bright neon lights",                 "/styles/neon-dreams.jpg"],
  ["Cherry Gloss",   "close‑up lips with glossy red lipstick",                   "/styles/cherry-gloss.jpg"],
  ["Golden Fantasy", "fantasy golden outfit, shimmering light",                  "/styles/golden-fantasy.jpg"],
  ["Silver Glow",    "sparkling silver dress, radiant light",                    "/styles/silver-glow.jpg"],
  ["Ivory Light",    "minimal white outfit, soft ivory tones",                   "/styles/ivory-light.jpg"],
  ["Boho Sunset",    "boho outfit at golden hour, warm tones",                   "/styles/boho-sunset.jpg"],
  ["Golden Sparkle","golden dress, glitter explosion",                            "/styles/golden-sparkle.jpg"],
  ["Galaxy Fade",    "cosmic landscape, glowing clouds and rays",                "/styles/galaxy-fade.jpg"],
  ["Dark Velvet",    "dramatic candlelight, dark velvet attire",                 "/styles/dark-velvet.jpg"],
  ["Vintage Dust",   "vintage dress, warm earthy tones",                         "/styles/vintage-dust.jpg"],
  ["Crystal Shine",  "crystal headpiece, sparkles everywhere",                   "/styles/crystal-shine.jpg"],
];

// ====== Статическая раздача (стили находятся в public/styles) ======
app.use(express.static('./public'));

// ====== Главная страница ======
app.get('/', (_req, res) => {
  // Строим HTML из массива styles (кнопки и превью)
  let chips = '';
  for (const [name, mod, img] of styles) {
    chips += `<button class='chip' data-mod="${mod}" data-img="${img}">${name}</button>`;
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Image Generation</title>
  <style>
    body{font-family:Inter,Arial,sans-serif;padding:24px;max-width:960px;margin:0 auto;background:#0b0b10;color:#eaeaf0}
    h1{font-size:32px;margin:0 0 12px}
    .row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:10px}
    input{flex:1;min-width:220px;padding:10px;border-radius:8px;border:1px solid #262737;background:#12131a;color:#eaeaf0}
    button.primary{padding:10px 14px;border-radius:8px;border:1px solid #3a3cff;background:#3a3cff;color:#fff;cursor:pointer}
    .chips{display:flex;flex-wrap:wrap;gap:10px;margin:12px 0}
    .chip{border:1px solid #262737;background:#151623;color:#cfd2ff;border-radius:999px;padding:8px 12px;cursor:pointer;font-size:14px}
    .chip:hover{background:#1a1b28}
    pre{background:#0f1020;border:1px solid #262737;border-radius:12px;padding:12px;white-space:pre-wrap;margin-top:12px}
    img.preview{max-width:100%;height:auto;display:block;margin-top:12px;border-radius:12px;border:1px solid #262737}
  </style>
</head>
<body>
  <h1>Image Generation (OpenAI)</h1>
  <div class='row'><input id='prompt' type='text' value='Portrait of a woman, cinematic light'><button id='generate' class='primary'>Generate</button></div>
  <div style='opacity:.75;font-size:13px'>Click a style button to add its description to your prompt and preview its image.</div>
  <div class='chips'>${chips}</div>
  <pre id='log'></pre>
  <div id='result'><img id='preview' class='preview' src='/styles/placeholder.jpg' onerror="this.src='https://via.placeholder.com/512x512.png?text=Preview';"></div>
  <script>
    const styles = ${JSON.stringify(styles)};
    const input = document.getElementById('prompt');
    const preview = document.getElementById('preview');
    document.querySelectorAll('.chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const mod = btn.dataset.mod;
        let base = input.value.trim();
        if (!base.toLowerCase().includes(mod.toLowerCase())) {
          if (base && !base.endsWith(',')) base += ',';
          base += ' ' + mod;
        }
        input.value = base.trim();
        // показываем превью
        const img = btn.dataset.img;
        if (img) preview.src = img;
      });
    });
    document.getElementById('generate').addEventListener('click', async () => {
      const prompt = input.value;
      document.getElementById('log').textContent = 'Запрос отправлен...';
      const resp = await fetch('/generate', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ prompt }) });
      const body = await resp.json();
      document.getElementById('log').textContent = 'HTTP ' + resp.status + '\\n' + JSON.stringify(body, null, 2);
      if (body.output && body.output.length) {
        document.getElementById('result').innerHTML = body.output.map(u => '<img class="preview" src="'+u+'">').join('');
      }
    });
  </script>
</body>
</html>
`);
});

// ====== Генерация через OpenAI ======
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post('/generate', async (req, res) => {
  try {
    const prompt = (req.body && req.body.prompt) ? String(req.body.prompt) : '';
    if (!prompt.trim()) return res.status(400).json({ error: 'Empty prompt' });

    const r = await openai.images.generate({
      model: 'gpt-image-1',
      prompt,
      size: '1024x1024',
    });

    const output = (r.data || []).map(d =>
      d.url ? d.url
            : d.b64_json
              ? 'data:image/png;base64,' + d.b64_json
              : null
    ).filter(Boolean);

    if (!output.length) return res.status(502).json({ error: 'OpenAI returned empty result' });

    res.json({ image: output[0], output });
  } catch (e) {
    console.error('Generation error:', e);
    res.status(500).json({ error: e && e.message ? e.message : String(e) });
  }
});

// ====== Запуск сервера ======
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server started on port ' + PORT));
