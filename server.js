// server.js — Render-ready, vertical 1024x1792, auto BASE_URL
require('dotenv').config();
const express = require('express');
const { writeFile, mkdir } = require('fs').promises;
const { randomUUID } = require('crypto');
const path = require('path');
const OpenAI = require('openai');

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use('/public', express.static('public'));

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const PORT = process.env.PORT || 10000;

// Style presets
const PRESETS = {
  beauty: [
    'beauty portrait, soft light, luminous skin, glossy lips',
    'cinematic depth, film grain, editorial quality',
    'high detail, photorealistic'
  ],
  jewelry: [
    'fashion jewelry focus, elegant necklace and ring, sparkle highlights',
    'macro-friendly contrast, bokeh background, premium vibe',
    'editorial composition, photorealistic'
  ],
  "90s": [
    '90s fashion vibe, film texture, slight flash look',
    'cassette nostalgia, warm tones, candid pose',
    'editorial yet raw, photorealistic'
  ],
  noir: [
    'noir mood, dramatic lighting, deep shadows',
    'sleek styling, mystery, cinematic composition',
    'high contrast, photorealistic'
  ]
};

function buildPrompt(userWords, presetKey='beauty') {
  const seed = String(userWords || '')
    .replace(/[^\p{L}\p{N}\s,-]+/gu, '')
    .split(',')
    .map(w => w.trim())
    .filter(Boolean)
    .slice(0, 6)
    .join(', ');

  const preset = PRESETS[presetKey] || PRESETS.beauty;
  const STYLE_BASE = [
    'blue eyes, long dark hair',
    'fashion editorial vibe',
    'composition: medium shot, strong focal point, negative space for copy',
    'no text, no watermark'
  ];

  return [
    `A striking editorial portrait of a woman; concept keywords: ${seed || 'mystery, elegance'}.`,
    ...STYLE_BASE,
    ...preset
  ].join(', ');
}

app.post('/generate', async (req, res) => {
  try {
    const { words, preset } = req.body || {};
    if (!words || typeof words !== 'string' || words.trim().length < 2) {
      return res.status(400).json({ error: 'Введите 2–3 ключевых слова.' });
    }
    const prompt = buildPrompt(words, preset);

    const imgResp = await client.images.generate({
      model: 'gpt-image-1',
      prompt,
      size: '1024x1792', // vertical
      quality: 'high'
    });

    const b64 = imgResp.data && imgResp.data[0] && imgResp.data[0].b64_json;
    if (!b64) {
      return res.status(500).json({ error: 'Не удалось получить изображение.' });
    }

    const imgBuffer = Buffer.from(b64, 'base64');

    const id = randomUUID();
    const outDir = path.join(process.cwd(), 'public', 'out');
    await mkdir(outDir, { recursive: true });
    const outPath = path.join(outDir, `${id}.png`);
    await writeFile(outPath, imgBuffer);

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const imageUrl = `${baseUrl}/public/out/${id}.png`;
    return res.json({ imageUrl, promptUsed: prompt });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Сбой генерации', details: String(err && err.message || err) });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Magic Generator (Render) running on port ${PORT}`);
});
