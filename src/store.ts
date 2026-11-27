import type { Minutes, Score } from './game';

export interface Saved {
  name: string;
  sound: boolean;
  minutes: Minutes;
  best: Partial<Record<Minutes, Score>>;
  /** Lifetime totals. */
  races: number;
  words: number;
  /** The last daily race played, so it can only be raced once. */
  daily: { day: number; solved: number } | null;
}

const KEY = 'word-race';
const DEFAULTS: Saved = { name: '', sound: true, minutes: 3, best: {}, races: 0, words: 0, daily: null };

export function load(): Saved {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return DEFAULTS;
  }
}

export function save(saved: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(saved));
  } catch {
    // Private mode or full storage: play on without saving.
  }
}
