app.post('/generate', async (req, res) => {
  try {
    const prompt = (req.body && req.body.prompt) ? String(req.body.prompt) : '';
    const size   = (req.body && req.body.size) ? String(req.body.size) : '1024x1024';
    if (!prompt.trim()) {
      return res.status(400).json({ error: 'Empty prompt' });
    }

    const response = await openai.images.generate({
      model: 'gpt-image-1',
      prompt: prompt,
      size: size  // Используем выбранный размер (1:1, 9:16 или 16:9)
    });

    // … остальная часть функции без изменений …

  } catch (err) {
    // обработка ошибок
  }
});
