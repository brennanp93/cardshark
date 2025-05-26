const deck = [
  // Blank
  "--",
  // Hearts
  "AH",
  "2H",
  "3H",
  "4H",
  "5H",
  "6H",
  "7H",
  "8H",
  "9H",
  "10H",
  "JH",
  "QH",
  "KH",
  // Diamonds
  "AD",
  "2D",
  "3D",
  "4D",
  "5D",
  "6D",
  "7D",
  "8D",
  "9D",
  "10D",
  "JD",
  "QD",
  "KD",
  // Clubs
  "AC",
  "2C",
  "3C",
  "4C",
  "5C",
  "6C",
  "7C",
  "8C",
  "9C",
  "10C",
  "JC",
  "QC",
  "KC",
  // Spades
  "AS",
  "2S",
  "3S",
  "4S",
  "5S",
  "6S",
  "7S",
  "8S",
  "9S",
  "10S",
  "JS",
  "QS",
  "KS",
];

// mutatable deck
let playingDeck = deck;

let inPlayCards = [];

// Flop Cards
let flopDiv = document.getElementById("flopDiv");
let flopArray = flopDiv.querySelectorAll("select");

// Hole cards
let holeCardDiv = document.getElementById("holeCardDiv");
let holeCardArray = holeCardDiv.querySelectorAll("select");

// hole cards for future manipulation
// let hc1 = document.getElementById("hc1");
// let hc2 = document.getElementById("hc2");

let turn = document.getElementById("turn");
let river = document.getElementById("river");

// Forms
let holeCardForm = document.getElementById("holeCardForm");
let flopForm = document.getElementById("flopForm");
let riverForm = document.getElementById("riverForm");
let turnForm = document.getElementById("turnForm");

/**
 * Populate ALL "flop"'s dropdowns with all cards.
 */
function init() {
  populateHoleCardsList();
  console.log("init");

}

// Populate the hole card drop downs.
function populateHoleCardsList() {
  // capture the two drop downs for the hole cards and iterate through them
  holeCardArray.forEach(function (cc) {
    // iterate through the deck to populate the drop downs
    playingDeck.forEach((card) => {
      let option = document.createElement("option");
      option.innerHTML = "";
      option.innerText = card;
      option.value = card;
      cc.appendChild(option);
    });
  });
  // console.log("populateHoleCardsList");
}

function populateFlop(params) {
  flopArray.forEach(function (fc) {
    // iterate through the deck to populate the drop downs
    playingDeck.forEach((card) => {
      let option = document.createElement("option");
      option.innerHTML = "";
      option.innerText = card;
      option.value = card;
      fc.appendChild(option);
    });
  });
  // console.log("populateFlop")
}

function populateTurn() {
  playingDeck.forEach((card) => {
    let option = document.createElement("option");
    // option.innerHTML = "";
    option.innerText = card;
    option.value = card;
    turn.appendChild(option)
  });
}
function populateRiver() {
    playingDeck.forEach((card) => {
    let option = document.createElement("option");
    option.innerHTML = "";
    option.innerText = card;
    option.value = card;
    river.appendChild(option)
  });
}
// document.getElementById("btn").disabled = true;

function filterInPlayCards() {
  let idx = [];
  inPlayCards.forEach((card) => {
    if (playingDeck.includes(card)) {
      idx.push(playingDeck.indexOf(card));
    }
  });
  idx
    .sort((a, b) => b - a)
    .forEach((idx) => {
      playingDeck.splice(idx, 1);
    });
    // console.log("filterInPlayCards")
}

class InPlayCards {
  constructor(hole1, hole2, cc1, cc2, cc3, cc4, cc5) {
    this.hole1 = hole1;
    this.hole2 = hole2;
    this.cc1 = null;
    this.cc2 = null;
    this.cc3 = null;
    this.cc4 = null;
    this.cc5 = null;
  }

  setHoleCards(card1, card2) {
    if (card1 !== card2) {
      this.hole1 = card1;
      this.hole2 = card2;
      inPlayCards.push(card1, card2);
      console.log(inPlayCards);
      filterInPlayCards();
      populateFlop();
      flopDiv.classList.remove("hidden");
    } else {
      init();
      alert("You can't have two of the same card.");
      return;
    }
    // console.log("setHoleCards");
  }

  setFlop(cards) {
    if (!checkDupes(cards)) {
      // console.log(cards[0]);
      this.cc1 = cards[0];
      this.cc2 = cards[1];
      this.cc3 = cards[2];
      inPlayCards.push(...cards);
      filterInPlayCards();
      populateTurn();
      turnDiv.classList.remove("hidden");
    } else {
      // populateFlop();
      alert("duplicate detected");
      return;
    }
    // console.log("setFlop");
    // console.log(hand);
  }

  setTurn(card4) {
    if (!inPlayCards.includes(card4)) {
      this.cc4 = card4;
      inPlayCards.push(card4);
      filterInPlayCards();
      populateRiver();
      riverDiv.classList.remove("hidden");
    } else {
      alert("duplicate detected");
      return;
    }
  }
  setRiver(card5) {
    if (!inPlayCards.includes(card5)) {
      this.cc5 = card5;
      inPlayCards.push(card5);
      filterInPlayCards();
      console.log(inPlayCards);
    } else {
      alert("duplicate detected");
      return;
    }
    console.log(hand);
  }
}
const hand = new InPlayCards();

// holeCardDiv.addEventListener("change",(e)=>{
//   e.preventDefault();
//   if (!hc1.value === "--"){
//     document.getElementById("btn").disabled = false;
//   }
// })
holeCardForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (hc1.value === "--" || hc2.value === "--") {
    return;
  }
  hand.setHoleCards(hc1.value, hc2.value);
  console.log(hand);
});

flopForm.addEventListener("submit", (e) => {
  e.preventDefault();
    if (cc1.value === "--" || cc2.value === "--" || cc3.value === "--") {
    return;
  }
  hand.setFlop([cc1.value, cc2.value, cc3.value]);
  // console.log(cc1.value, cc2.value, cc3.value);
});

turnForm.addEventListener("submit", (e)=>{
  e.preventDefault();
  if (turn.value === "--") {
    return
  }
  hand.setTurn(turn.value);
})

riverForm.addEventListener("submit", (e)=>{
  e.preventDefault();
  if (river.value === "--") {
    return
  }
  hand.setRiver(river.value);
  // console.log(hand)
})

function checkDupes(arr) {
return arr.length !== new Set(arr).size
}

// document.getElementById("hc1").addEventListener("change", (e) => {
// hc1.addEventListener("change", (e) => {
//     e.preventDefault();
//     // reset second hole card drop down to prepare for updated list of cards
//     hc2.innerHTML = ""
//     inPlayCards.push(e.target.value)
//     // remove the selected card from the first drop down so that it is not included in the second drop down.
//     if (!inPlayCards.includes(e.target.value)) {
//         playingDeck = playingDeck.filter((card) => {
//             card !== e.target.value
//         });
//     }

//     // playingDeck = playingDeck.filter((card) => card !== e.target.value);
//     // iterate through the new deck to populate the drop down without the first selected card.
//     playingDeck.forEach((card, idx) => {
//         let option = document.createElement("option");
//         option.innerText = card;
//         option.value = card;
//         hc2.appendChild(option)
//     })
//     console.log(inPlayCards)
// })

// When one hole card drop down is changed, mutate the array so that the
// second drop down does not include the card selected in the first drop down.

// You want all 3 cards of the flop to be able to be populated.
// Then the subsequent two cards, you'll want to clone or something.

init();
