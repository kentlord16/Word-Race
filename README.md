# ⚡ Word Race

Crack as many five-letter words as you can before the clock runs out, then dare a friend to beat you on the **same words**.

- **3 or 5 minute races.** Six guesses a word; solve it (or run out of guesses) and the next one drops straight in. Stuck? **Skip** it and keep moving.
- **Daily race.** One 3-minute race a day with the same words for everyone, numbered (#1 was 16 Nov 2026), so friends can compare without even sending a link.
- **Feels good to play.** Praise for fast solves ("Genius!"), 🔥 streaks for solves in a row, a 3-2-1-GO start, and quit needs a second tap once you've started so a stray tap can't wipe a run.
- **Challenge links.** "Challenge a friend" opens the share sheet (Messages, WhatsApp, social…) or copies a link, with a brag line and one square per word (🟩 solved, ⬛ missed). The link carries the word order and your score, so your friend races the same words on the same clock and sees who won. Ties on words go to whoever needed fewer guesses.
- **No account, no server.** Best scores, lifetime totals and your name stay on the device.
- **Keyboard friendly.** On a computer, type to guess and press Enter to start or race again.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm test
npm run build    # static site in dist/ — host it anywhere
```

## Code map

```
src/game.ts        rules: scoring a guess, seeded word order, scores, challenge links (tested)
src/Play.tsx       the race: clock, board, keyboard
src/App.tsx        home, results, sharing
src/sound.ts       synthesized sound effects
src/words/         generated word lists
scripts/answers.txt   the words a race can ask for — edit this, then `npm run words`
```

Guesses are checked against a general English dictionary (`an-array-of-english-words`, MIT); the answers are a hand-picked list of everyday words.

## Good to know

- Scores in a challenge link are on the honour system — there is no server checking them.
- Live head-to-head races, friend lists and leaderboards would need accounts and a backend; the link-based challenge is the no-backend version of "play your contacts".
