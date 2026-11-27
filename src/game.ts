import { ANSWERS } from './words/answers';

export const WORD_LENGTH = 5;
export const MAX_GUESSES = 6;
export const MODES = [3, 5] as const;
export type Minutes = (typeof MODES)[number];

/** hit = right letter, right spot · near = right letter, wrong spot · miss = not in the word */
export type Mark = 'hit' | 'near' | 'miss';

export function scoreGuess(guess: string, answer: string): Mark[] {
  const marks: Mark[] = Array(WORD_LENGTH).fill('miss');
  const spare = new Map<string, number>();
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guess[i] === answer[i]) marks[i] = 'hit';
    else spare.set(answer[i], (spare.get(answer[i]) ?? 0) + 1);
  }
  for (let i = 0; i < WORD_LENGTH; i++) {
    const left = spare.get(guess[i]) ?? 0;
    if (marks[i] !== 'hit' && left > 0) {
      marks[i] = 'near';
      spare.set(guess[i], left - 1);
    }
  }
  return marks;
}

const RANK: Record<Mark, number> = { miss: 0, near: 1, hit: 2 };

/** Best mark seen so far for each letter, for colouring the keyboard. */
export function letterMarks(guesses: string[], answer: string): Map<string, Mark> {
  const best = new Map<string, Mark>();
  for (const guess of guesses) {
    scoreGuess(guess, answer).forEach((mark, i) => {
      const prev = best.get(guess[i]);
      if (!prev || RANK[mark] > RANK[prev]) best.set(guess[i], mark);
    });
  }
  return best;
}

// --- Seeded word order: the same seed gives every player the same words. ---

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return h >>> 0;
}

function mulberry32(a: number): () => number {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function wordsForSeed(seed: string): string[] {
  const random = mulberry32(hashSeed(seed));
  const words = [...ANSWERS];
  for (let i = words.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [words[i], words[j]] = [words[j], words[i]];
  }
  return words;
}

export function newSeed(): string {
  return Math.random().toString(36).slice(2, 8).padEnd(6, '0');
}

// --- Results and challenges ---

export interface Board {
  word: string;
  solved: boolean;
  guesses: number;
}

export interface Result {
  seed: string;
  minutes: Minutes;
  boards: Board[];
  /** Set when this was the daily race. */
  daily?: number;
}

export interface Score {
  solved: number;
  /** Guesses spent on solved boards; fewer breaks a tie. */
  guesses: number;
}

export function scoreOf(result: Result): Score {
  const solved = result.boards.filter((b) => b.solved);
  return { solved: solved.length, guesses: solved.reduce((n, b) => n + b.guesses, 0) };
}

/** Positive when `a` is the better score. */
export function compareScores(a: Score, b: Score): number {
  return a.solved - b.solved || b.guesses - a.guesses;
}

export interface Challenge extends Score {
  seed: string;
  minutes: Minutes;
  name: string;
}

export function encodeChallenge(c: Challenge): string {
  const params = new URLSearchParams({ c: c.seed, m: String(c.minutes), s: String(c.solved), g: String(c.guesses) });
  if (c.name) params.set('n', c.name);
  return params.toString();
}

export function decodeChallenge(hash: string): Challenge | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const seed = params.get('c') ?? '';
  const minutes = Number(params.get('m'));
  const solved = Number(params.get('s'));
  const guesses = Number(params.get('g'));
  if (!/^[a-z0-9]{1,12}$/.test(seed) || !MODES.includes(minutes as Minutes)) return null;
  if (!Number.isInteger(solved) || solved < 0 || !Number.isInteger(guesses) || guesses < 0) return null;
  return { seed, minutes: minutes as Minutes, solved, guesses, name: (params.get('n') ?? '').trim().slice(0, 16) };
}

// --- Daily race: one shared word order per calendar day. ---

const FIRST_DAY = Date.UTC(2026, 10, 16);

/** Daily race number for a local calendar date; #1 is 16 Nov 2026. */
export function dailyNumber(date = new Date()): number {
  const day = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((day - FIRST_DAY) / 86_400_000) + 1;
}

export const dailySeed = (n: number) => `day${n}`;
export const DAILY_MINUTES: Minutes = 3;

/** Consecutive solves at the end of the list. */
export function streakOf(boards: Board[]): number {
  let n = 0;
  for (let i = boards.length - 1; i >= 0 && boards[i].solved; i--) n++;
  return n;
}

const PRAISE = ['', 'Unreal!', 'Genius!', 'Brilliant!', 'Great!', 'Nice!', 'Phew!'];
export const praiseFor = (guesses: number) => PRAISE[guesses] ?? 'Solved!';

export function shareText(result: Result): string {
  const { solved } = scoreOf(result);
  const title = result.daily ? `Word Race Daily #${result.daily}` : 'Word Race';
  const shown = result.boards.slice(0, 24);
  const bar = shown.map((b) => (b.solved ? '🟩' : '⬛')).join('') + (result.boards.length > shown.length ? '…' : '');
  return [
    `⚡ ${title}`,
    `I solved ${plural(solved, 'word')} in ${result.minutes} minutes!`,
    ...(bar ? [bar] : []),
    'Same words, same clock. Beat me:',
  ].join('\n');
}

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
