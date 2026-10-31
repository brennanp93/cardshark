import express from "express";
import os from "node:os";
import Anthropic from "@anthropic-ai/sdk";
import { parseCard, cardLabel, analyze } from "./public/poker.js";

const port = Number(process.env.PORT) || 3000;
const app = express();
app.use(express.json());
app.use(express.static("public"));

// The coach is optional: without a key the app still does hands, odds and outs.
const coachEnabled = Boolean(process.env.ANTHROPIC_API_KEY);
const client = coachEnabled ? new Anthropic() : null;

const COACH_PROMPT = `You are a friendly poker coach helping a beginner learn Texas Hold'em while they play a casual home game with friends.

You'll get the player's cards, the board, the number of players, and numbers already computed by a poker engine (best hand, win probability, outs, a suggested action). Trust those numbers; don't recalculate them.

Explain the spot in plain language in 3-5 short sentences:
- What their hand is right now and how strong it is at this table.
- What could happen on the next cards (draws, or what would beat them), if anything is still to come.
- Whether the suggested action makes sense and why, in terms a beginner can reuse later.

Teach one concept by name when it fits (kicker, draw, outs, pot odds, position, overcards, etc.). No headings or bullet lists. Keep it under 120 words.`;

function parseHand(body) {
  const hole = (body?.hole ?? []).map(parseCard);
  const board = (body?.board ?? []).map(parseCard);
  const players = Number(body?.players);
  const all = [...hole, ...board];
  if (hole.length !== 2 || ![0, 3, 4, 5].includes(board.length)) return null;
  if (all.some((c) => c < 0) || new Set(all).size !== all.length) return null;
  if (!Number.isInteger(players) || players < 2 || players > 10) return null;
  return { hole, board, players };
}

function describeSpot({ hole, board, players }, a) {
  const pct = (x) => `${Math.round(x * 100)}%`;
  const lines = [
    `Street: ${a.street}`,
    `Players at the table: ${players}`,
    `Hole cards: ${hole.map(cardLabel).join(" ")}`,
    `Board: ${board.length ? board.map(cardLabel).join(" ") : "(none yet)"}`,
    `Win probability vs random hands: ${pct(a.equity)} (ties ${pct(a.tie)})`,
  ];
  if (a.preflop) lines.push(`Starting hand: ${a.preflop.shorthand}, ${a.preflop.tier} (Chen score ${a.preflop.score})`);
  if (a.made) lines.push(`Best hand now: ${a.made.name} using ${a.made.cards.map(cardLabel).join(" ")}`);
  if (a.outs?.length) {
    const groups = Object.entries(a.outsByCategory).map(([cat, cs]) => `${cat}: ${cs.length}`);
    lines.push(`Outs: ${a.outs.length} (${groups.join(", ")}); chance to improve by the river: ${pct(a.improveChance)}`);
  }
  lines.push(`Suggested action: ${a.suggestion.action}. ${a.suggestion.reason}`);
  return lines.join("\n");
}

app.get("/api/status", (_req, res) => {
  res.json({ coach: coachEnabled });
});

app.post("/api/coach", async (req, res) => {
  if (!coachEnabled) return res.status(503).json({ error: "The coach isn't set up. Add ANTHROPIC_API_KEY to .env." });
  const hand = parseHand(req.body);
  if (!hand) return res.status(400).json({ error: "Invalid hand." });

  const spot = describeSpot(hand, analyze(hand.hole, hand.board, hand.players));
  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: COACH_PROMPT,
      messages: [{ role: "user", content: spot }],
    });
    if (response.stop_reason === "refusal") {
      return res.status(502).json({ error: "The coach couldn't answer this one." });
    }
    const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
    res.json({ advice: text });
  } catch (error) {
    console.error("Coach request failed:", error);
    if (error instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: "The coach is busy. Try again in a moment." });
    }
    if (error instanceof Anthropic.AuthenticationError) {
      return res.status(500).json({ error: "The coach's API key was rejected." });
    }
    if (error instanceof Anthropic.APIConnectionError) {
      return res.status(502).json({ error: "Couldn't reach the coach. Check the server's connection." });
    }
    res.status(500).json({ error: "The coach hit an error." });
  }
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Card Shark running at http://localhost:${port}`);
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family === "IPv4" && !a.internal) console.log(`  On your phone (same Wi-Fi): http://${a.address}:${port}`);
    }
  }
  console.log(coachEnabled ? "Coach: on (Claude)" : "Coach: off (set ANTHROPIC_API_KEY in .env to enable)");
});

