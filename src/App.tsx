import { useEffect, useMemo, useRef, useState } from 'react';
import {
  type Challenge,
  DAILY_MINUTES,
  MODES,
  type Minutes,
  type Result,
  type Score,
  compareScores,
  dailyNumber,
  dailySeed,
  decodeChallenge,
  encodeChallenge,
  newSeed,
  plural,
  scoreOf,
  shareText,
} from './game';
import { Play } from './Play';
import { setSoundEnabled, sfx } from './sound';
import { type Saved, load, save } from './store';

type Screen =
  | { name: 'home' }
  | { name: 'play'; seed: string; minutes: Minutes; challenge: Challenge | null; daily?: number }
  | { name: 'done'; result: Result; challenge: Challenge | null; newBest: boolean; best?: Score };

export function App() {
  const [saved, setSaved] = useState(load);
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [challenge, setChallenge] = useState(() => decodeChallenge(location.hash));

  useEffect(() => {
    save(saved);
    setSoundEnabled(saved.sound);
  }, [saved]);

  // A challenge link opened while the app is already on screen.
  useEffect(() => {
    const onHash = () => setChallenge(decodeChallenge(location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const update = (patch: Partial<Saved>) => setSaved((s) => ({ ...s, ...patch }));

  function dropChallenge() {
    setChallenge(null);
    history.replaceState(null, '', location.pathname + location.search);
  }

  function start(minutes: Minutes, from: Challenge | null) {
    if (challenge) dropChallenge();
    setScreen({ name: 'play', seed: from?.seed ?? newSeed(), minutes, challenge: from });
  }

  function startDaily() {
    const day = dailyNumber();
    setScreen({ name: 'play', seed: dailySeed(day), minutes: DAILY_MINUTES, challenge: null, daily: day });
  }

  function finish(result: Result, from: Challenge | null) {
    const score = scoreOf(result);
    const best = saved.best[result.minutes];
    const newBest = score.solved > 0 && (!best || compareScores(score, best) > 0);
    update({
      races: saved.races + 1,
      words: saved.words + score.solved,
      ...(newBest && { best: { ...saved.best, [result.minutes]: score } }),
      ...(result.daily && { daily: { day: result.daily, solved: score.solved } }),
    });
    sfx.finish();
    setScreen({ name: 'done', result, challenge: from, newBest, best });
  }

  if (screen.name === 'play') {
    return (
      <Play
        key={screen.seed}
        seed={screen.seed}
        minutes={screen.minutes}
        onDone={(result) => finish({ ...result, daily: screen.daily }, screen.challenge)}
        onQuit={() => setScreen({ name: 'home' })}
      />
    );
  }
  if (screen.name === 'done') {
    return (
      <Done
        {...screen}
        name={saved.name}
        onAgain={() => start(screen.result.minutes, null)}
        onHome={() => setScreen({ name: 'home' })}
      />
    );
  }
  return (
    <Home
      saved={saved}
      update={update}
      challenge={challenge}
      onDecline={dropChallenge}
      onStart={start}
      onDaily={startDaily}
    />
  );
}

function Logo() {
  return (
    <h1 className="logo" aria-label="Word Race">
      <span className="logo-tiles" aria-hidden="true">
        {[...'WORD'].map((letter, i) => (
          <b key={letter} style={{ '--i': i } as React.CSSProperties}>
            {letter}
          </b>
        ))}
      </span>
      <span className="logo-race" aria-hidden="true">
        RACE
      </span>
    </h1>
  );
}

interface HomeProps {
  saved: Saved;
  update: (patch: Partial<Saved>) => void;
  challenge: Challenge | null;
  onDecline: () => void;
  onStart: (minutes: Minutes, from: Challenge | null) => void;
  onDaily: () => void;
}

function Home({ saved, update, challenge, onDecline, onStart, onDaily }: HomeProps) {
  const [showHow, setShowHow] = useState(saved.races === 0);
  const day = dailyNumber();
  const dailyDone = saved.daily?.day === day ? saved.daily : null;

  // Enter starts a race from the keyboard.
  const startRef = useRef<() => void>(() => {});
  startRef.current = () => (challenge ? onStart(challenge.minutes, challenge) : onStart(saved.minutes, null));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement;
      if (e.key === 'Enter' && !typing) startRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <main className="screen home">
      <button
        className="icon-btn sound"
        onClick={() => update({ sound: !saved.sound })}
        aria-label={saved.sound ? 'Turn sound off' : 'Turn sound on'}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" />
          {saved.sound ? <path d="M15.5 9a4 4 0 010 6M18 6.5a8 8 0 010 11" /> : <path d="M16 9.5l5 5M21 9.5l-5 5" />}
        </svg>
      </button>

      <Logo />
      <p className="tagline">How many words can you crack before the clock runs out?</p>

      {challenge ? (
        <section className="card challenge">
          <p className="eyebrow">You've been challenged</p>
          <p className="card-big">
            {challenge.name || 'A friend'} solved <b>{plural(challenge.solved, 'word')}</b> in {challenge.minutes} minutes
          </p>
          <p className="muted">Same words. Same clock. Your move.</p>
          <button className="btn primary" onClick={() => onStart(challenge.minutes, challenge)}>
            Accept the race
          </button>
          <button className="btn link" onClick={onDecline}>
            Not now
          </button>
        </section>
      ) : (
        <>
          <div className="modes" role="radiogroup" aria-label="Race length">
            {MODES.map((m) => (
              <button
                key={m}
                role="radio"
                aria-checked={saved.minutes === m}
                className={`mode${saved.minutes === m ? ' on' : ''}`}
                onClick={() => update({ minutes: m })}
              >
                <strong>{m} min</strong>
                <small>{saved.best[m] ? `Best ${saved.best[m].solved}` : m === 3 ? 'Sprint' : 'Marathon'}</small>
              </button>
            ))}
          </div>
          <button className="btn primary big" onClick={() => onStart(saved.minutes, null)}>
            Start race
          </button>
          <button className="daily" onClick={onDaily} disabled={!!dailyDone}>
            <span className="daily-icon" aria-hidden="true">
              <small>Daily</small>#{day}
            </span>
            <span className="daily-text">
              <strong>{dailyDone ? `Today: ${plural(dailyDone.solved, 'word')}` : "Today's race"}</strong>
              <small>{dailyDone ? 'New words tomorrow' : `Same words for everyone · ${DAILY_MINUTES} min`}</small>
            </span>
            {dailyDone ? (
              <span className="daily-check" aria-hidden="true">
                ✓
              </span>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 6l6 6-6 6" />
              </svg>
            )}
          </button>
        </>
      )}

      {saved.races > 0 && (
        <p className="stats">
          <span>
            <b>{saved.races}</b> {saved.races === 1 ? 'race' : 'races'}
          </span>
          <span>
            <b>{saved.words}</b> {saved.words === 1 ? 'word' : 'words'} solved
          </span>
          <button className="how-toggle" onClick={() => setShowHow(!showHow)} aria-expanded={showHow}>
            How to play
          </button>
        </p>
      )}

      {showHow && (
        <section className="card how">
          <ul>
            <li>
              <i className="tile hit">A</i> Right letter, right spot
            </li>
            <li>
              <i className="tile near">B</i> Right letter, wrong spot
            </li>
            <li>
              <i className="tile miss">C</i> Not in the word
            </li>
          </ul>
          <p className="muted">
            Six guesses a word. Solve it and the next one drops straight in. Stuck? Skip it — the clock won't wait.
          </p>
        </section>
      )}

      <label className="name-field">
        <span>Your name on challenges</span>
        <input
          value={saved.name}
          onChange={(e) => update({ name: e.target.value.slice(0, 16) })}
          placeholder="Optional"
          maxLength={16}
          autoComplete="nickname"
          enterKeyHint="done"
        />
      </label>
    </main>
  );
}

interface DoneProps {
  result: Result;
  challenge: Challenge | null;
  newBest: boolean;
  best?: Score;
  name: string;
  onAgain: () => void;
  onHome: () => void;
}

function Done({ result, challenge, newBest, best, name, onAgain, onHome }: DoneProps) {
  const score = scoreOf(result);
  const shown = useCountUp(score.solved);
  const [shared, setShared] = useState<'copied' | 'failed' | null>(null);

  const versus = challenge ? compareScores(score, challenge) : 0;
  const rival = challenge?.name || 'your friend';
  const headline = !challenge
    ? score.solved === 0
      ? 'Tough round'
      : newBest
        ? 'New best!'
        : "Time's up!"
    : versus > 0
      ? `You beat ${rival}!`
      : versus < 0
        ? `${rival} takes it`
        : 'Dead heat!';

  // Enter races again from the keyboard — but not in the first moments, when a
  // player still typing as the clock hit zero would skip straight past their score.
  const againRef = useRef(onAgain);
  againRef.current = onAgain;
  useEffect(() => {
    const readyAt = Date.now() + 1500;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && Date.now() > readyAt && !(e.target instanceof HTMLButtonElement)) againRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function share() {
    const url = `${location.origin}${location.pathname}#${encodeChallenge({ seed: result.seed, minutes: result.minutes, name: name.trim(), ...score })}`;
    const text = shareText(result);
    try {
      if (navigator.share) return await navigator.share({ title: 'Word Race', text, url });
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setShared('copied');
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setShared('failed');
    }
  }

  return (
    <main className="screen done">
      {score.solved > 0 && versus >= 0 && <Confetti />}
      <p className="eyebrow">{headline}</p>
      <div className="big-score">{shown}</div>
      <p className="score-line">
        {score.solved === 1 ? 'word' : 'words'} in {result.minutes} minutes
      </p>
      {result.daily && <p className="daily-tag">Daily race #{result.daily}</p>}

      {challenge && (
        <div className="versus">
          <div className={versus >= 0 ? 'lead' : ''}>
            <small>You</small>
            <b>{score.solved}</b>
          </div>
          <span>vs</span>
          <div className={versus <= 0 ? 'lead' : ''}>
            <small>{rival}</small>
            <b>{challenge.solved}</b>
          </div>
        </div>
      )}
      {challenge && versus !== 0 && score.solved === challenge.solved && (
        <p className="muted">Level on words, decided on fewest guesses.</p>
      )}

      {score.solved > 0 && (
        <p className="muted">
          {(score.guesses / score.solved).toFixed(1)} guesses per solve
          {newBest && challenge ? ' · new personal best' : ''}
          {!newBest && best ? ` · your best is ${best.solved}` : ''}
        </p>
      )}

      <div className="actions">
        <button className="btn primary big" onClick={share}>
          {shared === 'copied' ? 'Copied — paste it anywhere' : challenge ? 'Send your score back' : 'Challenge a friend'}
        </button>
        {shared === 'failed' && <p className="muted">Couldn't share from this browser.</p>}
        <button className="btn secondary" onClick={onAgain}>
          Race again
        </button>
        <button className="btn link" onClick={onHome}>
          Home
        </button>
      </div>

      {result.boards.length > 0 && (
        <section className="recap" aria-label="Your words">
          {result.boards.map((b) => (
            <span key={b.word} className={b.solved ? 'got' : ''}>
              {b.word}
              {b.solved && <small>{b.guesses}</small>}
            </span>
          ))}
        </section>
      )}
    </main>
  );
}

function useCountUp(target: number) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (n >= target) return;
    const t = setTimeout(() => setN(n + 1), Math.max(40, 700 / target));
    return () => clearTimeout(t);
  }, [n, target]);
  return n;
}

const CONFETTI = ['#2be0ae', '#ffab2e', '#ff5fa2', '#ffd84d', '#ffffff', '#7fd4ff'];

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 44 }, (_, i) => ({
        left: `${Math.random() * 100}%`,
        background: CONFETTI[i % CONFETTI.length],
        animationDelay: `${Math.random() * 0.6}s`,
        animationDuration: `${2.2 + Math.random() * 1.6}s`,
        '--spin': `${Math.random() * 720 - 360}deg`,
        '--drift': `${Math.random() * 120 - 60}px`,
      })),
    [],
  );
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((style, i) => (
        <i key={i} style={style as React.CSSProperties} />
      ))}
    </div>
  );
}
