import express from 'express';
import OpenAI from 'openai';

const app = express();
app.use(express.json());

// Простые эндпоинты для проверки работоспособности
app.get('/health', (_req, res) => res.json({ ok: true }));
app.get('/debug', (_req, res) => {
  res.json({
    ok: true,
    node: process.version,
    hasOpenAIKey: !!process.env.OPENAI_API_KEY,
  });
});

// Раздаём файлы из папки public (index.html и изображения)
app.use(express.static('./public'));

// Сюда обращается фронтенд для генерации изображения
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post('/generate', async (req, res) => {
  try {
    const prompt = (req.body && req.body.prompt) ? String(req.body.prompt) : '';
    if (!prompt.trim()) {
      return res.status(400).json({ error: 'Empty prompt' });
    }
    const response = await openai.images.generate({
      model: 'gpt-image-1',
      prompt,
      size: '1024x1024'
    });
    const output = (response.data || [])
      .map(d => d.url ? d.url : (d.b64_json ? `data:image/png;base64,${d.b64_json}` : null))
      .filter(Boolean);
    if (!output.length) {
      return res.status(502).json({ error: 'OpenAI returned empty result' });
    }
    res.json({ image: output[0], output });
  } catch (err) {
    console.error('Generate error:', err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
