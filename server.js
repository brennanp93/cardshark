import express from "express";
import os from "node:os";
import { coachEnabled, coachAdvice } from "./lib/coach.js";

const port = Number(process.env.PORT) || 3000;
const app = express();
app.use(express.json());
app.use(express.static("public"));

app.get("/api/status", (_req, res) => {
  res.json({ coach: coachEnabled() });
});

app.post("/api/coach", async (req, res) => {
  const { status, body } = await coachAdvice(req.body);
  res.status(status).json(body);
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Card Shark running at http://localhost:${port}`);
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family === "IPv4" && !a.internal) console.log(`  On your phone (same Wi-Fi): http://${a.address}:${port}`);
    }
  }
  console.log(coachEnabled() ? "Coach: on (Claude)" : "Coach: off (set ANTHROPIC_API_KEY in .env to enable)");
});
