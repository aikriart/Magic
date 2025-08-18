// server.js — Express + OpenAI + UI со стилями и превью
import express from "express";
import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// 1) Раздаём статику из /public (туда кладём /styles/…)
app.use(express.static(path.join(__dirname, "public")));

// 2) Health & Debug
app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/debug", (_req, res) => {
  res.json({
    ok: true,
    node: process.version,
    hasOpenAIKey: !!process.env.OPENAI_API_KEY
  });
});

// 3) UI c 19 стилями (имя, модификатор, путь к превью)
app.get("/", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");

  // ВАЖНО: положи свои картинки в public/styles/ и подгони имена файлов ниже
  const styles = [
    ["90s Film",        "shot on 35mm film, 1990s color palette, subtle grain, soft halation",        "/styles/90s-film.jpg"],
    ["Silver Glow",     "silver-toned palette, metallic sheen, high specular highlights",              "/styles/silver-glow.jpg"],
    ["Cinematic Noir",  "film noir, strong contrast, dramatic lighting, deep shadows",                 "/styles/cinematic-noir.jpg"],
    ["Golden Hour",     "sunset light, warm tones, soft rim light, natural glow",                      "/styles/golden-hour.jpg"],
    ["Neon Dreams",     "neon lights, cyberpunk vibes, vibrant magenta and cyan, city at night",       "/styles/neon-dreams.jpg"],
    ["Vintage Dust",    "retro look, faded colors, light dust and scratches, matte finish",            "/styles/vintage-dust.jpg"],
    ["Crystal Shine",   "crystal clarity, glossy highlights, ultra-detailed skin texture",             "/styles/crystal-shine.jpg"],
    ["Retro Wave",      "80s retro wave, bold gradients, neon grid, synth aesthetic",                  "/styles/retro-wave.jpg"],
    ["Soft Bloom",      "soft focus, gentle bloom, creamy bokeh, pastel tones",                        "/styles/soft-bloom.jpg"],
    ["Dark Velvet",     "low key, velvet blacks, moody light, rich deep tones",                        "/styles/dark-velvet.jpg"],
    ["Ocean Deep",      "cool blue palette, subtle aqua, marine ambience, reflective light",           "/styles/ocean-deep.jpg"],
    ["Urban Grit",      "gritty street look, desaturated tones, cinematic realism",                    "/styles/urban-grit.jpg"],
    ["Ethereal Mist",   "dreamy haze, soft fog, ethereal backlight, delicate highlights",              "/styles/ethereal-mist.jpg"],
    ["Pastel Pop",      "pastel palette, playful colors, soft contrast, light airy mood",              "/styles/pastel-pop.jpg"],
    ["Mystic Fantasy",  "fantasy lighting, magical sparkles, painterly feel",                          "/styles/mystic-fantasy.jpg"],
    ["Shadow Play",     "graphic chiaroscuro, hard edge shadows, architectural light",                 "/styles/shadow-play.jpg"],
    ["Dream Lens",      "tilt-shift feel, dreamy blur, gentle vignette, delicate sharpness",           "/styles/dream-lens.jpg"],
    ["Ivory Light",     "ivory whites, soft warm highlights, clean minimal tones",                     "/styles/ivory-light.jpg"],
    ["Galaxy Fade",     "cosmic ambience, subtle star glow, deep space hues, midnight tones",          "/styles/galaxy-fade.jpg"]
  ];

  // Сборка HTML (без сложных шаблонов — чтобы не поехали кавычки)
  let chips = "";
  for (const s of styles) {
    const name = s[0];
    const mod  = s[1].replace(/"/g, "&quot;");
    const img  = s[2];
    chips += "<button class='chip' data-mod=\""+mod+"\" data-img=\""+img+"\">"+name+"</button>";
  }

  res.send(
    "<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>"+
    "<title>Image Generation (OpenAI)</title>"+
    "<style>"+
    "body{font-family:Inter,system-ui,Arial;padding:24px;max-width:960px;margin:0 auto;background:#0b0b10;color:#eaeaf0}"+
    "h1{font-size:36px;margin:0 0 16px} .sub{opacity:.8;margin-bottom:16px} .row{display:flex;gap:12px;flex-wrap:wrap;align-items:center}"+
    "input{flex:1;min-width:220px;padding:12px 14px;border-radius:10px;border:1px solid #262737;background:#12131a;color:#eaeaf0}"+
    "button.primary{padding:12px 16px;border-radius:10px;border:1px solid #3a3cff;background:#3a3cff;color:#fff}"+
    "button.primary:active{transform:translateY(1px)}"+
    ".chips{display:flex;flex-wrap:wrap;gap:10px;margin:18px 0}"+
    ".chip{border:1px solid #262737;background:#151623;color:#cfd2ff;border-radius:999px;padding:8px 12px;cursor:pointer;font-size:14px}"+
    ".chip:hover{background:#1a1b28}"+
    "pre{background:#0f1020;border:1px solid #262737;border-radius:12px;padding:12px;white-space:pre-wrap}"+
    "img.preview{max-width:100%;height:auto;display:block;margin-top:16px;border-radius:12px;border:1px solid #262737}"+
    ".hint{opacity:.7;font-size:12px;margin-top:6px}"+
    "</style></head><body>"+
    "<h1>Image Generation (OpenAI)</h1>"+
    "<div class='sub'>Type a prompt, then click a style — its preview appears below. Press Generate to get the final image.</div>"+
    "<div class='row'><input id='p' type='text' value='Portrait of a woman, cinematic light'><button id='b' class='primary'>Generate</button></div>"+
    "<div class='hint'>Styles append text to your prompt (no duplicates). Preview shows your style mockup photo.</div>"+
    "<div class='chips'>"+chips+"</div>"+
    "<pre id='log'></pre>"+
    "<div id='out'><img id='ph' class='preview' src='/styles/placeholder.jpg' alt='preview' onerror=\"this.src='https://via.placeholder.com/512x512.png?text=Preview'\"/></div>"+
    "<script>"+
    "const input=document.getElementById('p'); const logEl=document.getElementById('log'); const out=document.getElementById('out');"+
    "function addModifier(mod){ var base=input.value||''; var norm=(base+' ').replace(/\\s+/g,' ').trim(); if(!norm.toLowerCase().includes(mod.toLowerCase())){ if(norm && !norm.endsWith(',')) norm+=', '; norm+=mod; } input.value=norm; }"+
    "document.querySelectorAll('.chip').forEach(function(btn){ btn.addEventListener('click', function(){ addModifier(this.dataset.mod); var img=this.dataset.img; var ph=document.getElementById('ph'); if(!ph){ ph=document.createElement('img'); ph.id='ph'; ph.className='preview'; out.innerHTML=''; out.appendChild(ph);} ph.src=img; ph.onerror=function(){ ph.src='https://via.placeholder.com/512x512.png?text=Preview'; }; }); });"+
    "async function run(){ var prompt=input.value; logEl.textContent='Requesting...'; try{ var r=await fetch('/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:prompt})}); var t=await r.text(); var j; try{ j=JSON.parse(t);}catch(_){ j={raw:t}; } logEl.textContent='HTTP '+r.status+'\\n'+JSON.stringify(j,null,2); var imgs=(j&&j.output)?j.output:((j&&j.image)?[j.image]:[]); if(imgs.length){ out.innerHTML=imgs.map(function(u){return '<img class=\"preview\" src=\"'+u+'\" alt=\"image\">';}).join(''); } } catch(e){ logEl.textContent='JS error: '+(e&&e.message?e.message:e); } }"+
    "document.getElementById('b').addEventListener('click', run);"+
    "</script></body></html>"
  );
});

// 4) Генерация через OpenAI
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
