// server.js — минимальная рабочая версия под Render
require('dotenv').config();

const express = require('express');
const path = require('path');
const { mkdir, writeFile } = require('fs').promises;
const OpenAI = require('openai');

const app = express();

// парсим JSON и отдаём статику из /public
app.use(express.json({ limit: '2mb' }));
app.use('/public', express.static(path.join(process.cwd(), 'public')));

// клиент OpenAI
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// корневая страница (если у тебя есть index.html в корне проекта)
// ВЕРСИЯ ОБРАБОТЧИКА /generate, которая сохраняет файл и отдаёт URL из /public
const path = require('path');
const { writeFile, mkdir } = require('fs').promises;
const { randomUUID } = require('crypto');

// Гарантируем папку public/out
async function ensureDir(p) { try { await mkdir(p, { recursive: true }); } catch(e){} }

app.post('/generate', async (req, res) => {
  try {
    const prompt = (req.body?.prompt || '').toString().trim();
    if (!prompt) return res.status(400).json({ error: 'Empty prompt' });

    // Размер, который точно поддерживает API (вертикальный)
    const SIZE = '1024x1536';

    // Генерация
    const result = await client.images.generate({
      model: 'gpt-image-1',
      prompt,
      size: SIZE,
      quality: 'high'
    });

    // Получаем base64
    const b64 = result.data[0].b64_json;
    if (!b64) return res.status(500).json({ error: 'No image data' });

    // Сохраняем в /public/out/<uuid>.png
    const id = randomUUID();
    const outDir = path.join(process.cwd(), 'public', 'out');
    await ensureDir(outDir);
    const filePath = path.join(outDir, `${id}.png`);
    await writeFile(filePath, Buffer.from(b64, 'base64'));

    // Отдаём URL, который статика сможет раздать
    return res.json({ url: `/out/${id}.png` });
  } catch (err) {
    console.error('GENERATION ERROR:', err?.message || err);
    return res.status(500).json({ error: 'generation_failed' });
  }
});

// На всякий случай простой health-check
app.get('/ping', (_req, res) => res.send('ok'));


    const b64 = result.data?.[0]?.b64_json;
    if (!b64) throw new Error('No image data from OpenAI');

    const imgBuffer = Buffer.from(b64, 'base64');

    // 4) Сохранение
    const outDir = path.join(process.cwd(), 'public', 'out');
    await mkdir(outDir, { recursive: true });

    const filename = `${Date.now()}.png`;
    const filepath = path.join(outDir, filename);
    await writeFile(filepath, imgBuffer);

    // 5) Отдаём ссылку клиенту
    return res.json({ url: `/public/out/${filename}` });
  } catch (err) {
    console.error('IMAGE GEN ERROR:', err?.response?.data || err);
    return res.status(500).json({
      error: 'Сбой генерации',
      details: err?.response?.data?.error?.message || err?.message || 'unknown'
    });
  }
});

// порт для Render
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
