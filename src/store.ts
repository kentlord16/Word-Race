import type { Board, Kind, Minutes, Score } from './game';

export interface DailyTower {
  day: number;
  boards: Board[];
  guesses: string[];
  done: boolean;
}

export interface Saved {
  name: string;
  sound: boolean;
  /** Last picked game and length, so Start does what it did last time. */
  kind: Kind;
  minutes: Minutes;
  /** Best timed score, keyed `${kind}-${minutes}`. */
  best: Record<string, Score>;
  /** Lifetime totals. */
  games: number;
  solved: number;
  /** Today's daily race, so it can only be raced once. */
  dailyRace: { day: number; solved: number } | null;
  /** Today's daily tower, saved after every move. */
  dailyTower: DailyTower | null;
}

export const bestKey = (kind: Kind, minutes: Minutes) => `${kind}-${minutes}`;

const KEY = 'word-race';
const DEFAULTS: Saved = {
  name: '',
  sound: true,
  kind: 'tower',
  minutes: 3,
  best: {},
  games: 0,
  solved: 0,
  dailyRace: null,
  dailyTower: null,
};

export function load(): Saved {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    // Before towers existed, bests were keyed by minutes alone and totals had other names.
    const best: Record<string, Score> = {};
    for (const [k, v] of Object.entries(raw.best ?? {})) best[/^\d+$/.test(k) ? `race-${k}` : k] = v as Score;
    return {
      ...DEFAULTS,
      ...raw,
      best,
      games: raw.games ?? raw.races ?? 0,
      solved: raw.solved ?? raw.words ?? 0,
      dailyRace: raw.dailyRace ?? raw.daily ?? null,
    };
  } catch {
    return DEFAULTS;
  }
}

export function save(saved: Saved) {
  try {
    const { name, sound, kind, minutes, best, games, solved, dailyRace, dailyTower } = saved;
    localStorage.setItem(KEY, JSON.stringify({ name, sound, kind, minutes, best, games, solved, dailyRace, dailyTower }));
  } catch {
    // Private mode or full storage: play on without saving.
  }
}
