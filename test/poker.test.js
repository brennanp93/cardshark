import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseCard,
  evaluate,
  describeScore,
  bestHand,
  simulateEquity,
  findOuts,
  preflopStrength,
  categoryOf,
} from "../public/poker.js";

const cards = (s) => s.split(" ").map(parseCard);
const name = (s) => describeScore(evaluate(cards(s)));

test("parses cards", () => {
  assert.equal(parseCard("2s"), 0);
  assert.equal(parseCard("Ac"), 51);
  assert.equal(parseCard("10h"), -1);
  assert.equal(parseCard("Xx"), -1);
});

test("names every hand category", () => {
  assert.equal(name("As Ks Qs Js Ts 2d 3c"), "Royal Flush");
  assert.equal(name("5h 4h 3h 2h Ah Kd Kc"), "Straight Flush, Five high");
  assert.equal(name("9s 9h 9d 9c Ks 2d 3c"), "Four of a Kind, Nines");
  assert.equal(name("Ks Kh Kd 7c 7s 7d 2c"), "Full House, Kings full of Sevens");
  assert.equal(name("Ks Kh Kd 7c 7s 2d 2c"), "Full House, Kings full of Sevens");
  assert.equal(name("Ah 9h 7h 4h 2h Kd Qc"), "Flush, Ace high");
  assert.equal(name("As 2d 3c 4h 5s Kd Qc"), "Straight, Five high");
  assert.equal(name("9s Td Jc Qh Ks Ad 2c"), "Straight, Ace high");
  assert.equal(name("Qs Qh Qd 7c 2s 4d 9c"), "Three of a Kind, Queens");
  assert.equal(name("Ks Kh 7d 7c 2s 2d 9c"), "Two Pair, Kings and Sevens");
  assert.equal(name("Js Jh 7d 5c 2s 3d 9c"), "Pair of Jacks");
  assert.equal(name("As Jh 7d 5c 2s 3d 9c"), "High Card, Ace");
});

test("kickers break ties", () => {
  assert.ok(evaluate(cards("As Ah Kd 7c 2s")) > evaluate(cards("Ac Ad Qd 7h 2h")));
  assert.equal(evaluate(cards("As Kh Qd Jc 9s")), evaluate(cards("Ac Kd Qh Js 9d")));
  // Two pair: third pair on board doesn't count, best kicker does.
  assert.ok(evaluate(cards("Ks Kh 7d 7c 2s 2d Ac")) > evaluate(cards("Ks Kh 7d 7c 2s 2d Qc")));
});

test("bestHand picks the right five cards", () => {
  const h = bestHand(cards("Ah Kh 2h 7h 9h 9s 9d"));
  assert.equal(h.category, "Flush");
  assert.equal(h.cards.length, 5);
});

test("equity is sane", () => {
  const aces = simulateEquity(cards("As Ah"), [], 2, 20000);
  assert.ok(aces.equity > 0.82 && aces.equity < 0.88, `AA heads-up ${aces.equity}`);
  const nuts = simulateEquity(cards("As Ks"), cards("Qs Js Ts"), 6, 2000);
  assert.equal(nuts.equity, 1);
});

test("counts flush-draw outs", () => {
  const { outs, byCategory, improveChance } = findOuts(cards("Ah Kh"), cards("7h 2h 9c"));
  assert.equal(byCategory["Flush"].length, 9);
  assert.ok(outs.length >= 9);
  assert.ok(improveChance > 0.5); // flush draw + overcards
});

test("board pairing is not an out", () => {
  const { byCategory } = findOuts(cards("Ah Kd"), cards("7s 2c 9h"));
  // Pairing an ace or king is an out (3 + 3); pairing a 7, 2 or 9 on the board isn't.
  assert.equal(byCategory["Pair"].length, 6);
  assert.equal(categoryOf(evaluate(cards("Ah Kd 7s 2c 9h"))), 0);
});

test("preflop tiers", () => {
  assert.equal(preflopStrength(cards("As Ah")).tier, "Premium");
  assert.equal(preflopStrength(cards("As Ks")).shorthand, "AKs");
  assert.equal(preflopStrength(cards("7d 2c")).tier, "Weak");
});
