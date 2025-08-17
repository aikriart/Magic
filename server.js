// server.js — Render + Replicate (FLUX/SDXL), ESM-версия
import express from 'express';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app  = express();
const PORT = process.env.PORT || 10000;

app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// --- утилита: выбрать только разрешённые ключи
function pickInput(body = {}) {
  const allowed = [
    'prompt', 'negative_prompt',
    'width', 'height', 'aspect_ratio',
    'num_outputs', 'seed',
    'output_format', 'output_quality'
  ];
  const out = {};
  for (const k of allowed) if (body[k] !== undefined) out[k] = body[k];
  return out;
}

// Проверка окружения при старте (видно в Render logs)
(function sanityCheckEnv() {
  const token = !!process.env.REPLICATE_API_TOKEN;
  const model = process.env.REPLICATE_MODEL || '';
  const version = process.env.REPLICATE_VERSION || '';
  console.log('[ENV]', {
    hasToken: token,
    model,
    version
  });
})();

// --- основной эндпоинт
app.post('/api/generate', async (req, res) => {
  try {
    const token   = process.env.REPLICATE_API_TOKEN;
    const model   = process.env.REPLICATE_MODEL   || '';   // например "black-forest-labs/flux-schnell"
    const version = process.env.REPLICATE_VERSION || '';   // если вдруг захочешь работать по UUID

    if (!token) return res.status(500).json({ error: 'REPLICATE_API_TOKEN не задан' });
    if (!model && !version) {
      return res.status(400).json({ error: 'Задай REPLICATE_MODEL (slug) или REPLICATE_VERSION (UUID)' });
    }

    const input = pickInput(req.body);
    if (!input.prompt || typeof input.prompt !== 'string' || !input.prompt.trim()) {
      return res.status(400).json({ error: 'Пустой prompt' });
    }

    // дефолты (без перегибов)
    if (input.num_outputs === undefined) input.num_outputs = 1;
    if (!input.output_format) input.output_format = 'webp';

    const url = version
      ? 'https://api.replicate.com/v1/predictions'
      : `https://api.replicate.com/v1/models/${model}/predictions`;

    const payload = version ? { version, input } : { input };

    // ВАЖНО: Prefer: wait — сразу дождёмся результата в одном запросе
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait'
      },
      body: JSON.stringify(payload)
    });

    const data = await resp.json();

    if (!resp.ok) {
      // Прокинем детали ошибки на фронт и в логи
      console.error('[Replicate error]', resp.status, JSON.stringify(data));
      return res.status(resp.status).json({
        error: data?.error || data?.detail || 'Replicate API error',
        details: data
      });
    }

    // На некоторых версиях Flux output — строка, на других — массив ссылок
    let out = data.output;
    if (typeof out === 'string') out = [out];
    if (!Array.isArray(out)) {
      console.error('[Unexpected output shape]', JSON.stringify(data));
      return res.status(500).json({
        error: 'Unexpected output shape from model',
        details: data
      });
    }

    return res.json({ output: out });
  } catch (e) {
    console.error('[Server error]', e);
    return res.status(500).json({ error: 'Server error', details: String(e) });
  }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
});
