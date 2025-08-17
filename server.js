import express from "express";
import OpenAI from "openai";

const app = express();
app.use(express.json());

// 1) Health + Debug
app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/debug", (_req, res) => {
  res.json({
    ok: true,
    node: process.version,
    hasOpenAIKey: !!process.env.OPENAI_API_KEY,
  });
});

// 2) Форма для теста (корень)
app.get("/", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(
    "<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>" +
    "<title>Генерация изображения (OpenAI)</title>" +
    "<style>body{font-family:Arial; padding:24px} h1{font-size:40px} input{width:90%; max-width:520px} img{max-width:512px; display:block; margin-top:16px}</style>" +
    "</head><body>" +
    "<h1>Генерация изображения (OpenAI)</h1>" +
    "<input id='p' type='text' value='Portrait of a woman, cinematic light'>" +
    "<button id='b'>Сгенерировать</button>" +
    "<pre id='log' style='background:#f6f8fa;padding:12px;border-radius:8px;white-space:pre-wrap;min-height:40px'></pre>" +
    "<div id='out'></div>" +
    "<script>" +
    "async function call(){ const prompt=document.getElementById('p').value; " +
    "document.getElementById('log').textContent='Отправляю запрос...'; " +
    "try{ const r=await fetch('/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt})}); " +
    "const t=await r.text(); let j; try{ j=JSON.parse(t);}catch{ j={raw:t}; } " +
    "document.getElementById('log').textContent='HTTP '+r.status+'\\n'+JSON.stringify(j,null,2); " +
    "const imgs=(j && j.output)?j.output:((j && j.image)?[j.image]:[]); " +
    "document.getElementById('out').innerHTML=imgs.map(u=>'<img src=\"'+u+'\" alt=\"img\">').join(''); } " +
    "catch(e){ document.getElementById('log').textContent='Ошибка JS: '+(e && e.message ? e.message : e); } } " +
    "document.getElementById('b').addEventListener('click', call);" +
    "</script>" +
    "</body></html>"
  );
});

// 3) Обработчик генерации
const openai = new OpenAI({ apiKey: process.env.O
