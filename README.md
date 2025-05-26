# Card Shark

## High-Level Overview

1. User inputs how many players (or hands) are being dealt at the poker table.  
2. User inputs the two hole cards they are currently holding.  
3. User inputs the flop (the first three community cards).  
4. User hits *Submit* or *Go*, which sends the hole cards and the flop to the AI for analysis. The AI will advise on the optimal next action (raise, check, call, fold, etc.).  
5. Response is returned.  
6. User follows the recommendation.  
7. If continuing, the user enters the turn card (the fourth community card).  
8. Step 4 is repeated.  
9. If continuing, the user enters the river card (the fifth and final community card).  
10. Step 5 is repeated.  
11. End of hand.

## Overview

- **Hand Input:**  
  Allow the user to input their hand (the two hole cards they are holding).  
  - This will likely be implemented as dropdown menus with pre-populated card values.  
  - The second dropdown should dynamically exclude the card selected in the first dropdown.  
    - For example: if the first card selected is *Ace of Hearts*, that card should not appear as an option in the second dropdown.  

- **The Flop:**  
  Similar to the hand input, provide dropdowns to select each of the three flop cards (the first community cards).  
  - Each subsequent dropdown should exclude the cards already selected.  

- **AI Request:**  
  The selected card data is sent, along with a prompt, to the language model (LLM).  
  - The prompt should guide the model to provide basic recommendations such as "raise", "check", "call", or "fold".  
  - The response format could be a simple object, e.g., `{ response: "raise" }` or `{ response: "check" }`.  

- **Data Handling:**  
  The selected cards (especially community cards) may need to be stored in local storage to persist between stages of the hand (e.g., from flop to turn to river).  
