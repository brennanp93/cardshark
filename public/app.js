import {
  RANKS,
  SUITS,
  SUIT_SYMBOLS,
  parseCard,
  cardCode,
  cardLabel,
  analyze,
} from "./poker.js";

const STORAGE_KEY = "cardshark:hand";
const BOARD_NAMES = ["Flop", "Flop", "Flop", "Turn", "River"];

const state = { players: 6, hole: [], board: [] };
let picking = null; // { group: "hole" | "board", index }
let coach = { enabled: false, key: null, text: null, loading: false, error: null };
let lastAnalysis = null;

const $ = (id) => document.getElementById(id);
const holeSlots = $("holeSlots");
const boardSlots = $("boardSlots");
const analysisEl = $("analysis");
const picker = $("picker");
const pickerGrid = $("pickerGrid");
const pickerTitle = $("pickerTitle");

// ---------- persistence ----------

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      players: state.players,
      hole: state.hole.map(cardCode),
      board: state.board.map(cardCode),
    }));
  } catch {}
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return;
    const hole = saved.hole.map(parseCard);
    const board = saved.board.map(parseCard);
    if ([...hole, ...board].some((c) => c < 0)) return;
    state.players = Math.min(10, Math.max(2, saved.players | 0));
    state.hole = hole;
    state.board = board;
  } catch {}
}

// ---------- helpers ----------

const used = () => new Set([...state.hole, ...state.board]);
const pct = (x) => `${Math.round(x * 100)}%`;

function nextSlot() {
  if (state.hole.length < 2) return { group: "hole", index: state.hole.length };
  if (state.board.length < 5) return { group: "board", index: state.board.length };
  return null;
}

function streetOf(slot) {
  return slot.group === "hole" ? "hole" : BOARD_NAMES[slot.index];
}

function cardEl(card, { small = false, highlight = false } = {}) {
  const el = document.createElement("span");
  const suit = SUITS[card & 3];
  el.className = `card ${suit === "h" || suit === "d" ? "red" : "black"}${small ? " small" : ""}${highlight ? " hl" : ""}`;
  const rank = RANKS[card >> 2];
  el.innerHTML = `<span class="rank">${rank === "T" ? "10" : rank}</span><span class="suit">${SUIT_SYMBOLS[suit]}</span>`;
  el.setAttribute("aria-label", cardLabel(card));
  return el;
}

// ---------- rendering ----------

function renderSlots(container, group, count) {
  container.replaceChildren();
  const cards = state[group];
  const next = nextSlot();
  for (let i = 0; i < count; i++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "slot";
    if (group === "board" && (i === 3 || i === 4)) btn.classList.add("gap");
    if (i < cards.length) {
      btn.appendChild(cardEl(cards[i]));
      btn.setAttribute("aria-label", `Change ${cardLabel(cards[i])}`);
      btn.addEventListener("click", () => openPicker({ group, index: i }));
    } else if (next && next.group === group && next.index === i) {
      btn.classList.add("next");
      btn.textContent = "+";
      btn.setAttribute("aria-label", `Add ${group === "hole" ? "hole card" : BOARD_NAMES[i].toLowerCase() + " card"}`);
      btn.addEventListener("click", () => openPicker({ group, index: i }));
    } else {
      btn.disabled = true;
      btn.classList.add("empty");
    }
    container.appendChild(btn);
  }
}

