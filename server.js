// server.js — версия с image-to-image (SDXL)

import "dotenv/config";
import express from "express";
import bodyParser from "body-parser";
import Replicate from "replicate";

const app = express();
app.use(bodyParser.json({ limit: "10mb" }));
app.use(express.static("public")); // index.html + /styles/*.jpg

// Replicate клиент
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

// Хелпер: собрать публичный URL к референсу
function buildRefUrl(reference, hostHeader) {
  const base =
    (process.env.PUBLIC_BASE_URL && process.env.PUBLIC_BASE_URL.trim()) ||
    (hostHeader ? `https://${hostHeader}` : "");
  const url = `${base}/styles/${reference}`.replace(/([^:]\/)\/+/g, "$1");
  return encodeURI(url);
}

// Быстрый дебаг: /debug-ref?file=style07.jpg
app.get("/debug-ref", (req, res) => {
  const file = req.query.file || "style01.jpg";
  const url = buildRefUrl(file, req.get("host"));
  res.json({ file, url });
});

// Основной эндпоинт генерации
app.post("/api/generate", async (req, res) => {
  try {
    const { prompt, reference, strength } = req.body || {};
    if (!prompt || !reference) {
      return res.status(400).json({
        error:
          "Нужны оба поля: prompt и reference (пример reference: style07.jpg)",
      });
    }

    // Публичная ссылка на референс
    const imageUrl = buildRefUrl(reference, req.get("host"));

    // маленькая валидация для уверенности
    if (!/^https?:\/\/.+/i.test(imageUrl)) {
      return res.status(400).json({
        error: "Некорректный URL референса",
        refUrl: imageUrl,
      });
    }

    console.log("[GEN] prompt:", prompt);
    console.log("[GEN] refUrl:", imageUrl);

    // ⚠️ Модель: SDXL image-to-image (принимает image + prompt)
    // Параметры подбираем базовые: чем больше strength, тем меньше влияние референса.
    const out = await replicate.run("stability-ai/sdxl", {
      input: {
        prompt: prompt,
        image: imageUrl,     // <-- даём HTTPS-ссылку на твою картинку
        strength: strength ?? 0.55, // 0..1 (0.35..0.65 обычно норм)
        // guidance_scale, scheduler и т.п. можно добавить при желании
      },
    });

    // SDXL обычно возвращает массив ссылок — берём первую
    const resultUrl = Array.isArray(out) ? out[0] : out;
    if (!resultUrl) throw new Error("Модель не вернула ссылку на изображение");

    res.json({ imageUrl: resultUrl, refUrl: imageUrl });
  } catch (err) {
    console.error("[ERROR]", err);
    res.status(500).json({ error: "Ошибка генерации: " + err.message });
  }
});

// ping
app.get("/health", (_req, res) => res.send("ok"));

// порт
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server started on port ${PORT}`);
});
