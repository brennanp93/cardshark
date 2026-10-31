// The Claude coach, shared by the Express server (local) and the Netlify function (hosted).
import Anthropic from "@anthropic-ai/sdk";
import { parseCard, cardLabel, analyze } from "../public/poker.js";

// The coach is optional: without a key the app still does hands, odds and outs.
export const coachEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

let client = null;

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

/** Returns { status, body } so each host can send it its own way. */
export async function coachAdvice(requestBody) {
  if (!coachEnabled()) {
    return { status: 503, body: { error: "The coach isn't set up. Add ANTHROPIC_API_KEY." } };
  }
  const hand = parseHand(requestBody);
  if (!hand) return { status: 400, body: { error: "Invalid hand." } };

  client ??= new Anthropic({ maxRetries: 1 });
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
      return { status: 502, body: { error: "The coach couldn't answer this one." } };
    }
    const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
    return { status: 200, body: { advice: text } };
  } catch (error) {
    console.error("Coach request failed:", error);
    if (error instanceof Anthropic.RateLimitError) {
      return { status: 429, body: { error: "The coach is busy. Try again in a moment." } };
    }
    if (error instanceof Anthropic.AuthenticationError) {
      return { status: 500, body: { error: "The coach's API key was rejected." } };
    }
    if (error instanceof Anthropic.APIConnectionError) {
      return { status: 502, body: { error: "Couldn't reach the coach. Try again." } };
    }
    return { status: 500, body: { error: "The coach hit an error." } };
  }
}
