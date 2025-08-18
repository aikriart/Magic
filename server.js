// server.js — Express + OpenAI + UI со стилями
import express from "express";
import OpenAI from "openai";

const app = express();
app.use(express.json());

// -------- Health & Debug --------
app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/debug", (_req, res) => {
  res.json({
    ok: true,
    node: process.version,
    hasOpenAIKey: !!process.env.OPENAI_API_KEY
  });
});

// -------- UI --------
app.get("/", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");

  // имена стилей + их модификаторы к промпту
  const styles = [
    ["90s Film",        "shot on 35mm film, 1990s color palette, subtle grain, soft halation"],
    ["Silver Glow",     "silver-toned palette, metallic sheen, high specular highlights"],
    ["Cinematic Noir",  "film noir, strong contrast, dramatic lighting, deep shadows"],
    ["Golden Hour",     "sunset light, warm tones, soft rim light, natural glow"],
    ["Neon Dreams",     "neon lights, cyberpunk vibes, vibrant magenta and cyan, city at night"],
    ["Vintage Dust",    "retro look, faded colors, light dust and scratches, matte finish"],
    ["Crystal Shine",   "crystal clarity, glossy highlights, ultra-detailed skin texture"],
    ["Retro Wave",      "80s retro wave, bold gradients, neon grid, synth aesthetic"],
    ["Soft Bloom",      "soft focus, gentle bloom, creamy bokeh, pastel tones"],
    ["Dark Velvet",     "low key, velvet blacks, moody light, rich deep tones"],
    ["Ocean Deep",      "cool blue palette, subtle aqua, marine ambience, reflective light"],
    ["Urban Grit",      "gritty street look, desaturated tones, cinematic realism"],
    ["Ethereal Mist",   "dreamy haze, soft fog, ethereal backlight, delicate highlights"],
    ["Pastel Pop",      "pastel palette, playful colors, soft contrast, light airy mood"],
    ["Mystic Fantasy",  "fantasy lighting, magical sparkles, painterly feel"],
    ["Shadow Play",     "graphic chiaroscuro, hard edge shadows, architectural light"],
    ["Dream Lens",      "tilt-shift feel, dreamy blur, gentle vignette, delicate sharpness"],
    ["Ivory Light",     "ivory whites, soft warm highlights, clean minimal tones"],
    ["Galaxy Fade",     "cosmic ambience, subtle star glow, deep space hues, midnight tones"]
  ];

  // собираем простую страницу (без шаблонных строк)
  let buttonsHtml = "";
  for (const s of styles) {
    buttonsHtml += "<button class='chip' data-style=\""+s[0]+"\" data-mod=\""+s[1].replace(/"/g,"&quot;")+"\">"+s[0]+"</button>";
  }

  res.send(
    "<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>" +
    "<title>Image Generation (OpenAI)</title>" +
    "<style>" +
    "body{font-family:Inter,system-ui,Arial;padding:24px;max-width:960px;margin:0 auto;background:#0b0b10;color:#eaeaf0}" +
    "h1{font-size:36px;margin:0 0 16px}" +
    ".sub{opacity:.8;margin-bottom:16px}" +
    ".row{display:flex;gap:12px;flex-wrap:wrap;align-items:center}" +
    "input{flex:1;min-width:220px;padding:12px 14px;border-radius:10px;border:1px solid #262737;background:#12131a;color:#eaeaf0}" +
    "button.primary{padding:12px 16px;border-radius:10px;border:1px solid #3a3cff;background:#3a3cff;color:#fff}" +
    "button.primary:active{transform:translateY(1px)}" +
    ".chips{display:flex;flex-wrap:wrap;gap:10px;margin:18px 0}" +
    ".chip{border:1px solid #262737;background:#151623;color:#cfd2ff;border-radius:999px;padding:8px 12px;cursor:pointer;font-size:14px}" +
    ".chip:hover{background:#1a1b28}" +
    "pre{background:#0f1020;border:1px solid #262737;border-radius:12px;padding:12px;white-space:pre-wrap}" +
    "img{max-width:100%;height:auto;display:block;margin-top:16px;border-radius:12px;border:1px solid #262737}" +
    ".hint{opacity:.7;font-size:12px;margin-top:6px}" +
    "</style></head><body>" +
    "<h1>Image Generation (OpenAI)</h1>" +
    "<div class='sub'>Type a prompt, then click a style to boost the look. You can mix several styles.</div>" +
    "<div class='row'><input id='p' type='text' value='Portrait of a woman, cinematic light'><button id='b' class='primary'>Generate</button></div>" +
    "<div class='hint'>Tip: styles append text to your prompt (no duplicates).</div>" +
    "<div class='chips'>"+buttonsHtml+"</div>" +
    "<pre id='log'></pre>" +
    "<div id='out'></div>" +
    "<script>" +
    "const input=document.getElementById('p');" +
    "const logEl=document.getElementById('log');" +
    "const out=document.getElementById('out');" +
    "function addStyle(mod){ var base=input.value; if(!base) base=''; var norm=(base+' ').replace(/\\s+/g,' ').trim(); if(!norm.toLowerCase().includes(mod.toLowerCase())){ if(norm && !norm.endsWith(',')) norm += ', '; norm += mod; } input.value=norm; }" +
    "document.querySelectorAll('.chip').forEach(function(btn){ btn.addEventListener('click',function(){ addStyle(this.dataset.mod); }); });" +
    "async function run(){ var prompt=input.value; logEl.textContent='Requesting...'; out.innerHTML=''; try{ var r=await fetch('/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:prompt})}); var t=await r.text(); var j; try{ j=JSON.parse(t);}catch(_){ j={raw:t}; } logEl.textContent='HTTP '+r.status+'\\n'+JSON.stringify(j,null,2); var imgs=(j&&j.output)?j.output:((j&&j.image)?[j.image]:[]); out.innerHTML=imgs.map(function(u){return '<img src=\"'+u+'\" alt=\"image\">';}).join(''); } catch(e){ logEl.textContent='JS error: '+(e&&e.message?e.message:e);} }" +
    "document.getElementById('b').addEventListener('click',run);" +
    "</script></body></html>"
  );
});

// -------- Генерация через OpenAI --------
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post("/generate", async (req, res) => {
  try {
    const prompt = (req.body && req.body.prompt) ? String(req.body.prompt) : "";
    if (!prompt.trim()) return res.status(400).json({ error: "Empty prompt" });

    const r = await openai.images.generate({
      model: "gpt-image-1",
      prompt: prompt,
      size: "1024x1024"
    });

    const out = (r.data || [])
      .map(d => (d && d.url) ? d.url : (d && d.b64_json ? "data:image/png;base64," + d.b64_json : null))
      .filter(Boolean);

    if (!out.length) return res.status(502).json({ error: "OpenAI returned empty result" });

    return res.json({ image: out[0], output: out });
  } catch (e) {
    console.error("[/generate] error:", e);
    return res.status(500).json({ error: e && e.message ? e.message : String(e) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server started on port " + PORT));
