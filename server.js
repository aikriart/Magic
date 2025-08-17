// server.js — Express + OpenAI + минимальный UI
import express from "express";
import OpenAI from "openai";

const app = express();
app.use(express.json());

// --- Health & Debug ---
app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/debug", (_req, res) => {
  res.json({
    ok: true,
    node: process.version,
    hasOpenAIKey: !!process.env.OPENAI_API_KEY
  });
});

// --- UI на корне ---
app.get("/", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(
    "<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>" +
    "<title>Генерация изображения (OpenAI)</title>" +
    "<style>body{font-family:Arial;padding:24px}h1{font-size:36px;margin:0 0 12px}#p{width:90%;max-width:560px}img{max-width:560px;display:block;margin-top:16px}</style>" +
    "</head><body>" +
    "<h1>Генерация изображения (OpenAI)</h1>" +
    "<input id='p' type='text' value='Portrait of a woman, cinematic light'>" +
    "<button id='b'>Сгенерировать</button>" +
    "<pre id='log' style='background:#f6f8fa;padding:12px;border-radius:8px;white-space:pre-wrap;min-height:40px;margin-top:12px'></pre>" +
    "<div id='out'></div>" +
    "<script>" +
    "async function run(){var prompt=document.getElementById('p').value;" +
    "document.getElementById('log').textContent='Отправляю запрос...';" +
    "try{var r=await fetch('/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:prompt})});" +
    "var t=await r.text();var j;try{j=JSON.parse(t);}catch(_){j={raw:t};}" +
    "document.getElementById('log').textContent='HTTP '+r.status+'\\n'+JSON.stringify(j,null,2);" +
    "var imgs=(j&&j.output)?j.output:((j&&j.image)?[j.image]:[]);" +
    "document.getElementById('out').innerHTML=imgs.map(function(u){return '<img src=\"'+u+'\" alt=\"img\">';}).join('');}" +
    "catch(e){document.getElementById('log').textContent='Ошибка JS: '+(e&&e.message?e.message:e);}}" +
    "document.getElementById('b').addEventListener('click',run);" +
    "</script></body></html>"
  );
});

// --- Генерация через OpenAI ---
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post("/generate", async (req, res) => {
  try {
    const prompt = (req.body && req.body.prompt) ? String(req.body.prompt) : "";
    if (!prompt.trim()) return res.status(400).json({ error: "Пустой prompt" });

    const r = await openai.images.generate({
      model: "gpt-image-1",
      prompt: prompt,
      size: "1024x1024"
    });

    const out = (r.data || [])
      .map(d => (d && d.url) ? d.url : (d && d.b64_json ? "data:image/png;base64," + d.b64_json : null))
      .filter(Boolean);

    if (!out.length) return res.status(502).json({ error: "OpenAI вернул пустой ответ" });

    return res.json({ image: out[0], output: out });
  } catch (e) {
    console.error("[/generate] error:", e);
    return res.status(500).json({ error: e && e.message ? e.message : String(e) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server started on port " + PORT));
