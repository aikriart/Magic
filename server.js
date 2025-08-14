// server.js — Express + OpenAI (вертикальные картинки 1024x1536)
require('dotenv').config();
const express = require('express');
const path = require('path');
const { mkdir, writeFile } = require('fs/promises');
const OpenAI = require('openai');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// раздаём статические файлы из /public
app.use(express.static('public'));

// OpenAI клиент (ключ берём из переменной окружения)
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Жёстко фиксируем допустимый вертикальный размер
const SIZE = '1024x1536';

// API: создание изображения
app.post('/generate', async (req, res) => {
  try {
    const { prompt, style } = req.body || {};
    const cleanPrompt = (prompt || '').toString().trim();

    if (!cleanPrompt) {
      return res.status(400).json({ error: 'NO_PROMPT' });
    }

    // Добавим стиль в промпт (необязательно)
    const fullPrompt = style ? `${cleanPrompt}. Style: ${style}` : cleanPrompt;

    const result = await client.images.generate({
      model: 'gpt-image-1',
      prompt: fullPrompt,
      size: SIZE,
      quality: 'high',
    });

    const b64 = result.data[0].b64_json;
    const buffer = Buffer.from(b64, 'base64');

    // сохраним файл в /public/out/
    const outDir = path.join(__dirname, 'public', 'out');
    await mkdir(outDir, { recursive: true });

    const filename = `img_${Date.now()}.png`;
    const absPath = path.join(outDir, filename);
    await writeFile(absPath, buffer);

    // отдаём URL для <img>
    return res.json({ image: `/out/${filename}` });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || 'GENERATION_FAILED' });
  }
});

// чтобы прямой заход по домену открывал страницу
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log('Server started on', PORT));
