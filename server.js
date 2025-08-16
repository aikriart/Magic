const express = require('express');
const path = require('path');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

/**
 * /api/generate
 * Работает в двух режимах:
 * 1) Если задан REPLICATE_VERSION  -> POST /v1/predictions { version, input }
 * 2) Если задан REPLICATE_MODEL    -> POST /v1/models/{slug}/predictions { input }
 * Минимально нужен только REPLICATE_API_TOKEN.
 */
app.post('/api/generate', async (req, res) => {
  try {
    const token   = process.env.REPLICATE_API_TOKEN;
    const version = process.env.REPLICATE_VERSION;              // длинный UUID
    const model   = process.env.REPLICATE_MODEL;                // напр. "black-forest-labs/flux-schnell"

    if (!token) {
      return res.status(500).json({ error: 'REPLICATE_API_TOKEN не задан' });
    }
    if (!version && !model) {
      return res.status(400).json({ error: 'Задай REPLICATE_VERSION (UUID) или REPLICATE_MODEL (slug)' });
    }

    // что передаём в модель (prompt и прочие опции приходят с фронта)
    const input = req.body && Object.keys(req.body).length ? req.body : {};
    let url, payload;

    if (version) {
      // стабильный вариант по UUID версии
      url = 'https://api.replicate.com/v1/predictions';
      payload = JSON.stringify({ version, input });
    } else {
      // вариант по slug модели
      url = `https://api.replicate.com/v1/models/${model}/predictions`;
      payload = JSON.stringify({ input });
    }

    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json'
      },
      body: payload
    });

    const pred = await r.json();
    if (!r.ok) return res.status(r.status).json(pred);

    // Если не используем webhooks — простой поллинг до готовности
    let current = pred;
    while (['starting','processing','queued'].includes(current.status)) {
      await new Promise(s => setTimeout(s, 1500));
      const poll = await fetch(`https://api.replicate.com/v1/predictions/${current.id}`, {
        headers: { 'Authorization': `Token ${token}` }
      });
      current = await poll.json();
      if (!poll.ok) return res.status(poll.status).json(current);
    }

    if (current.status !== 'succeeded') {
      return res.status(500).json({ error: 'Generation failed', details: current });
    }

    // Возвращаем массив URL-ов картинок
    return res.json({ output: current.output });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error', details: String(e) });
  }
});

// SPA-фоллбек (если нужен)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on ${PORT}`);
});
