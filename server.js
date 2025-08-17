// ESM-версия сервера (работает при "type":"module")
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

// Поддержка и версии (UUID), и slug
app.post('/api/generate', async (req, res) => {
  try {
    const token   = process.env.REPLICATE_API_TOKEN;
    const version = process.env.REPLICATE_VERSION;          // UUID
    const model   = process.env.REPLICATE_MODEL;            // например "black-forest-labs/flux-schnell"

    if (!token) return res.status(500).json({ error: 'REPLICATE_API_TOKEN не задан' });
    if (!version && !model) {
      return res.status(400).json({ error: 'Задай REPLICATE_VERSION (UUID) или REPLICATE_MODEL (slug)' });
    }

    const input = req.body && Object.keys(req.body).length ? req.body : {};
    let url, payload;

    if (version) {
      url = 'https://api.replicate.com/v1/predictions';
      payload = JSON.stringify({ version, input });
    } else {
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
    let pred = await r.json();
    if (!r.ok) return res.status(r.status).json(pred);

    while (['starting','processing','queued'].includes(pred.status)) {
      await new Promise(s => setTimeout(s, 1500));
      const poll = await fetch(`https://api.replicate.com/v1/predictions/${pred.id}`, {
        headers: { 'Authorization': `Token ${token}` }
      });
      pred = await poll.json();
      if (pred.error) break;
    }

    if (pred.status !== 'succeeded') {
      return res.status(500).json({ error: 'Generation failed', details: pred });
    }
    res.json({ output: pred.output });
  } catch (e) {
    res.status(500).json({ error: 'Server error', details: String(e) });
  }
});

// SPA fallback (если нужен)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on ${PORT}`);
});
