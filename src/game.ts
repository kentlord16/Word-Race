import { ANSWERS } from './words/answers';

export const MAX_GUESSES = 6;
export const MODES = [3, 5] as const;
export type Minutes = (typeof MODES)[number];

/** Tower climbs through these lengths, then starts over at the bottom, one level up. */
export const TOWER_LENGTHS = [3, 4, 5, 6, 7, 8] as const;
export const RACE_LENGTH = 5;
export const DAILY_TOWER_LIVES = 3;

export type Kind = 'tower' | 'race';
export const KINDS: Kind[] = ['tower', 'race'];

/** Word length for the next board, given how many have been solved so far. */
export const lengthFor = (kind: Kind, solved: number) =>
  kind === 'race' ? RACE_LENGTH : TOWER_LENGTHS[solved % TOWER_LENGTHS.length];

/** hit = right letter, right spot · near = right letter, wrong spot · miss = not in the word */
export type Mark = 'hit' | 'near' | 'miss';

export function scoreGuess(guess: string, answer: string): Mark[] {
  const marks: Mark[] = Array(answer.length).fill('miss');
  const spare = new Map<string, number>();
  for (let i = 0; i < answer.length; i++) {
    if (guess[i] === answer[i]) marks[i] = 'hit';
    else spare.set(answer[i], (spare.get(answer[i]) ?? 0) + 1);
  }
  for (let i = 0; i < answer.length; i++) {
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

const orders = new Map<string, string[]>();

/** Every answer of one length, shuffled by the seed. */
export function wordsForSeed(seed: string, length = RACE_LENGTH): string[] {
  const key = `${seed}/${length}`;
  let words = orders.get(key);
  if (!words) {
    const random = mulberry32(hashSeed(length === RACE_LENGTH ? seed : key));
    words = [...ANSWERS[length]];
    for (let i = words.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [words[i], words[j]] = [words[j], words[i]];
    }
    orders.set(key, words);
  }
  return words;
}

export function newSeed(): string {
  return Math.random().toString(36).slice(2, 8).padEnd(6, '0');
}

// --- Boards, results, scores ---

export interface Board {
  word: string;
  solved: boolean;
  guesses: number;
}

/** The word the next board asks for: the next unused word of the right length. */
export function nextWord(kind: Kind, seed: string, boards: Board[]): string {
  const length = lengthFor(kind, boards.filter((b) => b.solved).length);
  const used = boards.filter((b) => b.word.length === length).length;
  const words = wordsForSeed(seed, length);
  return words[used % words.length];
}

export interface Result {
  kind: Kind;
  seed: string;
  /** null for the untimed daily tower. */
  minutes: Minutes | null;
  boards: Board[];
  /** Set when this was a daily game. */
  daily?: number;
  /** The word on screen when the clock ran out, unsolved. */
  unfinished?: string;
}

export interface Score {
  solved: number;
  /** Guesses spent on solved boards; fewer breaks a tie. */
  guesses: number;
}

export function scoreOf(result: { boards: Board[] }): Score {
  const solved = result.boards.filter((b) => b.solved);
  return { solved: solved.length, guesses: solved.reduce((n, b) => n + b.guesses, 0) };
}

/** Positive when `a` is the better score. */
export function compareScores(a: Score, b: Score): number {
  return a.solved - b.solved || b.guesses - a.guesses;
}

/** Consecutive solves at the end of the list. */
export function streakOf(boards: Board[]): number {
  let n = 0;
  for (let i = boards.length - 1; i >= 0 && boards[i].solved; i--) n++;
  return n;
}

export const livesLeft = (boards: Board[], lives: number) => lives - boards.filter((b) => !b.solved).length;

// --- Daily games: one shared word order per calendar day. ---

const FIRST_DAY = Date.UTC(2026, 10, 16);

/** Daily number for a local calendar date; #1 is 16 Nov 2026. */
export function dailyNumber(date = new Date()): number {
  const day = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((day - FIRST_DAY) / 86_400_000) + 1;
}

export const dailySeed = (kind: Kind, n: number) => (kind === 'race' ? `day${n}` : `tower${n}`);
export const DAILY_RACE_MINUTES: Minutes = 3;

// --- Challenges ---

export interface Challenge extends Score {
  kind: Kind;
  seed: string;
  minutes: Minutes;
  name: string;
}

export function encodeChallenge(c: Challenge): string {
  const params = new URLSearchParams({ c: c.seed, m: String(c.minutes), s: String(c.solved), g: String(c.guesses) });
  if (c.kind === 'tower') params.set('t', 'tower');
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
  return {
    kind: params.get('t') === 'tower' ? 'tower' : 'race',
    seed,
    minutes: minutes as Minutes,
    solved,
    guesses,
    name: (params.get('n') ?? '').trim().slice(0, 16),
  };
}

// --- Words for people ---

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
export const unit = (kind: Kind, n: number) => plural(n, kind === 'tower' ? 'floor' : 'word');

const PRAISE = ['', 'Unreal!', 'Genius!', 'Brilliant!', 'Great!', 'Nice!', 'Phew!'];
export const praiseFor = (guesses: number) => PRAISE[guesses] ?? 'Solved!';

const BRICKS = ['🟩', '🟨', '🟧', '🟥', '🟪', '🟦'];

export function shareText(result: Result): string {
  const { solved } = scoreOf(result);
  const when = result.minutes ? `in ${result.minutes} minutes` : 'today';
  if (result.kind === 'tower') {
    const title = result.daily ? `Word Tower Daily #${result.daily}` : 'Word Tower';
    // The tower itself, top floor first: one brick per letter.
    const floors = result.boards.filter((b) => b.solved);
    const art = floors.map((b, i) => BRICKS[i % BRICKS.length].repeat(b.word.length)).slice(-8).reverse();
    if (floors.length > art.length) art.push('⋮');
    return [`🏗️ ${title}`, `I built ${unit('tower', solved)} ${when}!`, ...art, 'Can you build higher?'].join('\n');
  }
  const title = result.daily ? `Word Race Daily #${result.daily}` : 'Word Race';
  const shown = result.boards.slice(0, 24);
  const bar = shown.map((b) => (b.solved ? '🟩' : '⬛')).join('') + (result.boards.length > shown.length ? '…' : '');
  return [`⚡ ${title}`, `I solved ${unit('race', solved)} ${when}!`, ...(bar ? [bar] : []), 'Same words, same clock. Beat me:'].join(
    '\n',
  );
}
