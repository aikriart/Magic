// server.js — рабочая версия под Render (статическая главная + генерация)
require('dotenv').config();

const express = require('express');
const path = require('path');
const { mkdir, writeFile } = require('fs').promises;
const { randomUUID } = require('crypto');
const OpenAI = require('openai');

const app = express();

// 1) Раздаём /public как статику (главная страница и готовые картинки)
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(process.cwd(), 'public')));

// 2) Клиент OpenAI
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 3) Генерация изображения (жёстко фиксируем разрешённый вертикальный размер)
app.post('/generate', async (req, res) => {
  try {
    const prompt = (req.body?.prompt || '').toString().trim().slice(0, 400);
    if (!prompt) return res.status(400).json({ error: 'Введите описание (prompt).' });

    const SIZE = '1024x1536'; // допустимый вертикальный размер

    const result = await client.images.generate({
      model: 'gpt-image-1',
      prompt,
      size: SIZE,
      quality: 'high'
    });

    const b64 = result?.data?.[0]?.b64_json;
    if (!b64) return res.status(500).json({ error: 'OpenAI не вернул изображение.' });

    const imgBuffer = Buffer.from(b64, 'base64');

    const outDir = path.join(process.cwd(), 'public', 'out');
    await mkdir(outDir, { recursive: true });

    const filename = `${randomUUID()}.png`;
    await writeFile(path.join(outDir, filename), imgBuffer);

    // Возвращаем относительный путь (раздаётся статикой)
    return res.json({ url: `/out/${filename}` });
  } catch (err) {
    console.error('IMAGE GEN ERROR:', err?.response?.data || err);
    return res.status(500).json({
      error: 'Сбой генерации',
      details: err?.response?.data?.error?.message || err?.message || 'unknown'
    });
  }
});

// 4) Все остальные маршруты — на главную страницу из /public
app.get('*', (_req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

// 5) Порт для Render
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
