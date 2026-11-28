import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { dictionaryReady } from './dictionary';
import {
  type Board,
  type Challenge,
  DAILY_RACE_MINUTES,
  DAILY_TOWER_LIVES,
  KINDS,
  type Kind,
  MODES,
  type Minutes,
  type Result,
  type Score,
  compareScores,
  dailyNumber,
  dailySeed,
  decodeChallenge,
  encodeChallenge,
  livesLeft,
  newSeed,
  scoreOf,
  shareText,
  unit,
} from './game';
import { Play, type Progress } from './Play';
import { setSoundEnabled, sfx } from './sound';
import { type Saved, bestKey, load, save } from './store';

void dictionaryReady;

type Screen =
  | { name: 'home' }
  | { name: 'play'; kind: Kind; seed: string; minutes: Minutes | null; challenge: Challenge | null; daily?: number }
  | { name: 'done'; result: Result; challenge: Challenge | null; newBest: boolean; best?: Score };

const KIND_INFO: Record<Kind, { title: string; icon: string; blurb: string }> = {
  tower: { title: 'Tower', icon: '🏗️', blurb: '3 to 8 letters. Every word is a floor.' },
  race: { title: 'Race', icon: '⚡', blurb: 'Five-letter words, as many as you can crack.' },
};

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
  const today = dailyNumber();

  function dropChallenge() {
    setChallenge(null);
    history.replaceState(null, '', location.pathname + location.search);
  }

  function start(kind: Kind, minutes: Minutes, from: Challenge | null = null) {
    if (challenge) dropChallenge();
    setScreen({ name: 'play', kind, seed: from?.seed ?? newSeed(), minutes, challenge: from });
  }

  function startDaily(kind: Kind) {
    setScreen({
      name: 'play',
      kind,
      seed: dailySeed(kind, today),
      minutes: kind === 'race' ? DAILY_RACE_MINUTES : null,
      challenge: null,
      daily: today,
    });
  }

  function finish(result: Result, from: Challenge | null) {
    const score = scoreOf(result);
    const key = result.minutes && !result.daily ? bestKey(result.kind, result.minutes) : null;
    const best = key ? saved.best[key] : undefined;
    const newBest = !!key && score.solved > 0 && (!best || compareScores(score, best) > 0);
    setSaved((s) => ({
      ...s,
      games: s.games + 1,
      solved: s.solved + score.solved,
      ...(newBest && key && { best: { ...s.best, [key]: score } }),
      ...(result.daily && result.kind === 'race' && { dailyRace: { day: result.daily, solved: score.solved } }),
      ...(result.daily &&
        result.kind === 'tower' && { dailyTower: { day: result.daily, boards: result.boards, guesses: [], done: true } }),
    }));
    sfx.finish();
    setScreen({ name: 'done', result, challenge: from, newBest, best });
  }

  if (screen.name === 'play') {
    const dailyTower = !!screen.daily && screen.kind === 'tower';
    const resume = dailyTower && saved.dailyTower?.day === screen.daily ? saved.dailyTower : null;
    return (
      <Play
        key={screen.seed}
        kind={screen.kind}
        seed={screen.seed}
        minutes={screen.minutes}
        lives={dailyTower ? DAILY_TOWER_LIVES : undefined}
        resume={resume ?? undefined}
        onSave={
          dailyTower
            ? (p: Progress) => update({ dailyTower: { day: screen.daily!, ...p, done: false } })
            : undefined
        }
        onDone={(result) => finish({ ...result, daily: screen.daily }, screen.challenge)}
        onQuit={() => setScreen({ name: 'home' })}
      />
    );
  }

  if (screen.name === 'done') {
    const { result } = screen;
    // After a daily, "again" offers the timed version of the same game.
    const againMinutes = result.minutes && !result.daily ? result.minutes : saved.minutes;
    return (
      <Done
        {...screen}
        name={saved.name}
        onName={(name) => update({ name })}
        againLabel={result.daily ? `Play a ${againMinutes}-min ${KIND_INFO[result.kind].title.toLowerCase()}` : 'Play again'}
        onAgain={() => start(result.kind, againMinutes)}
        onHome={() => setScreen({ name: 'home' })}
      />
    );
  }

  return (
    <Home
      saved={saved}
      today={today}
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
          <b key={letter} style={{ '--i': i } as CSSProperties}>
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

function Hearts({ left, of }: { left: number; of: number }) {
  return (
    <span className="mini-hearts" aria-label={`${left} of ${of} hearts left`}>
      {Array.from({ length: of }, (_, i) => (
        <i key={i} className={i < left ? 'full' : ''} aria-hidden="true">
          ♥
        </i>
      ))}
    </span>
  );
}

interface HomeProps {
  saved: Saved;
  today: number;
  update: (patch: Partial<Saved>) => void;
  challenge: Challenge | null;
  onDecline: () => void;
  onStart: (kind: Kind, minutes: Minutes, from?: Challenge | null) => void;
  onDaily: (kind: Kind) => void;
}

function Home({ saved, today, update, challenge, onDecline, onStart, onDaily }: HomeProps) {
  const [showHow, setShowHow] = useState(saved.games === 0);
  const { kind, minutes } = saved;

  const race = saved.dailyRace?.day === today ? saved.dailyRace : null;
  const tower = saved.dailyTower?.day === today ? saved.dailyTower : null;
  const towerFloors = tower ? scoreOf(tower).solved : 0;
  const towerHearts = tower ? livesLeft(tower.boards, DAILY_TOWER_LIVES) : DAILY_TOWER_LIVES;

  // Enter starts from the keyboard.
  const startRef = useRef<() => void>(() => {});
  startRef.current = () => (challenge ? onStart(challenge.kind, challenge.minutes, challenge) : onStart(kind, minutes));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const busy = e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement;
      if (e.key === 'Enter' && !busy) startRef.current();
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

      {challenge ? (
        <section className="card challenge">
          <p className="eyebrow">
            {KIND_INFO[challenge.kind].icon} You've been challenged
          </p>
          <p className="card-big">
            {challenge.name || 'A friend'} {challenge.kind === 'tower' ? 'built' : 'solved'}{' '}
            <b>{unit(challenge.kind, challenge.solved)}</b> in {challenge.minutes} minutes
          </p>
          <p className="muted">Same words. Same clock. Your move.</p>
          <button className="btn primary" onClick={() => onStart(challenge.kind, challenge.minutes, challenge)}>
            Accept the challenge
          </button>
          <button className="btn link" onClick={onDecline}>
            Not now
          </button>
        </section>
      ) : (
        <section className="play-panel">
          <div className="kinds" role="tablist" aria-label="Game">
            {KINDS.map((k) => (
              <button
                key={k}
                role="tab"
                aria-selected={kind === k}
                className={`kind${kind === k ? ' on' : ''}`}
                onClick={() => update({ kind: k })}
              >
                <span aria-hidden="true">{KIND_INFO[k].icon}</span> {KIND_INFO[k].title}
              </button>
            ))}
          </div>
          <p className="blurb">{KIND_INFO[kind].blurb}</p>
          <div className="modes" role="radiogroup" aria-label="Length">
            {MODES.map((m) => {
              const best = saved.best[bestKey(kind, m)];
              return (
                <button
                  key={m}
                  role="radio"
                  aria-checked={minutes === m}
                  className={`mode${minutes === m ? ' on' : ''}`}
                  onClick={() => update({ minutes: m })}
                >
                  <strong>{m} min</strong>
                  <small>{best ? `Best ${best.solved}` : m === 3 ? 'Sprint' : 'Marathon'}</small>
                </button>
              );
            })}
          </div>
          <button className="btn primary big" onClick={() => onStart(kind, minutes)}>
            Start {KIND_INFO[kind].title.toLowerCase()}
          </button>
        </section>
      )}

      <section className="dailies" aria-label="Daily games">
        <h2>Daily · #{today}</h2>
        <button className="daily tower" onClick={() => onDaily('tower')} disabled={!!tower?.done}>
          <span className="daily-icon" aria-hidden="true">
            🏗️
          </span>
          <span className="daily-text">
            <strong>
              {tower?.done ? `Built ${unit('tower', towerFloors)}` : tower ? `Floor ${towerFloors + 1}` : 'Daily tower'}
            </strong>
            <small>
              {tower?.done ? (
                'New tower tomorrow'
              ) : tower ? (
                <>
                  Tap to keep building · <Hearts left={towerHearts} of={DAILY_TOWER_LIVES} />
                </>
              ) : (
                'No clock · build all day · 3 hearts'
              )}
            </small>
          </span>
          <DailyEnd done={!!tower?.done} />
        </button>
        <button className="daily race" onClick={() => onDaily('race')} disabled={!!race}>
          <span className="daily-icon" aria-hidden="true">
            ⚡
          </span>
          <span className="daily-text">
            <strong>{race ? `Raced: ${unit('race', race.solved)}` : 'Daily race'}</strong>
            <small>{race ? 'New race tomorrow' : `Same words for everyone · ${DAILY_RACE_MINUTES} min`}</small>
          </span>
          <DailyEnd done={!!race} />
        </button>
      </section>

      <p className="stats">
        {saved.games > 0 && (
          <>
            <span>
              <b>{saved.games}</b> {saved.games === 1 ? 'game' : 'games'}
            </span>
            <span>
              <b>{saved.solved}</b> words cracked
            </span>
          </>
        )}
        <button className="how-toggle" onClick={() => setShowHow(!showHow)} aria-expanded={showHow}>
          {showHow ? 'Hide how to play' : 'How to play'}
        </button>
      </p>

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
            Six guesses a word. <b>Tower</b>: words grow from 3 to 8 letters, then start over a level up. <b>Race</b>:
            five letters, every time. Stuck? Skip — the clock won't wait.
          </p>
        </section>
      )}
    </main>
  );
}

