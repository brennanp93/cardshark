// Poker math shared by the browser and the server.
// A card is an int 0..51: rank = card >> 2 (0 = deuce .. 12 = ace), suit = card & 3.

export const RANKS = "23456789TJQKA";
export const SUITS = "shdc";
export const SUIT_SYMBOLS = { s: "♠", h: "♥", d: "♦", c: "♣" };
const RANK_NAMES = ["Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Jack", "Queen", "King", "Ace"];
const RANK_PLURALS = ["Twos", "Threes", "Fours", "Fives", "Sixes", "Sevens", "Eights", "Nines", "Tens", "Jacks", "Queens", "Kings", "Aces"];

export const CATEGORIES = [
  "High Card",
  "Pair",
  "Two Pair",
  "Three of a Kind",
  "Straight",
  "Flush",
  "Full House",
  "Four of a Kind",
  "Straight Flush",
];

export const rankOf = (card) => card >> 2;
export const suitOf = (card) => card & 3;

/** "As" -> 48. Returns -1 for anything that isn't a card. */
export function parseCard(str) {
  if (typeof str !== "string" || str.length !== 2) return -1;
  const r = RANKS.indexOf(str[0].toUpperCase());
  const s = SUITS.indexOf(str[1].toLowerCase());
  return r < 0 || s < 0 ? -1 : r * 4 + s;
}

export const cardCode = (card) => RANKS[rankOf(card)] + SUITS[suitOf(card)];

/** 48 -> "A♠" (ten shows as "10" for readability). */
export function cardLabel(card) {
  const r = RANKS[rankOf(card)];
  return (r === "T" ? "10" : r) + SUIT_SYMBOLS[SUITS[suitOf(card)]];
}

// Highest card of a 5-long run in a 13-bit rank mask, or -1. Ace plays low in the wheel.
function straightHigh(mask) {
  for (let hi = 12; hi >= 4; hi--) {
    if (((mask >> (hi - 4)) & 0b11111) === 0b11111) return hi;
  }
  if ((mask & 0b1111) === 0b1111 && mask & (1 << 12)) return 3;
  return -1;
}

function topRanks(mask, n) {
  const out = [];
  for (let r = 12; r >= 0 && out.length < n; r--) if (mask & (1 << r)) out.push(r);
  return out;
}

const pack = (cat, ks) => ks.reduce((acc, k, i) => acc | (k << (16 - 4 * i)), cat << 20);

/**
 * Score the best 5-card hand out of 5-7 cards. Higher is better; equal scores tie.
 * The category is score >> 20.
 */
export function evaluate(cards) {
  const counts = new Array(13).fill(0);
  const suitMasks = [0, 0, 0, 0];
  const suitCounts = [0, 0, 0, 0];
  let rankMask = 0;
  for (const c of cards) {
    const r = c >> 2, s = c & 3;
    counts[r]++;
    suitMasks[s] |= 1 << r;
    suitCounts[s]++;
    rankMask |= 1 << r;
  }

  const flushSuit = suitCounts.findIndex((n) => n >= 5);
  if (flushSuit >= 0) {
    const sf = straightHigh(suitMasks[flushSuit]);
    if (sf >= 0) return pack(8, [sf]);
  }

  const quads = [], trips = [], pairs = [];
  for (let r = 12; r >= 0; r--) {
    if (counts[r] === 4) quads.push(r);
    else if (counts[r] === 3) trips.push(r);
    else if (counts[r] === 2) pairs.push(r);
  }

  if (quads.length) {
    return pack(7, [quads[0], topRanks(rankMask & ~(1 << quads[0]), 1)[0]]);
  }
  if (trips.length && (trips.length > 1 || pairs.length)) {
    const pairRank = Math.max(trips[1] ?? -1, pairs[0] ?? -1);
    return pack(6, [trips[0], pairRank]);
  }
  if (flushSuit >= 0) return pack(5, topRanks(suitMasks[flushSuit], 5));
  const st = straightHigh(rankMask);
  if (st >= 0) return pack(4, [st]);
  if (trips.length) {
    return pack(3, [trips[0], ...topRanks(rankMask & ~(1 << trips[0]), 2)]);
  }
  if (pairs.length >= 2) {
    const [p1, p2] = pairs;
    return pack(2, [p1, p2, topRanks(rankMask & ~(1 << p1) & ~(1 << p2), 1)[0]]);
  }
  if (pairs.length) {
    return pack(1, [pairs[0], ...topRanks(rankMask & ~(1 << pairs[0]), 3)]);
  }
  return pack(0, topRanks(rankMask, 5));
}

