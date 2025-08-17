// server.js — готовый файл под Render + Replicate (FLUX/SDXL)
// Работает и по slug (REPLICATE_MODEL), и по UUID версии (REPLICATE_VERSION)

import express from 'express';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app  = express();
const PORT = process.env.PORT || 10000;

// ---- базовая настройка сервера ----
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ---- эндпоинт генерации ----
app.post('/api/generate', async (req, res) => {
  try {
    const token   = process.env.REPLICATE_API_TOKEN;
    const version = process.env.REPLICATE_VERSION || '';            // 64-символьный UUID (если используешь версии)
    const model   = process.env.REPLICATE_MODEL   || '';            // напр. "black-forest-labs/flux-schnell"

    if (!token) return res.status(500).json({ error: 'REPLICATE_API_TOKEN не задан' });
    if (!version && !model) {
      return res.status(400).json({ error: 'Задай REPLICATE_MODEL (slug) или REPLICATE_VERSION (UUID)' });
    }

    // 1) Берём только поддерживаемые поля, чтобы FLUX/SDXL не ругались на "лишнее"
    const allowed = [
      'prompt', 'negative_prompt',
      'width', 'height', 'aspect_ratio',
      'num_outputs', 'seed',
      'output_format', 'output_quality'
    ];
    const input = {};
    for (const k of allowed) if (req.body?.[k] !== undefined) input[k] = req.body[k];

    if (!input.prompt || typeof input.prompt !== 'string' || !input.prompt.trim()) {
      return res.status(400).json({ error: 'Пустой prompt' });
    }

    if (!input.num_outputs)   input.num_outputs   = 1;
    if (!input.output_format) input.output_format = 'webp';

    // 2) Создаём prediction (по версии или по slug)
    const createUrl = version
      ? 'https://api.replicate.com/v1/predictions'
      : `https://api.replicate.com/v1/models/${model}/predictions`;

    const payload = version ? { version, input } : { input };

    const createResp = await fetch(createUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    let pred = await createResp.json();
    if (!createResp.ok) return res.status(createResp.status).json(pred);

    // 3) Поллинг до завершения
    while (['starting', 'processing', 'queued'].includes(pred.status)) {
      await new Promise(s => setTimeout(s, 1500));
      const pollResp = await fetch(`https://api.replicate.com/v1/predictions/${pred.id}`, {
        headers: { 'Authorization': `Token ${token}` }
      });
      pred = await pollResp.json();
      if (!pollResp.ok) return res.status(pollResp.status).json(pred);
    }

    if (pred.status !== 'succeeded') {
      return res.status(500).json({ error: 'Generation failed', details: pred });
    }

    // 4) Нормализуем вывод в массив URL
    let out = pred.output;
    if (typeof out === 'string') out = [out];
    if (!Array.isArray(out)) {
      return res.status(500).json({ error: 'Unexpected output shape', details: pred });
    }

    res.json({ output: out });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error', details: String(e) });
  }
});

// ---- SPA fallback (если есть фронт на статиках) ----
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---- старт сервера ----
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
});