function DailyEnd({ done }: { done: boolean }) {
  return done ? (
    <span className="daily-check" aria-label="Done for today">
      ✓
    </span>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

interface DoneProps {
  result: Result;
  challenge: Challenge | null;
  newBest: boolean;
  best?: Score;
  name: string;
  onName: (name: string) => void;
  againLabel: string;
  onAgain: () => void;
  onHome: () => void;
}

function Done({ result, challenge, newBest, best, name, onName, againLabel, onAgain, onHome }: DoneProps) {
  const score = scoreOf(result);
  const shown = useCountUp(score.solved);
  const [shared, setShared] = useState<'copied' | 'failed' | null>(null);
  const tower = result.kind === 'tower';
  // Untimed daily towers have no clock to match, so they share the game itself.
  const challengeable = result.minutes !== null;

  const versus = challenge ? compareScores(score, challenge) : 0;
  const rival = challenge?.name || 'your friend';
  const headline = challenge
    ? versus > 0
      ? `You beat ${rival}!`
      : versus < 0
        ? `${rival} takes it`
        : 'Dead heat!'
    : score.solved === 0
      ? 'Tough one'
      : newBest
        ? 'New best!'
        : result.minutes
          ? "Time's up!"
          : 'Tower complete!';

  // Enter plays again — but not in the first moments, when a player still
  // typing as the clock hit zero would skip straight past their score.
  const againRef = useRef(onAgain);
  againRef.current = onAgain;
  useEffect(() => {
    const readyAt = Date.now() + 1500;
    const onKey = (e: KeyboardEvent) => {
      const busy = e.target instanceof HTMLButtonElement || e.target instanceof HTMLInputElement;
      if (e.key === 'Enter' && Date.now() > readyAt && !busy) againRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function share() {
    const base = `${location.origin}${location.pathname}`;
    const url = challengeable
      ? `${base}#${encodeChallenge({ kind: result.kind, seed: result.seed, minutes: result.minutes!, name: name.trim(), ...score })}`
      : base;
    const text = shareText(result);
    try {
      if (navigator.share) return await navigator.share({ title: tower ? 'Word Tower' : 'Word Race', text, url });
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setShared('copied');
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setShared('failed');
    }
  }

  const shareLabel =
    shared === 'copied'
      ? 'Copied — paste it anywhere'
      : challenge
        ? 'Send your score back'
        : challengeable
          ? 'Challenge a friend'
          : 'Share my tower';

  return (
    <main className={`screen done ${result.kind}`}>
      {score.solved > 0 && versus >= 0 && <Confetti />}
      <p className="eyebrow">{headline}</p>
      <div className="big-score">{shown}</div>
      <p className="score-line">
        {tower ? (score.solved === 1 ? 'floor built' : 'floors built') : score.solved === 1 ? 'word' : 'words'}{' '}
        {result.minutes ? `in ${result.minutes} minutes` : 'today'}
      </p>
      {result.daily && (
        <p className="daily-tag">
          Daily {tower ? 'tower' : 'race'} #{result.daily}
        </p>
      )}

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
        <p className="muted">Level on {tower ? 'floors' : 'words'}, decided on fewest guesses.</p>
      )}

      {score.solved > 0 && (
        <p className="muted">
          {(score.guesses / score.solved).toFixed(1)} guesses per word
          {newBest && challenge ? ' · new personal best' : ''}
          {!newBest && best ? ` · your best is ${best.solved}` : ''}
        </p>
      )}

      {tower && score.solved > 0 && <TowerView boards={result.boards} />}
      <GotAway boards={result.boards} unfinished={result.unfinished} />

      <div className="actions">
        {challengeable && (
          <label className="name-field">
            <span>Your name</span>
            <input
              value={name}
              onChange={(e) => onName(e.target.value.slice(0, 16))}
              placeholder="So friends know who to beat"
              maxLength={16}
              autoComplete="nickname"
              enterKeyHint="done"
            />
          </label>
        )}
        <button className="btn primary big" onClick={share}>
          {shareLabel}
        </button>
        {shared === 'failed' && <p className="muted">Couldn't share from this browser.</p>}
        <button className="btn secondary" onClick={onAgain}>
          {againLabel}
        </button>
        <button className="btn link" onClick={onHome}>
          Home
        </button>
      </div>

      {!tower && score.solved > 0 && <Recap boards={result.boards.filter((b) => b.solved)} />}
    </main>
  );
}

const TOWER_COLORS = ['mint', 'sun', 'orange', 'pink', 'violet', 'sky'];

/** The tower you built: one floor per solved word, newest on top. */
function TowerView({ boards }: { boards: Board[] }) {
  const floors = boards.filter((b) => b.solved);
  const shown = floors.slice(-7);
  return (
    <section className="tower-view" aria-label={`Your tower: ${floors.map((b) => b.word).join(', ')}`}>
      {shown
        .map((b, i) => {
          const n = floors.length - shown.length + i;
          return (
            <div key={n} className={`floor ${TOWER_COLORS[n % TOWER_COLORS.length]}`} style={{ '--n': i } as CSSProperties}>
              {[...b.word].map((letter, j) => (
                <i key={j}>{letter}</i>
              ))}
            </div>
          );
        })
        .reverse()}
      {floors.length > shown.length && <p className="more">+ {unit('tower', floors.length - shown.length)} below</p>}
    </section>
  );
}

/** Every word that beat you, so you always find out what it was. */
function GotAway({ boards, unfinished }: { boards: Board[]; unfinished?: string }) {
  const missed = boards.filter((b) => !b.solved);
  const count = missed.length + (unfinished ? 1 : 0);
  if (count === 0) return null;
  return (
    <section className="got-away">
      <h3>{count === 1 ? 'The one that got away' : 'The ones that got away'}</h3>
      <div className="recap">
        {missed.map((b, i) => (
          <span key={i}>{b.word}</span>
        ))}
        {unfinished && (
          <span className="timed-out" title="Time ran out on this one">
            ⏱ {unfinished}
          </span>
        )}
      </div>
    </section>
  );
}

function Recap({ boards }: { boards: Board[] }) {
  return (
    <section className="recap" aria-label="Your words">
      {boards.map((b, i) => (
        <span key={i} className={b.solved ? 'got' : ''}>
          {b.word}
          {b.solved && <small>{b.guesses}</small>}
        </span>
      ))}
    </section>
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
        <i key={i} style={style as CSSProperties} />
      ))}
    </div>
  );
}