export const categoryOf = (score) => score >> 20;

/** Human name for a score, e.g. "Two Pair, Kings and Sevens". */
export function describeScore(score) {
  const cat = categoryOf(score);
  const k = (i) => (score >> (16 - 4 * i)) & 0xf;
  switch (cat) {
    case 8: return k(0) === 12 ? "Royal Flush" : `Straight Flush, ${RANK_NAMES[k(0)]} high`;
    case 7: return `Four of a Kind, ${RANK_PLURALS[k(0)]}`;
    case 6: return `Full House, ${RANK_PLURALS[k(0)]} full of ${RANK_PLURALS[k(1)]}`;
    case 5: return `Flush, ${RANK_NAMES[k(0)]} high`;
    case 4: return `Straight, ${RANK_NAMES[k(0)]} high`;
    case 3: return `Three of a Kind, ${RANK_PLURALS[k(0)]}`;
    case 2: return `Two Pair, ${RANK_PLURALS[k(0)]} and ${RANK_PLURALS[k(1)]}`;
    case 1: return `Pair of ${RANK_PLURALS[k(0)]}`;
    default: return `High Card, ${RANK_NAMES[k(0)]}`;
  }
}

function* combinations(arr, k, start = 0, chosen = []) {
  if (chosen.length === k) {
    yield chosen.slice();
    return;
  }
  for (let i = start; i <= arr.length - (k - chosen.length); i++) {
    chosen.push(arr[i]);
    yield* combinations(arr, k, i + 1, chosen);
    chosen.pop();
  }
}

/** The best five cards (for highlighting), plus their score and name. */
export function bestHand(cards) {
  let best = null;
  for (const five of combinations(cards, 5)) {
    const score = evaluate(five);
    if (!best || score > best.score) best = { score, cards: five };
  }
  return { ...best, name: describeScore(best.score), category: CATEGORIES[categoryOf(best.score)] };
}

function remainingDeck(known) {
  const used = new Set(known);
  const deck = [];
  for (let c = 0; c < 52; c++) if (!used.has(c)) deck.push(c);
  return deck;
}

/**
 * Monte Carlo estimate of hero's equity against (players - 1) random hands.
 * Returns { win, tie, equity } as fractions; equity counts split pots fractionally.
 */
export function simulateEquity(hole, board, players, iterations = 20000) {
  const deck = remainingDeck([...hole, ...board]);
  const opponents = players - 1;
  const boardNeeded = 5 - board.length;
  const draw = boardNeeded + opponents * 2;
  const fullBoard = board.slice();
  let wins = 0, ties = 0, equity = 0;

  for (let it = 0; it < iterations; it++) {
    // Partial Fisher-Yates: only shuffle the cards we need.
    for (let i = 0; i < draw; i++) {
      const j = i + Math.floor(Math.random() * (deck.length - i));
      const t = deck[i]; deck[i] = deck[j]; deck[j] = t;
    }
    for (let i = 0; i < boardNeeded; i++) fullBoard[board.length + i] = deck[i];

    const heroScore = evaluate([...hole, ...fullBoard]);
    let best = -1, tiedWithHero = 0, beaten = false;
    for (let o = 0; o < opponents; o++) {
      const a = deck[boardNeeded + o * 2], b = deck[boardNeeded + o * 2 + 1];
      const s = evaluate([a, b, ...fullBoard]);
      if (s > heroScore) { beaten = true; break; }
      if (s === heroScore) tiedWithHero++;
      if (s > best) best = s;
    }
    if (beaten) continue;
    if (tiedWithHero) {
      ties++;
      equity += 1 / (tiedWithHero + 1);
    } else {
      wins++;
      equity += 1;
    }
  }
  return { win: wins / iterations, tie: ties / iterations, equity: equity / iterations };
}

/**
 * Cards that move hero up a hand category using at least one hole card
 * (a card that just pairs the board helps everyone, so it isn't an out).
 * Only meaningful on the flop and turn.
 */