function renderAnalysis() {
  analysisEl.replaceChildren();
  if (state.hole.length < 2) {
    analysisEl.innerHTML = `<p class="placeholder">Tap <strong>+</strong> to enter your two cards. You'll get your odds and a suggestion at every street.</p>`;
    return;
  }
  if (state.board.length === 1 || state.board.length === 2) {
    analysisEl.innerHTML = `<p class="placeholder">Add the rest of the flop (${3 - state.board.length} more).</p>`;
    return;
  }

  // Cache so re-renders (e.g. coach loading) don't re-roll the simulation.
  if (lastAnalysis?.key !== handKey()) lastAnalysis = { key: handKey(), result: analyze(state.hole, state.board, state.players) };
  const a = lastAnalysis.result;
  const streetName = { preflop: "Before the flop", flop: "On the flop", turn: "On the turn", river: "On the river" }[a.street];

  const head = document.createElement("div");
  head.className = "verdict";
  head.innerHTML = `<span class="street">${streetName}</span><span class="action">${a.suggestion.action}</span>`;
  analysisEl.appendChild(head);

  const stats = document.createElement("div");
  stats.className = "stats";
  stats.innerHTML = `
    <div><span class="num">${pct(a.win)}</span><span class="lbl">win</span></div>
    <div><span class="num">${pct(a.tie)}</span><span class="lbl">tie</span></div>
    <div><span class="num">${pct(1 / state.players)}</span><span class="lbl">average hand</span></div>`;
  analysisEl.appendChild(stats);

  const reason = document.createElement("p");
  reason.className = "reason";
  reason.textContent = a.suggestion.reason;
  analysisEl.appendChild(reason);

  if (a.preflop) {
    const p = a.preflop;
    const block = document.createElement("div");
    block.className = "block";
    const kind = p.pair ? "a pocket pair" : p.suited ? "suited (same suit, so flushes are possible)" : "offsuit";
    block.innerHTML = `<h3>Starting hand: ${p.shorthand} <span class="tier tier-${p.tier.toLowerCase()}">${p.tier}</span></h3>
      <p class="small">This hand is ${kind}. Premium and Strong hands are worth raising; Marginal hands are better in late position or with fewer players.</p>`;
    analysisEl.appendChild(block);
  }

  if (a.made) {
    const block = document.createElement("div");
    block.className = "block";
    const h3 = document.createElement("h3");
    h3.textContent = a.made.name;
    const row = document.createElement("div");
    row.className = "made";
    const best = new Set(a.made.cards);
    for (const c of [...state.hole, ...state.board]) row.appendChild(cardEl(c, { small: true, highlight: best.has(c) }));
    const note = document.createElement("p");
    note.className = "small";
    note.textContent = "Highlighted cards make your best five.";
    block.append(h3, row, note);
    analysisEl.appendChild(block);
  }

  if (a.street === "flop" || a.street === "turn") {
    const block = document.createElement("div");
    block.className = "block";
    if (a.outs.length) {
      const toCome = a.street === "flop" ? "by the river" : "on the river";
      const rule = a.street === "flop" ? `${a.outs.length} × 4 ≈ ${Math.min(100, a.outs.length * 4)}%` : `${a.outs.length} × 2 ≈ ${a.outs.length * 2}%`;
      block.innerHTML = `<h3>${a.outs.length} outs · ${pct(a.improveChance)} to improve ${toCome}</h3>
        <p class="small">Rule of thumb: ${rule}.</p>`;
      for (const [cat, cards] of Object.entries(a.outsByCategory)) {
        const line = document.createElement("div");
        line.className = "outs";
        const label = document.createElement("span");
        label.className = "outs-label";
        label.textContent = `${cat} (${cards.length})`;
        const row = document.createElement("div");
        row.className = "made";
        cards.forEach((c) => row.appendChild(cardEl(c, { small: true })));
        line.append(label, row);
        block.appendChild(line);
      }
    } else {
      block.innerHTML = `<h3>No outs</h3><p class="small">No single card improves your hand to a new rank, so your hand is as good as it's going to get, or you need a lot of luck.</p>`;
    }
    analysisEl.appendChild(block);
  }

  renderCoach();
}

function handKey() {
  return `${state.players}|${state.hole.map(cardCode).join("")}|${state.board.map(cardCode).join("")}`;
}

