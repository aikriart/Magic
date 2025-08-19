import express from "express";
import bodyParser from "body-parser";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static("public"));

app.post("/generate", async (req, res) => {
  const { prompt, style, size } = req.body;

  try {
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt: `${prompt}, style: ${style}`,
        size: size || "1024x1024"
      }),
    });

    const data = await response.json();
    res.json({ url: data.data[0].url });
  } catch (error) {
    console.error("Ошибка генерации:", error);
    res.status(500).json({ error: "Не удалось сгенерировать изображение" });
  }
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
