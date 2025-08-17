import express from "express";
import bodyParser from "body-parser";
import fetch from "node-fetch";

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

// Health check
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// Debug check
app.get("/debug", (req, res) => {
  res.json({
    ok: true,
    node: process.version,
    hasOpenAIKey: !!OPENAI_KEY,
  });
});

// Генерация изображения
app.post("/generate", async (req, res) => {
  try {
    const prompt = req.body.prompt || "Portrait of a woman";
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt: prompt,
        size: "512x512"
      }),
    });

    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