function renderCoach() {
  if (!coach.enabled) return;
  const block = document.createElement("div");
  block.className = "block coach";
  const current = coach.key === handKey();

  if (current && coach.text) {
    block.innerHTML = `<h3>Coach</h3>`;
    const p = document.createElement("p");
    p.textContent = coach.text;
    block.appendChild(p);
  } else {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "coach-btn";
    btn.disabled = current && coach.loading;
    btn.textContent = btn.disabled ? "Thinking…" : "Ask the coach why";
    btn.addEventListener("click", askCoach);
    block.appendChild(btn);
    if (current && coach.error) {
      const err = document.createElement("p");
      err.className = "error";
      err.textContent = coach.error;
      block.appendChild(err);
    }
  }
  analysisEl.appendChild(block);
}

async function askCoach() {
  const key = handKey();
  coach = { ...coach, key, text: null, loading: true, error: null };
  render();
  try {
    const res = await fetch("/api/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        players: state.players,
        hole: state.hole.map(cardCode),
        board: state.board.map(cardCode),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (coach.key !== key) return; // hand changed while waiting
    if (!res.ok) throw new Error(data.error || "The coach hit an error.");
    coach = { ...coach, text: data.advice, loading: false };
  } catch (err) {
    if (coach.key !== key) return;
    coach = { ...coach, loading: false, error: err.message || "Couldn't reach the coach." };
  }
  render();
}

function render() {
  $("playersCount").textContent = state.players;
  $("playersDown").disabled = state.players <= 2;
  $("playersUp").disabled = state.players >= 10;
  renderSlots(holeSlots, "hole", 2);
  renderSlots(boardSlots, "board", 5);
  renderAnalysis();
  $("undo").disabled = state.hole.length + state.board.length === 0;
}

// ---------- card picker ----------

function openPicker(slot) {
  picking = slot;
  const replacing = state[slot.group][slot.index];
  const taken = used();
  pickerTitle.textContent =
    slot.group === "hole" ? `Your card ${slot.index + 1} of 2`
      : slot.index < 3 ? `Flop card ${slot.index + 1} of 3`
      : BOARD_NAMES[slot.index];

  pickerGrid.replaceChildren();
  for (let s = 0; s < 4; s++) {
    for (let r = 12; r >= 0; r--) {
      const card = r * 4 + s;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pick";
      btn.appendChild(cardEl(card, { small: true }));
      btn.setAttribute("aria-label", cardLabel(card));
      if (card === replacing) btn.classList.add("current");
      else if (taken.has(card)) btn.disabled = true;
      btn.addEventListener("click", () => choose(card));
      pickerGrid.appendChild(btn);
    }
    const spacer = document.createElement("span");
    spacer.className = "suit-gap";
    pickerGrid.appendChild(spacer);
  }
  if (!picker.open) picker.showModal();
}

function choose(card) {
  const slot = picking;
  state[slot.group][slot.index] = card;
  save();
  render();

  // Keep the picker open while the current street still needs cards.
  const next = nextSlot();
  if (next && streetOf(next) === streetOf(slot) && slot.index === state[slot.group].length - 1) {
    openPicker(next);
  } else {
    picker.close();
  }
}

picker.addEventListener("close", () => { picking = null; });
picker.addEventListener("click", (e) => { if (e.target === picker) picker.close(); });
$("pickerClose").addEventListener("click", () => picker.close());

// ---------- controls ----------

$("playersDown").addEventListener("click", () => { state.players = Math.max(2, state.players - 1); save(); render(); });
$("playersUp").addEventListener("click", () => { state.players = Math.min(10, state.players + 1); save(); render(); });

$("undo").addEventListener("click", () => {
  if (state.board.length) state.board.pop();
  else state.hole.pop();
  save();
  render();
});

$("newHand").addEventListener("click", () => {
  state.hole = [];
  state.board = [];
  save();
  render();
  openPicker(nextSlot());
});

load();
render();
fetch("/api/status")
  .then((r) => r.json())
  .then((s) => { coach.enabled = Boolean(s.coach); render(); })
  .catch(() => {});
