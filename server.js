import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import OpenAI from "openai";

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Health-check
app.get("/health", (req, res) => res.json({ ok: true }));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Универсальный обработчик: вернём и image, и output
const generateHandler = async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: "Пустой prompt" });
    }

    const resp = await openai.images.generate({
      model: "gpt-image-1",
      prompt,
      size: "1024x1024",
      // n: 1, // можно включить при необходимости
      // response_format: "url" // по умолчанию url
    });

    const images = (resp.data || [])
      .map(d => d.url || (d.b64_json ? `data:image/png;base64,${d.b64_json}` : null))
      .filter(Boolean);

    if (!images.length) {
      return res.status(502).json({ error: "OpenAI вернул пустой ответ", details: resp });
    }

    // Совместимость со старым фронтом и тест-страницей
    return res.json({ image: images[0], output: images });
  } catch (err) {
    console.error("[/generate error]", err);
    const msg = err?.message || String(err);
    return res.status(500).json({ error: msg });
  }
};

// Подключаем маршруты
app.post("/api/generate", generateHandler);
app.post("/generate", generateHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
