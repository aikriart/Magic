import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import OpenAI from "openai";

const app = express();
app.use(cors());
app.use(bodyParser.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// обработчик генерации изображений
const generateHandler = async (req, res) => {
  try {
    const { prompt } = req.body;

    const resp = await openai.images.generate({
      model: "gpt-image-1",
      prompt,
      size: "1024x1024",
    });

    // нормализуем ответ в массив
    const images = (resp.data || [])
      .map(d => d.url || (d.b64_json ? `data:image/png;base64,${d.b64_json}` : null))
      .filter(Boolean);

    if (!images.length) {
      return res.status(500).json({ error: "OpenAI вернул пустой ответ", details: resp });
    }

    return res.json({ output: images });
  } catch (error) {
    console.error("Ошибка генерации:", error);
    return res.status(500).json({ error: error.message || String(error) });
  }
};

// маршруты
app.post("/api/generate", generateHandler);
app.post("/generate", generateHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
});
