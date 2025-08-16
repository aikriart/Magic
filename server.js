// server.js — полный файл

import "dotenv/config";
import express from "express";
import bodyParser from "body-parser";
import Replicate from "replicate";

const app = express();

// парсим JSON и отдаём статику из /public (index.html, /styles и т.д.)
app.use(bodyParser.json({ limit: "10mb" }));
app.use(express.static("public"));

// инициализация Replicate по токену
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

// проверка живости
app.get("/health", (_req, res) => res.send("ok"));

// основной эндпоинт генерации
app.post("/api/generate", async (req, res) => {
  try {
    const { prompt, reference } = req.body || {};

    if (!prompt || !reference) {
      return res.status(400).json({
        error: "Нужны оба поля: prompt и reference (например: style07.jpg)",
      });
    }

    // Строим ПУБЛИЧНЫЙ HTTPS-URL к твоему референсу.
    // Можно задать явно через переменную окружения PUBLIC_BASE_URL
    // (например https://magic-XXXX.onrender.com),
    // иначе возьмём хост из запроса.
    const baseUrl =
      process.env.PUBLIC_BASE_URL || `https://${req.get("host")}`;
    const imageUrl = `${baseUrl}/styles/${reference}`;

    console.log("[GEN]", { prompt, imageUrl });

    // Вызов модели на Replicate (Flux). При необходимости можно сменить модель.
    const output = await replicate.run("black-forest-labs/flux-dev", {
      input: {
        prompt: prompt,
        image: imageUrl, // <-- даём модели https-ссылку, а не локальный путь
      },
    });

    // Replicate обычно возвращает массив ссылок; берём первую
    const resultUrl = Array.isArray(output) ? output[0] : output;

    if (!resultUrl) {
      throw new Error("Replicate не вернул ссылку на изображение");
    }

    res.json({ imageUrl: resultUrl });
  } catch (err) {
    console.error("[ERROR]", err);
    res.status(500).json({ error: "Ошибка генерации: " + err.message });
  }
});

// порт для Render (даёт через env), локально — 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server started on http://localhost:${PORT}`);
});
