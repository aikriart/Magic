'use strict';

require('dotenv').config();
const express = require('express');
const path = require('path');
const { mkdir, writeFile } = require('fs').promises;
const OpenAI = require('openai');

// ---- CONFIG -------------------------------------------------
const app = express();
const PORT = process.env.PORT || 10000;
const SIZE = '1024x1536';                 // допустимый вертикальный размер
const PUBLIC_DIR = path.join(__dirname, 'public');
const OUT_DIR = path.join(PUBLIC_DIR, 'out');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(PUBLIC_DIR));

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---- API: генерация картинки -------------------------------
app.post('/generate', async (req, res) => {
  try {
    const { prompt, style } = req.body || {};
    const p = (prompt || '').toString().trim();
    if (!p) return res.status(400).json({ error: 'NO_PROMPT' });

    const fullPrompt = style ? `${p}. Style: ${style}` : p;

    const result = await client.images.generate({
      model: 'gpt-image-1',
      prompt: fullPrompt,
      size: SIZE,
      quality: 'high'
    });

    const b64 = result.data[0]?.b64_json;
    if (!b64) throw new Error('NO_IMAGE_FROM_OPENAI');

    const buf = Buffer.from(b64, 'base64');
    await mkdir(OUT_DIR, { recursive: true });
    const filename = `img_${Date.now()}.png`;
    await writeFile(path.join(OUT_DIR, filename), buf);

    res.json({ image: `/out/${filename}` });
  } catch (err) {
    console.error('GENERATION_ERROR:', err?.message || err);
    res.status(500).json({ error: err?.message || 'GENERATION_FAILED' });
  }
});

// ---- Отдача index.html по корню ----------------------------
app.get('*', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// ---- START -------------------------------------------------
app.listen(PORT, () => console.log('Server started on', PORT));
