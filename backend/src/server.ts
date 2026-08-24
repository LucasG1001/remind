import dotenv from "dotenv";
dotenv.config();

import path from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import { migrate } from "./database/migrate.js";
import { reminderRoutes } from "./routes/reminderRoutes.js";
import { habitRoutes } from "./routes/habitRoutes.js";
import { projectRoutes } from "./routes/projectRoutes.js";
import { flashcardRoutes } from "./routes/flashcardRoutes.js";
import { flashcardCategoryRoutes } from "./routes/flashcardCategoryRoutes.js";
import { pushRoutes } from "./routes/pushRoutes.js";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler.js";
import { startScheduler } from "./services/reminderScheduler.js";

const app = express();
const PORT = process.env.PORT || 3333;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/reminders", reminderRoutes);
app.use("/api/habits", habitRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/flashcards", flashcardRoutes);
app.use("/api/flashcard-categories", flashcardCategoryRoutes);
app.use("/api/push", pushRoutes);

const clientDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public");
if (existsSync(clientDir)) {
  app.use(express.static(clientDir));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api/")) {
      return next();
    }
    res.sendFile(path.join(clientDir, "index.html"));
  });
}

app.use(notFoundHandler);
app.use(errorHandler);

async function start(): Promise<void> {
  await migrate();
  app.listen(PORT, () => {
    process.stdout.write(`RemindMe backend rodando em http://localhost:${PORT}\n`);
  });
  startScheduler();
}

start().catch((error) => {
  console.error("Falha ao iniciar o backend:", error);
  process.exit(1);
});
