# Card Shark

A phone-friendly Texas Hold'em helper for learning poker during home games. Enter your two cards and the board as they come; at every street Card Shark shows:

- **Your hand**: the best five cards, highlighted (e.g. "Two Pair, Kings and Sevens")
- **Win / tie odds** against the number of players at the table (simulated, 20,000 deals)
- **Outs**: which cards improve you, and your chance to hit by the river, with the rule of 2 and 4
- **Starting-hand strength** before the flop (Premium / Strong / Playable / Marginal / Weak)
- **A suggested action** (raise, bet/call, check/call small, fold) with the reason in plain English
- **Ask the coach** (optional): Claude explains the spot and teaches a concept

The poker math runs in the browser, so everything except the coach works without an API key.

## Run it

```bash
npm install
cp .env.example .env    # optional: add ANTHROPIC_API_KEY to turn on the coach
npm start
```

The server prints two URLs: one for this computer and one to open on a phone connected to the same Wi-Fi.

## Deploy (Netlify)

`netlify.toml` publishes `public/` as a static site and runs the coach API as Netlify Functions (`netlify/functions/`), so `server.js` is only for local use.

1. Import the GitHub repo in Netlify. Leave build command and publish directory blank; `netlify.toml` sets them.
2. Optional, for the coach: **Site configuration → Environment variables** → add `ANTHROPIC_API_KEY`, then redeploy.

## Develop

```bash
npm run dev   # restarts on file changes
npm test      # hand evaluator, odds, and outs tests
```

## Layout

| Path | What it is |
| --- | --- |
| `public/poker.js` | Hand evaluator, equity simulation, outs, preflop strength, suggestions. Shared by the browser and server. |
| `public/app.js` | UI: card picker, analysis panel, saves the current hand in localStorage |
| `public/index.html`, `public/style.css` | Mobile-first page |
| `server.js` | Local Express server: serves `public/`, plus `GET /api/status` and `POST /api/coach` |
| `lib/coach.js` | Claude coach logic, shared by `server.js` and the Netlify functions |
| `netlify/functions/` | `/api/status` and `/api/coach` on Netlify |
| `test/` | `node --test` tests for `poker.js` |

The suggestions are a learning aid based on win odds alone. They don't account for bet sizes, position, or reads on other players.
