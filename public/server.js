import express from "express";
import bodyParser from "body-parser";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(bodyParser.json());
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Endpoint генерации
app.post("/generate", async (req, res) => {
  const { prompt, style, size } = req.body;

  try {
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt: `${prompt}. Style: ${style}`,
        size: size,
      }),
    });

    const data = await response.json();

    if (data.error) {
      res.json({ error: data.error.message });
    } else {
      res.json({ url: data.data[0].url });
    }
  } catch (err) {
    res.json({ error: err.message });
  }
});

// Health-check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
