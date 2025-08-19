 import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import OpenAI from "openai";

const app = express();
app.use(cors());
app.use(bodyParser.json());

// 👇 Раздаём статику из /public
app.use(express.static("public"));

// 👇 Инициализация OpenAI (ключ берётся из переменной окружения)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Генерация картинки
app.post("/generate", async (req, res) => {
  try {
    const { prompt, size } = req.body; // size: "1024x1024" | "1024x1792" | "1792x1024"
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const result = await openai.images.generate({
      model: "gpt-image-1",
      prompt,
      size: size || "1024x1024",
      // можно добавить background: "transparent" при необходимости
    });

    const b64 = result.data[0].b64_json;
    const dataUrl = `data:image/png;base64,${b64}`;

    return res.json({
      image: dataUrl,
      output: [dataUrl]
    });
  } catch (err) {
    console.error("Generation error:", err);
    return res.status(500).json({ error: err?.message || "Generation failed" });
  }
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
