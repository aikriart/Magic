// server.js — минимальная проверка
import express from "express";

const app = express();

app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/", (_req, res) => res.send("OK"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server started on port " + PORT));
