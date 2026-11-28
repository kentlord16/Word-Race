# ⚡ Word Race

**Play it:** https://kentlord16.github.io/Word-Race/

Two word-guessing games, built for speed and bragging rights.

## Modes

- **🏗️ Tower** (default): words grow from 3 to 8 letters, then start over a level up. Every word you solve adds a floor. Miss or skip one and you get a fresh word of the same length.
- **⚡ Race**: five-letter words, as many as you can crack.
- **3 or 5 minutes** for either, with your best score kept for each.
- **Daily tower:** no clock. Build one tower all day, coming back whenever you like; progress is saved after every guess. Three hearts: each miss or give-up costs one, and the tower is done when they run out.
- **Daily race:** one 3-minute race a day with the same words for everyone.

## Playing friends

- **Challenge links** (timed games): "Challenge a friend" opens the share sheet or copies a link. Your friend gets the same words on the same clock and sees who won. Ties go to whoever needed fewer guesses.
- **Brag text:** a race shares one square per word (🟩 solved, ⬛ missed); a tower shares the tower itself, a row of bricks per floor.
- Daily games use the same words for everyone that day, so friends can compare without a link.

## Feel

Six guesses a word, 3-2-1-GO start, praise for fast solves, 🔥 streaks, synthesized sounds and haptics, a stacking-tower finale. Quitting a timed game needs a second tap; leaving the daily tower is free because it's saved.

No account, no server: scores, totals, your name and today's tower stay on the device.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm test
npm run build    # static site in dist/ — host it anywhere
```

Every push to `main` publishes the game to GitHub Pages (`.github/workflows/pages.yml`). Challenge links point at wherever the game is being served.

## Code map

```
src/game.ts        rules: scoring a guess, tower lengths, seeded word order, scores, challenge links (tested)
src/Play.tsx       a game in progress: clock or hearts, board, keyboard
src/App.tsx        home, results (with the tower drawing), sharing
src/store.ts       what's saved on the device
src/dictionary.ts  loads the guess dictionary in the background
src/sound.ts       synthesized sound effects
src/words/         generated word lists
scripts/answers.txt   five-letter answers, hand-picked
scripts/blocked.txt   words never used as answers
```

After editing either list, run `npm run words`. Other answer lengths come from the most common tiers of SCOWL (`wordlist-english`), minus plurals and blocked words. Guesses are checked against a general English dictionary (`an-array-of-english-words`), which loads in the background after the first screen.

## Good to know

- Scores in a challenge link are on the honour system — there is no server checking them.
- The daily tower lives on one device; clearing browser data clears it.
- Live head-to-head races, friend lists and leaderboards would need accounts and a backend; the link-based challenge is the no-backend version of "play your contacts".
