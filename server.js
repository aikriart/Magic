import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";
import Replicate from "replicate";

// --------- базовая настройка ---------
const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: "2mb" }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// служим статику из /public
app.use(express.static(path.join(__dirname, "public")));

// --------- ключи из переменных окружения ---------
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_PUBLIC || "";
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN || "";

const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;
const replicate = REPLICATE_API_TOKEN ? new Replicate({ auth: REPLICATE_API_TOKEN }) : null;

// --------- корень (отдаём index.html) ---------
app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// --------- генерация ---------
// ожидает: { prompt, styleLabel, aspect }  aspect: "square" | "portrait" | "landscape"
app.post("/generate", async (req, res) => {
  try {
    const { prompt = "", styleLabel = "", aspect = "square" } = req.body || {};

    // минимальная защита
    const safePrompt = String(prompt).slice(0, 1200);
    const style = String(styleLabel).slice(0, 200);

    // 1:1 -> OpenAI; 9:16 и 16:9 -> Replicate (FLUX)
    if (aspect === "square") {
      if (!openai) {
        return res.status(400).json({ error: "OPENAI_API_KEY is missing" });
      }

      // подмешиваем стиль к промпту
      const finalPrompt = style ? `${style}, ${safePrompt}` : safePrompt;

      // OpenAI Images 1024x1024
      const r = await openai.images.generate({
        model: "gpt-image-1",
        prompt: finalPrompt,
        size: "1024x1024",
        response_format: "b64_json"
      });

      const b64 = r.data?.[0]?.b64_json;
      if (!b64) return res.status(500).json({ error: "Image generation failed (OpenAI)" });

      return res.json({
        image: `data:image/png;base64,${b64}`,
        output: [`data:image/png;base64,${b64}`]
      });
    } else {
      // 9:16 / 16:9 -> Replicate FLUX
      if (!replicate) {
        return res.status(400).json({ error: "REPLICATE_API_TOKEN is missing" });
      }

      let w = 1024, h = 1024;
      if (aspect === "portrait") { w = 1024; h = 1792; }
      if (aspect === "landscape") { w = 1792; h = 1024; }

      const finalPrompt = style ? `${style}, ${safePrompt}` : safePrompt;

      // модель FLUX (schnell) — выдаёт быстрый JPG/PNG URL
      const output = await replicate.run(
        "black-forest-labs/flux-schnell",
        {
          input: {
            prompt: finalPrompt,
            width: w,
            height: h,
            // можно немного приглушить насыщенность и пр. по вкусу:
            // guidance: 3
          }
        }
      );

      // replicate возвращает либо массив url, либо один url
      const url = Array.isArray(output) ? output[0] : output;
      if (!url) return res.status(500).json({ error: "Image generation failed (Replicate)" });

      return res.json({
        image: url,
        output: [url]
      });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: String(err?.message || err) });
  }
});

// --------- запуск ---------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
