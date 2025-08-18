import express from 'express';
import OpenAI from 'openai';

const app = express();
app.use(express.json());

// ===== Проверочные эндпоинты =====
app.get('/health', (_req, res) => res.json({ ok: true }));
app.get('/debug', (_req, res) => {
  res.json({
    ok: true,
    node: process.version,
    hasOpenAIKey: !!process.env.OPENAI_API_KEY,
  });
});

// ===== Список стилей: название, модификатор, путь к превью =====
const styles = [
  ["Boho Sunset",  "boho outfit at golden hour, warm tones",      "/styles/Boho-Sunset.jpg"],
  ["Calm Interior","minimalist decor, serene colors, natural light", "/styles/Calm-Interior.jpg"],
  ["Cherry Gloss", "close-up glossy red lips",                    "/styles/Cherry-Gloss.jpg"],
  ["Christal Shine", "sparkling crystal headdress",               "/styles/Christal-Shine.jpg"],
  ["Cinematic Noir","high-contrast black-and-white portrait",     "/styles/Cinematic-Noir.jpg"],
  ["Crystal Spark","sparkling jewelry on dark background",        "/styles/Crystal-Spark.jpg"],
  ["Dark Velvet",  "dramatic candlelight, dark velvet attire",    "/styles/Dark-Velvet.jpg"],
  ["Golden Fantasy","fantasy golden outfit, shimmering light",    "/styles/Golden-Fantasy.jpg"],
  ["Golden Sparkle","golden dress, glitter explosion",            "/styles/Golden-Sparkle.jpg"],
  ["Ivory Light",  "minimal white outfit, soft ivory tones",      "/styles/Ivory-Light.jpg"],
  ["Midnight Glam","dark lace, sensual glamour",                  "/styles/Midnight-Glam.jpg"],
  ["Neon Dreams",  "night city, bright neon lights",              "/styles/Neon-Dreams.jpg"],
  ["Pastel Glow",  "freckles, soft light, pastel tones",          "/styles/Pastel-Glow.jpg"],
  ["Retro Wave",   "70s vibe, vintage shades, sunglasses fashion", "/styles/Retro-Wave.jpg"],
  ["Silver Glow",  "sparkling silver dress, radiant light",       "/styles/Silver-Glow.jpg"],
  ["Soft Bloom",   "soft pastel portrait, dreamy light",          "/styles/Soft-Bloom.jpg"],
  ["Surrealism",   "fantastical composition, surreal elements",   "/styles/Surrealism.jpg"],
  ["Urban Chic",   "city fashion, modern look",                   "/styles/Urban-Chic.jpg"],
  ["Vintage Dust", "vintage dress, warm earthy tones",            "/styles/Vintage-Dust.jpg"],
];

// ===== Раздача статических файлов =====
app.use(express.static('./public'));

// ===== Главная страница =====
app.get('/', (_req, res) => {
  // генерируем HTML с кнопками и превью
  let chips = '';
  for (const [name, mod, img] of styles) {
    chips += `<button class='chip' data-mod="${mod}" data-img="${img}">${name}</button>`;
  }
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.end(`<!doctype html>
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
  <div class='row'>
    <input id='prompt' type='text' value='Portrait of a woman, cinematic light'>
    <button id='generate' class='primary'>Generate</button>
  </div>
  <div style='opacity:.75;font-size:13px'>Click a style to add its description to your prompt and preview its image.</div>
  <div class='chips'>${chips}</div>
  <pre id='log'></pre>
  <div id='result'>
    <img id='preview' class='preview' src='/styles/placeholder.jpg'
         onerror="this.src='https://via.placeholder.com/512x512.png?text=Preview';">
  </div>
  <script>
    // добавляем модификатор стиля в поле и показываем превью
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
        // Показ превью
        const img = btn.dataset.img;
        if (img) preview.src = img;
      });
    });
    // Запрос к серверу для генерации
    document.getElementById('generate').addEventListener('click', async () => {
      const prompt = input.value;
      document.getElementById('log').textContent = 'Запрос отправлен...';
      const resp = await fetch('/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      const body = await resp.json();
      document.getElementById('log').textContent = 'HTTP ' + resp.status + '\\n' + JSON.stringify(body, null, 2);
      if (body.output && body.output.length) {
        document.getElementById('result').innerHTML =
          body.output.map(u => '<img class="preview" src="'+u+'">').join('');
      }
    });
  </script>
</body>
</html>`);
});

// ===== Генерация изображения через OpenAI =====
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

    const output = (r.data || [])
      .map(d => d.url ? d.url
                      : d.b64_json ? 'data:image/png;base64,' + d.b64_json
                                   : null)
      .filter(Boolean);

    if (!output.length) return res.status(502).json({ error: 'OpenAI returned empty result' });

    res.json({ image: output[0], output });
  } catch (e) {
    console.error('Generation error:', e);
    res.status(500).json({ error: e && e.message ? e.message : String(e) });
  }
});

// ===== Запуск =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server started on port ' + PORT));
