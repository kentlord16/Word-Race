import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { isWord } from './dictionary';
import {
  type Board,
  type Kind,
  MAX_GUESSES,
  type Minutes,
  type Result,
  letterMarks,
  livesLeft,
  nextWord,
  praiseFor,
  scoreGuess,
  streakOf,
} from './game';
import { sfx } from './sound';

const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', '+zxcvbnm-'];
const COUNT_FROM = 3;
const SOLVED_PAUSE = 900;
const MISSED_PAUSE = 1500;
const SKIPPED_PAUSE = 1000;
const GO_FLASH = 650;

const clock = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export interface Progress {
  boards: Board[];
  guesses: string[];
}

interface Props {
  kind: Kind;
  seed: string;
  /** null = untimed (the daily tower). */
  minutes: Minutes | null;
  /** Misses allowed before the game ends; unlimited when left out. */
  lives?: number;
  resume?: Progress;
  onSave?: (progress: Progress) => void;
  onDone: (result: Result) => void;
  onQuit: () => void;
}

export function Play({ kind, seed, minutes, lives, resume, onSave, onDone, onQuit }: Props) {
  const timed = minutes !== null;
  const total = (minutes ?? 0) * 60_000;
  const tower = kind === 'tower';

  const [count, setCount] = useState(timed ? COUNT_FROM : 0);
  const [left, setLeft] = useState(total);
  const [boards, setBoards] = useState<Board[]>(resume?.boards ?? []);
  const [guesses, setGuesses] = useState<string[]>(resume?.guesses ?? []);
  const [draft, setDraft] = useState('');
  /** Set while a finished board is still on screen, before the next one drops in. */
  const [outcome, setOutcome] = useState<'solved' | 'missed' | 'skipped' | null>(null);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [nudge, setNudge] = useState<{ text: string; id: number } | null>(null);

  const answer = outcome ? boards[boards.length - 1].word : nextWord(kind, seed, boards);
  const hearts = lives === undefined ? null : livesLeft(boards, lives);
  const timeUp = timed && left <= 0;
  const running = count === 0 && !timeUp && hearts !== 0;

  // 3 · 2 · 1
  useEffect(() => {
    if (count === 0) return;
    sfx.count();
    const t = setTimeout(() => setCount(count - 1), 750);
    return () => clearTimeout(t);
  }, [count]);

  // The clock runs off the wall clock, so a backgrounded tab can't stretch it.
  useEffect(() => {
    if (!timed || count !== 0) return;
    sfx.go();
    const endAt = Date.now() + total;
    const t = setInterval(() => setLeft(Math.max(0, endAt - Date.now())), 100);
    return () => clearInterval(t);
  }, [timed, count, total]);

  const secondsLeft = Math.ceil(left / 1000);
  const low = timed && count === 0 && secondsLeft <= 10;
  useEffect(() => {
    if (low && secondsLeft <= 5 && secondsLeft > 0) sfx.tick();
  }, [low, secondsLeft]);

  // Keep the daily tower saved after every move. A finished board is already in
  // `boards`, so its guesses aren't saved a second time.
  const saveRef = useRef(onSave);
  saveRef.current = onSave;
  useEffect(() => {
    saveRef.current?.({ boards, guesses: outcome ? [] : guesses });
  }, [boards, guesses, outcome]);

  const finished = useRef(false);
  const finish = (all: Board[]) => {
    if (finished.current) return;
    finished.current = true;
    onDone({ kind, seed, minutes, boards: all });
  };

  // Time's up: hand back everything finished, plus the board in progress.
  useEffect(() => {
    if (!timeUp) return;
    const unfinished = !outcome && guesses.length > 0 ? [{ word: answer, solved: false, guesses: guesses.length }] : [];
    finish([...boards, ...unfinished]);
  });

  // Hold a finished board on screen for a beat, then deal the next one — or end
  // the game if that was the last heart.
  useEffect(() => {
    if (!outcome) return;
    const pause = outcome === 'solved' ? SOLVED_PAUSE : outcome === 'skipped' ? SKIPPED_PAUSE : MISSED_PAUSE;
    const t = setTimeout(() => {
      if (hearts === 0) return finish(boards);
      setGuesses([]);
      setOutcome(null);
    }, pause);
    return () => clearTimeout(t);
    // Only the outcome starts the pause: re-running on every clock tick would keep restarting it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcome]);

  useEffect(() => {
    if (!confirmQuit) return;
    const t = setTimeout(() => setConfirmQuit(false), 2500);
    return () => clearTimeout(t);
  }, [confirmQuit]);

  useEffect(() => {
    if (!nudge) return;
    const t = setTimeout(() => setNudge(null), 1100);
    return () => clearTimeout(t);
  }, [nudge]);

  function press(key: string) {
    if (!running || outcome) return;
    if (key === 'enter') return submit();
    if (key === 'back') return setDraft(draft.slice(0, -1));
    if (draft.length < answer.length) {
      sfx.tap();
      setDraft(draft + key);
    }
  }

  function endBoard(solved: boolean, used: number, how: 'solved' | 'missed' | 'skipped') {
    setBoards([...boards, { word: answer, solved, guesses: used }]);
    setDraft('');
    setOutcome(how);
  }

  function skip() {
    if (!running || outcome) return;
    sfx.missed();
    endBoard(false, guesses.length, 'skipped');
  }

  function submit() {
    const problem = draft.length < answer.length ? 'Not enough letters' : !isWord(draft) ? 'Not in our word list' : null;
    if (problem) {
      sfx.nope();
      return setNudge({ text: problem, id: Date.now() });
    }
    const next = [...guesses, draft];
    setGuesses(next);
    setDraft('');
    const solved = draft === answer;
    if (!solved && next.length < MAX_GUESSES) return sfx.guess();
    if (solved) sfx.solved();
    else sfx.missed();
    endBoard(solved, next.length, solved ? 'solved' : 'missed');
  }

  // Untimed games save as they go, so leaving is free. A timed run would be
  // lost, so once it's under way quitting takes a second tap.
  function quit() {
    if (!timed || confirmQuit || (boards.length === 0 && guesses.length === 0)) return onQuit();
    setConfirmQuit(true);
  }

  // Physical keyboard. The ref keeps the listener pointed at the latest state.
  const pressRef = useRef(press);
  pressRef.current = press;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === 'enter') e.preventDefault();
      if (key === 'enter' || /^[a-z]$/.test(key)) pressRef.current(key);
      else if (key === 'backspace') pressRef.current('back');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const keyMarks = letterMarks(guesses, answer);
  const solvedCount = boards.filter((b) => b.solved).length;
  const boardNumber = boards.length + (outcome ? 0 : 1);
  const streak = streakOf(boards);
  const showGo = timed && count === 0 && total - left < GO_FLASH;
  const label = tower ? (solvedCount === 1 ? 'floor' : 'floors') : 'solved';

  return (
    <main className={`screen play ${kind}`}>
      <header className="hud">
        <button
          className={`icon-btn quit${confirmQuit ? ' confirm' : ''}`}
          onClick={quit}
          aria-label={!timed ? 'Save and leave' : confirmQuit ? 'Tap again to quit' : 'Quit'}
        >
          {confirmQuit ? (
            'Quit?'
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          )}
        </button>

        {timed ? (
          <div className={`clock${low ? ' low' : ''}`} role="timer" aria-label="Time left">
            {clock(left)}
          </div>
        ) : (
          <div className="hearts" aria-label={`${hearts} of ${lives} lives left`}>
            {Array.from({ length: lives ?? 0 }, (_, i) => (
              <svg key={i} viewBox="0 0 24 24" className={i < (hearts ?? 0) ? 'full' : 'lost'} aria-hidden="true">
                <path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0112 7.6a4.3 4.3 0 017.5 2.7c0 5.6-7.5 10.2-7.5 10.2z" />
              </svg>
            ))}
          </div>
        )}

        <div className="solved-count" aria-label={`${solvedCount} ${label}`}>
          <span key={solvedCount} className={solvedCount ? 'bump' : ''}>
            {solvedCount}
          </span>
          <small>{label}</small>
        </div>
      </header>

      {timed && (
        <div className="timebar">
          <i className={low ? 'low' : ''} style={{ transform: `scaleX(${left / total})` }} />
        </div>
      )}

      <section className="board-wrap">
        <div className="toast-slot" aria-live="assertive">
          {outcome === 'missed' || outcome === 'skipped' ? (
            <div className="toast answer">
              It was <b>{answer}</b>
              {hearts !== null && <span className="streak">{hearts === 0 ? 'Out of hearts' : `${hearts} ♥ left`}</span>}
            </div>
          ) : outcome === 'solved' ? (
            <div className="toast good">
              {praiseFor(guesses.length)}
              {tower ? (
                <span className="streak">Floor {solvedCount} 🧱</span>
              ) : (
                streak >= 2 && <span className="streak">🔥 {streak} in a row</span>
              )}
            </div>
          ) : nudge ? (
            <div className="toast" key={nudge.id}>
              {nudge.text}
            </div>
          ) : null}
        </div>

        <div className="board" key={boardNumber} style={{ '--len': answer.length } as CSSProperties} aria-label={`Word ${boardNumber}, ${answer.length} letters`}>
          {Array.from({ length: MAX_GUESSES }, (_, r) => {
            const guess = guesses[r];
            const isDraft = r === guesses.length && !outcome;
            const letters = guess ?? (isDraft ? draft : '');
            const marks = guess ? scoreGuess(guess, answer) : null;
            const won = outcome === 'solved' && r === guesses.length - 1;
            return (
              <div
                className={`row${won ? ' won' : ''}${isDraft && nudge ? ' shake' : ''}`}
                key={isDraft && nudge ? `shake-${nudge.id}` : r}
              >
                {Array.from({ length: answer.length }, (_, i) => (
                  <div
                    key={i}
                    className={`tile ${marks ? marks[i] : letters[i] ? 'filled' : isDraft ? 'open' : ''}`}
                    style={{ '--i': i } as CSSProperties}
                  >
                    {letters[i]}
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {(count > 0 || showGo) && (
          <div className="countdown" aria-live="assertive">
            <span key={count} className={count === 0 ? 'go' : ''}>
              {count || 'GO!'}
            </span>
          </div>
        )}
      </section>

      <div className="subbar">
        <span>
          {tower ? (
            <>
              Floor <b>{solvedCount + 1}</b> · {answer.length} letters
            </>
          ) : (
            <>
              Word <b>{boardNumber}</b>
              {streak >= 2 && !outcome && <em> · 🔥 {streak}</em>}
            </>
          )}
        </span>
        <button className="skip" onClick={skip} disabled={!running || !!outcome}>
          {hearts !== null ? 'Give up' : 'Skip'}
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l6 6-6 6M13 6l6 6-6 6" />
          </svg>
        </button>
      </div>

      <div className="keyboard">
        {KEY_ROWS.map((row) => (
          <div className="key-row" key={row}>
            {[...row].map((k) => {
              const key = k === '+' ? 'enter' : k === '-' ? 'back' : k;
              return (
                <button
                  key={key}
                  className={`key ${key.length > 1 ? `wide ${key}` : (keyMarks.get(key) ?? '')}`}
                  aria-label={key === 'back' ? 'Backspace' : key === 'enter' ? 'Enter' : key}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    press(key);
                  }}
                >
                  {key === 'enter' ? (
                    'GO'
                  ) : key === 'back' ? (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M9 5h11v14H9l-6-7zM12 9.5l5 5M17 9.5l-5 5" />
                    </svg>
                  ) : (
                    key
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </main>
  );
}
