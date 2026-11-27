import { useEffect, useMemo, useRef, useState } from 'react';
import {
  type Board,
  MAX_GUESSES,
  type Minutes,
  type Result,
  WORD_LENGTH,
  letterMarks,
  praiseFor,
  scoreGuess,
  streakOf,
  wordsForSeed,
} from './game';
import { sfx } from './sound';
import { ALLOWED } from './words/allowed';

const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', '+zxcvbnm-'];
const COUNT_FROM = 3;
const SOLVED_PAUSE = 850;
const MISSED_PAUSE = 1500;
const SKIPPED_PAUSE = 1000;
const GO_FLASH = 650;

const clock = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

interface Props {
  seed: string;
  minutes: Minutes;
  onDone: (result: Result) => void;
  onQuit: () => void;
}

export function Play({ seed, minutes, onDone, onQuit }: Props) {
  const words = useMemo(() => wordsForSeed(seed), [seed]);
  const total = minutes * 60_000;

  const [count, setCount] = useState(COUNT_FROM);
  const [left, setLeft] = useState(total);
  const [boards, setBoards] = useState<Board[]>([]);
  const [guesses, setGuesses] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  /** Set while a finished board is still on screen, before the next one drops in. */
  const [outcome, setOutcome] = useState<'solved' | 'missed' | 'skipped' | null>(null);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [nudge, setNudge] = useState<{ text: string; id: number } | null>(null);

  const answer = words[boards.length - (outcome ? 1 : 0)];
  const running = count === 0 && left > 0;

  // 3 · 2 · 1
  useEffect(() => {
    if (count === 0) return;
    sfx.count();
    const t = setTimeout(() => setCount(count - 1), 750);
    return () => clearTimeout(t);
  }, [count]);

  // The race clock runs off the wall clock, so a backgrounded tab can't stretch it.
  useEffect(() => {
    if (count !== 0) return;
    sfx.go();
    const endAt = Date.now() + total;
    const t = setInterval(() => setLeft(Math.max(0, endAt - Date.now())), 100);
    return () => clearInterval(t);
  }, [count, total]);

  const secondsLeft = Math.ceil(left / 1000);
  useEffect(() => {
    if (running && secondsLeft <= 5) sfx.tick();
  }, [running, secondsLeft]);

  // Time's up: hand back everything finished, plus the board in progress.
  const finished = useRef(false);
  useEffect(() => {
    if (left > 0 || finished.current) return;
    finished.current = true;
    const unfinished = !outcome && guesses.length > 0 ? [{ word: answer, solved: false, guesses: guesses.length }] : [];
    onDone({ seed, minutes, boards: [...boards, ...unfinished] });
  });

  // Hold a finished board on screen for a beat, then deal the next one.
  useEffect(() => {
    if (!outcome) return;
    const t = setTimeout(
      () => {
        setGuesses([]);
        setOutcome(null);
      },
      outcome === 'solved' ? SOLVED_PAUSE : outcome === 'skipped' ? SKIPPED_PAUSE : MISSED_PAUSE,
    );
    return () => clearTimeout(t);
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
    if (draft.length < WORD_LENGTH) {
      sfx.tap();
      setDraft(draft + key);
    }
  }

  function skip() {
    if (!running || outcome) return;
    sfx.missed();
    setBoards([...boards, { word: answer, solved: false, guesses: guesses.length }]);
    setDraft('');
    setOutcome('skipped');
  }

  // One tap to quit before anything is played; after that, tap twice so a stray tap can't wipe a run.
  function quit() {
    if (confirmQuit || (boards.length === 0 && guesses.length === 0)) return onQuit();
    setConfirmQuit(true);
  }

  function submit() {
    const problem = draft.length < WORD_LENGTH ? 'Not enough letters' : !ALLOWED.has(draft) ? 'Not a word' : null;
    if (problem) {
      sfx.nope();
      return setNudge({ text: problem, id: Date.now() });
    }
    const next = [...guesses, draft];
    setGuesses(next);
    setDraft('');
    const solved = draft === answer;
    if (!solved && next.length < MAX_GUESSES) return sfx.guess();
    solved ? sfx.solved() : sfx.missed();
    setBoards([...boards, { word: answer, solved, guesses: next.length }]);
    setOutcome(solved ? 'solved' : 'missed');
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
  const showGo = count === 0 && total - left < GO_FLASH;

  return (
    <main className="screen play">
      <header className="hud">
        <button
          className={`icon-btn quit${confirmQuit ? ' confirm' : ''}`}
          onClick={quit}
          aria-label={confirmQuit ? 'Tap again to quit' : 'Quit race'}
        >
          {confirmQuit ? (
            'Quit?'
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          )}
        </button>
        <div className={`clock${running && secondsLeft <= 10 ? ' low' : ''}`} role="timer" aria-label="Time left">
          {clock(left)}
        </div>
        <div className="solved-count" aria-label={`${solvedCount} solved`}>
          <span key={solvedCount} className={solvedCount ? 'bump' : ''}>
            {solvedCount}
          </span>
          <small>solved</small>
        </div>
      </header>
      <div className="timebar">
        <i className={running && secondsLeft <= 10 ? 'low' : ''} style={{ transform: `scaleX(${left / total})` }} />
      </div>

      <section className="board-wrap">
        <div className="toast-slot" aria-live="assertive">
          {outcome === 'missed' || outcome === 'skipped' ? (
            <div className="toast answer">
              It was <b>{answer}</b>
            </div>
          ) : outcome === 'solved' ? (
            <div className="toast good">
              {praiseFor(guesses.length)}
              {streak >= 2 && <span className="streak">🔥 {streak} in a row</span>}
            </div>
          ) : nudge ? (
            <div className="toast" key={nudge.id}>
              {nudge.text}
            </div>
          ) : null}
        </div>

        <div className="board" key={boardNumber} aria-label={`Word ${boardNumber}`}>
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
                {Array.from({ length: WORD_LENGTH }, (_, i) => (
                  <div
                    key={i}
                    className={`tile ${marks ? marks[i] : letters[i] ? 'filled' : isDraft ? 'open' : ''}`}
                    style={{ '--i': i } as React.CSSProperties}
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
          Word <b>{boardNumber}</b>
          {streak >= 2 && !outcome && <em> · 🔥 {streak}</em>}
        </span>
        <button className="skip" onClick={skip} disabled={!running || !!outcome}>
          Skip
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
                  aria-label={key === 'back' ? 'Backspace' : key}
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
