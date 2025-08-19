// server.js (полная версия)

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";

// ---------- базовая инициализация ----------
const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

// Расчёт __dirname в ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Раздача статических файлов из ./public
app.use(express.static(path.join(__dirname, "public")));

// ---------- OpenAI клиент ----------
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // ключ берется из переменных окружения
});

// ---------- вспомогалки ----------
const VALID_SIZES = new Set(["1024x1024", "1024x1792", "1792x1024"]);
function normalizeSize(size) {
  if (typeof size !== "string") return "1024x1024";
  const trimmed = size.trim();
  if (VALID_SIZES.has(trimmed)) return trimmed;
  // если пришло что-то вроде "1024×1792" с другим знаком × — поправим
  const xFixed = trimmed.replace(/[×xX]/, "x");
  if (VALID_SIZES.has(xFixed)) return xFixed;
  return "1024x1024";
}

// ---------- маршруты ----------
app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true });
});

// Генерация изображений
app.post("/generate", async (req, res) => {
  try {
    const { prompt = "", size: rawSize, style = "" } = req.body || {};

    // Проверим size заранее, чтобы избежать ошибки "The string did not match the expected pattern"
    const size = normalizeSize(rawSize);

    // Собираем финальный промпт со стилем (если выбран)
    const fullPrompt =
      style && String(style).trim().length > 0
        ? `${prompt}\n\nStyle: ${style}`
        : prompt;

    if (!fullPrompt || !fullPrompt.trim()) {
      return res.status(400).json({ error: "Пустой prompt" });
    }

    // Вызов OpenAI Images API
    const result = await openai.images.generate({
      model: "gpt-image-1",
      prompt: fullPrompt,
      size, // "1024x1024" | "1024x1792" | "1792x1024"
      // можно добавить: quality: "high", background: "transparent" (при необходимости)
    });

    // Берем первое изображение в ответе и упаковываем в data URL
    const outputs = (result?.data || []).map((d) => `data:image/png;base64,${d.b64_json}`);
    const firstImage = outputs[0] ?? null;

    return res.status(200).json({
      image: firstImage,
      output: outputs,
      size,
      style,
    });
  } catch (err) {
    console.error("Ошибка генерации:", err?.response?.data || err?.message || err);

    // Расскажем пользователю понятным текстом
    let message = "Ошибка генерации изображения.";
    const raw = String(err?.message || "");
    if (raw.includes("did not match the expected pattern")) {
      message =
        "Неверный формат параметра size. Используйте 1024x1024, 1024x1792 или 1792x1024.";
    }

    return res.status(500).json({
      error: message,
      details: err?.response?.data || raw,
    });
  }
});

// На Render/других PaaS требуется слушать PORT из окружения
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
