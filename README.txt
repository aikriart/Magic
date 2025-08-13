# Магический генератор образа — версия для Render (вертикальный 1024x1792)

## Быстрый деплой на Render
1. Подготовь репозиторий на GitHub (через веб-интерфейс):
   - Создай **New Repository** (публичный).
   - Залей туда все файлы из этого архива (через Upload files → Drag & Drop).
2. Зайди на https://render.com → **New +** → **Web Service**.
3. Подключи свой GitHub и выбери этот репозиторий.
4. Настройки:
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Region**: любая
5. **Environment Variables**:
   - `OPENAI_API_KEY` = твой ключ `sk-...`
6. Нажми **Create Web Service**. После билда Render выдаст URL вида `https://<appname>.onrender.com`.
7. Открой URL и пользуйся (формат 1024x1792).

### Примечания
- BASE_URL не нужен — сервер сам определяет хост по запросу.
- Сгенерированные картинки лежат по `https://<url>/public/out/<id>.png`.
- Если нужны вертикальные вариации 9:16 — уже стоит размер 1024x1792.
