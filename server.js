import express from "express";
import cors from "cors";
import bodyParser from "body-parser";

import OpenAI from "openai";
import Replicate from "replicate";

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

// --- ключи из Render ---
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN || "";

// --- клиенты (если ключей нет — бросим ошибку при вызове) ---
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;
const replicate = REPLICATE_API_TOKEN ? new Replicate({ auth: REPLICATE_API_TOKEN }) : null;

/* ---------- Хелперы ---------- */

// соотношение → безопасные размеры для FLUX
function safeFluxDims(aspect) {
  if (aspect === "portrait")   return { width: 576,  height: 1024 }; // 9:16
  if (aspect === "landscape")  return { width: 1024, height: 576  }; // 16:9
  return { width: 1024, height: 1024 }; // fallback square
}

// принимаем как aspect-строку, так и "WxH"
function normalizeAspect(aspectOrSize) {
  const val = (aspectOrSize || "square").toString().trim().toLowerCase();

  if (["square", "portrait", "landscape"].includes(val)) return val;

  const m = val.match(/^(\d+)\s*x\s*(\d+)$/i);
  if (m) {
    const w = parseInt(m[1], 10);
    const h = parseInt(m[2], 10);
    if (w === h) return "square";
    if (w < h)   return "portrait";
    return "landscape";
  }
  return "square";
}

function buildPrompt(prompt, styleLabel) {
  if (!styleLabel) return prompt || "";
  return `${prompt || ""}\n\nStyle reference: ${styleLabel}.`;
}

/* ---------- Провайдеры ---------- */

// OpenAI (только квадрат)
async function generateOpenAISquareImage(promptText) {
  if (!openai) throw new Error("OPENAI_API_KEY is missing");

  const out = await openai.images.generate({
    model: "gpt-image-1",
    prompt: promptText,
    size: "1024x1024", // у OpenAI только квадрат
  });

  // разные SDK отдают либо b64, либо url — приведём к data URL
  const b64 = out?.data?.[0]?.b64_json || out?.data?.[0]?.base64 || null;
  if (b64) return `data:image/png;base64,${b64}`;
  const url = out?.data?.[0]?.url;
  if (url) return url;

  throw new Error("OpenAI: empty image response");
}

// Replicate FLUX (любой из наших трёх размеров)
async function generateFluxImage(promptText, width, height) {
  if (!replicate) throw new Error("REPLICATE_API_TOKEN is missing");

  const output = await replicate.run("black-forest-labs/flux-schnell", {
    input: {
      prompt: promptText,
      width,
      height,
      guidance: 3,
      num_outputs: 1
    }
  });

  // replicate обычно возвращает массив URL'ов
  const url = Array.isArray(output) ? output[0] : output;
  if (!url) throw new Error("Replicate: empty image URL");
  return url;
}

/* ---------- API ---------- */

app.post("/generate", async (req, res) => {
  try {
    const { prompt, styleLabel, aspect: aspectFromClient } = req.body || {};

    const aspect = normalizeAspect(aspectFromClient);
    const text = buildPrompt(prompt, styleLabel);

    let image;

    if (aspect === "square") {
      // квадрат — OpenAI
      image = await generateOpenAISquareImage(text);
    } else {
      // портрет/альбом — FLUX (с безопасными размерами)
      const { width, height } = safeFluxDims(aspect);
      image = await generateFluxImage(text, width, height);
    }

    res.json({ image });
  } catch (err) {
    console.error("Generation error:", err);
    res.status(500).json({ error: `400 ${err.message || err}` });
  }
});

/* ---------- RUN ---------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server on :${PORT}`));
