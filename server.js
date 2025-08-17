import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import OpenAI from "openai";

const app = express();
app.use(cors());
app.use(bodyParser.json());

// health-check
app.get("/health", (req, res) => res.json({ ok: true }));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// единый обработчик генерации (возвращаем и image, и output[])
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
    });
    const images = (resp.data || [])
      .map(d => d.url || (d.b64_json ? `data:image/png;base64,${d.b64_json}` : null))
      .filter(Boolean);
    if (!images.length) return res.status(502).json({ error: "OpenAI вернул пустой ответ" });
    return res.json({ image: images[0], output: images });
  } catch (e) {
    console.error("[/generate error]", e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
};

app.post("/api/generate", generateHandler);
app.post("/generate", generateHandler);

// простая страница для теста (GET /)
app.get("/", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(`<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Тест генерации</title>
<style>body{font-family:system-ui,Arial,sans-serif;padding:24px} img{max-width:512px;display:block;margin-top:16px}</style>
</head><body>
<h1>Проверка генерации изображения</h1>
<form id="f"><input id="p" type="text" size="50" placeholder="Например: a cute cat in a hat">
<button>Сгенерировать</button></form>
<pre id="log" style="background:#f6f8fa;padding:12px;border-radius:8px;white-space:pre-wrap"></pre>
<div id="out"></div>
<script>
document.getElementById("f").addEventListener("submit", async (e)=>{
  e.preventDefault();
  const prompt = document.getElementById("p").value.trim();
  const r = await fetch("/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt})});
  const t = await r.text(); let j; try{ j=JSON.parse(t);}catch{ j={raw:t}; }
  document.getElementById("log").textContent = "HTTP "+r.status+"\\n"+JSON.stringify(j,null,2);
  const imgs = j.output || (j.image ? [j.image] : []);
  document.getElementById("out").innerHTML = imgs.map(u=>'<img src="'+u+'" alt="result">').join("");
});
</script>
</body></html>`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log
