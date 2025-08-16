import "dotenv/config";
import express from "express";
import bodyParser from "body-parser";
import Replicate from "replicate";

const app = express();
app.use(bodyParser.json({ limit: "10mb" }));
app.use(express.static("public"));

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

// Хелпер: собрать публичный URL к референсу и проверить формат
function buildRefUrl(reference, hostHeader) {
  const base =
    (process.env.PUBLIC_BASE_URL && process.env.PUBLIC_BASE_URL.trim()) ||
    (hostHeader ? `https://${hostHeader}` : "");

  const url = `${base}/styles/${reference}`.replace(/([^:]\/)\/+/g, "$1");
  return encodeURI(url);
}

app.post("/api/generate", async (req, res) => {
  try {
    const { prompt, reference } = req.body || {};
    if (!prompt || !reference) {
      return res.status(400).json({
        error:
          "Нужны оба поля: prompt и reference (например: style07.jpg).",
      });
    }

    const imageUrl = buildRefUrl(reference, req.get("host"));

    // простая валидация: должно начинаться с http(s)
    if (!/^https?:\/\/.+/i.test(imageUrl)) {
      return res
        .status(400)
        .json({ error: "Некорректный URL референса", imageUrl });
    }

    console.log("[GEN] prompt:", prompt);
    console.log("[GEN] ref URL:", imageUrl);

    const output = await replicate.run("black-forest-labs/flux-dev", {
      input: {
        prompt: prompt,
        image: imageUrl, // важное место: даём HTTPS-URL
      },
    });

    const resultUrl = Array.isArray(output) ? output[0] : output;
    if (!resultUrl) throw new Error("Replicate не вернул ссылку на изображение");

    res.json({ imageUrl: resultUrl });
  } catch (err) {
    console.error("[ERROR]", err);
    res.status(500).json({ error: "Ошибка генерации: " + err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server started on port ${PORT}`);
});