export function findOuts(hole, board) {
  if (board.length < 3 || board.length > 4) return { outs: [], byCategory: {}, improveChance: null };
  const current = categoryOf(evaluate([...hole, ...board]));
  const deck = remainingDeck([...hole, ...board]);
  const helps = (extra) => {
    const cat = categoryOf(evaluate([...hole, ...board, ...extra]));
    return cat > current && cat > boardOnlyCategory([...board, ...extra]) ? cat : -1;
  };

  const outs = [];
  const byCategory = {};
  for (const c of deck) {
    const cat = helps([c]);
    if (cat >= 0) {
      outs.push(c);
      (byCategory[CATEGORIES[cat]] ??= []).push(c);
    }
  }

  // Exact chance to improve by the river (two cards to come on the flop, one on the turn).
  let hits = 0, total = 0;
  if (board.length === 3) {
    for (const pair of combinations(deck, 2)) {
      total++;
      if (helps(pair) >= 0) hits++;
    }
  } else {
    total = deck.length;
    hits = outs.length;
  }
  return { outs, byCategory, improveChance: hits / total };
}

// Category made by the board alone (fewer than 5 cards can still hold pairs/trips/quads).
function boardOnlyCategory(board) {
  if (board.length >= 5) return categoryOf(evaluate(board));
  const counts = {};
  for (const c of board) counts[c >> 2] = (counts[c >> 2] ?? 0) + 1;
  const n = Object.values(counts).sort((a, b) => b - a);
  if (n[0] === 4) return 7;
  if (n[0] === 3) return 3;
  if (n[0] === 2 && n[1] === 2) return 2;
  if (n[0] === 2) return 1;
  return 0;
}

/** Chen formula score for a starting hand, with a beginner-friendly tier. */
export function preflopStrength(hole) {
  const [a, b] = hole;
  const hi = Math.max(rankOf(a), rankOf(b));
  const lo = Math.min(rankOf(a), rankOf(b));
  const suited = suitOf(a) === suitOf(b);
  const base = (r) => (r === 12 ? 10 : r === 11 ? 8 : r === 10 ? 7 : r === 9 ? 6 : (r + 2) / 2);

  let score;
  if (hi === lo) {
    score = Math.max(5, base(hi) * 2);
  } else {
    score = base(hi);
    if (suited) score += 2;
    const gap = hi - lo - 1;
    score -= [0, 1, 2, 4][gap] ?? 5;
    if (gap <= 1 && hi < 10) score += 1;
  }
  score = Math.ceil(score);

  const r = (x) => RANKS[x];
  const shorthand = hi === lo ? r(hi) + r(lo) : r(hi) + r(lo) + (suited ? "s" : "o");
  const tier =
    score >= 12 ? "Premium" :
    score >= 9 ? "Strong" :
    score >= 7 ? "Playable" :
    score >= 5 ? "Marginal" : "Weak";
  return { score, tier, shorthand, suited, pair: hi === lo };
}

/**
 * A rough, beginner-level action suggestion based on equity versus a fair share of the pot.
 * Returns { action, reason }.
 */
export function suggestAction({ equity, players, street, improveChance }) {
  const fair = 1 / players;
  const ratio = equity / fair;
  const pct = (x) => `${Math.round(x * 100)}%`;
  const vs = `You win about ${pct(equity)} of the time; an average hand at a ${players}-player table wins ${pct(fair)}.`;

  if (ratio >= 1.8) return { action: "Raise", reason: `${vs} You're well ahead, so build the pot.` };
  if (ratio >= 1.15) return { action: "Bet or call", reason: `${vs} You're ahead of the field, so it's worth putting money in.` };
  if (street !== "river" && improveChance != null && improveChance >= 0.3) {
    return {
      action: "Check or call small bets",
      reason: `${vs} You have a good draw (${pct(improveChance)} to improve), so stay in if it's cheap.`,
    };
  }
  if (ratio >= 0.8) return { action: "Check or call small bets", reason: `${vs} You're about average, so avoid big pots.` };
  return { action: "Check, or fold to a bet", reason: `${vs} You're behind; don't pay to see more cards.` };
}

export const STREETS = ["preflop", "flop", "turn", "river"];
export const streetFor = (boardLength) => ({ 0: "preflop", 3: "flop", 4: "turn", 5: "river" })[boardLength];

/** Everything the UI and the coach need to know about a spot. */
export function analyze(hole, board, players, iterations) {
  const street = streetFor(board.length);
  const sim = simulateEquity(hole, board, players, iterations);
  const result = { street, players, ...sim };
  if (street === "preflop") {
    result.preflop = preflopStrength(hole);
  } else {
    result.made = bestHand([...hole, ...board]);
    const { outs, byCategory, improveChance } = findOuts(hole, board);
    result.outs = outs;
    result.outsByCategory = byCategory;
    result.improveChance = improveChance;
  }
  result.suggestion = suggestAction({ equity: sim.equity, players, street, improveChance: result.improveChance });
  return result;
}
