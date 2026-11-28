import { describe, expect, it } from 'vitest';
import {
  TOWER_LENGTHS,
  compareScores,
  dailyNumber,
  decodeChallenge,
  encodeChallenge,
  lengthFor,
  letterMarks,
  livesLeft,
  nextWord,
  scoreGuess,
  shareText,
  streakOf,
  wordsForSeed,
} from './game';
import { ALLOWED } from './words/allowed';
import { ANSWERS } from './words/answers';

const board = (word: string, solved: boolean, guesses = 3) => ({ word, solved, guesses });

describe('scoreGuess', () => {
  it('marks hits, nears and misses', () => {
    expect(scoreGuess('crane', 'crane')).toEqual(['hit', 'hit', 'hit', 'hit', 'hit']);
    expect(scoreGuess('nacre', 'crane')).toEqual(['near', 'near', 'near', 'near', 'hit']);
    expect(scoreGuess('fuzzy', 'crane')).toEqual(['miss', 'miss', 'miss', 'miss', 'miss']);
  });

  it('only credits a repeated letter as often as the answer has it', () => {
    expect(scoreGuess('geese', 'elder')).toEqual(['miss', 'near', 'near', 'miss', 'miss']);
    expect(scoreGuess('sassy', 'glass')).toEqual(['near', 'near', 'miss', 'hit', 'miss']);
    expect(scoreGuess('llama', 'alley')).toEqual(['near', 'hit', 'near', 'miss', 'miss']);
  });

  it('works for any length', () => {
    expect(scoreGuess('tac', 'cat')).toEqual(['near', 'hit', 'near']);
    expect(scoreGuess('notebook', 'textbook')).toEqual(['miss', 'miss', 'near', 'near', 'hit', 'hit', 'hit', 'hit']);
  });
});

describe('letterMarks', () => {
  it('keeps the best mark for each letter', () => {
    expect(letterMarks(['nacre', 'crane'], 'crane').get('c')).toBe('hit');
    expect(letterMarks(['fuzzy'], 'crane').get('z')).toBe('miss');
  });
});

describe('words', () => {
  it('has answers at every tower length, all of which players can type', () => {
    for (const n of TOWER_LENGTHS) {
      expect(ANSWERS[n].length).toBeGreaterThan(200);
      for (const word of ANSWERS[n]) {
        expect(word).toMatch(new RegExp(`^[a-z]{${n}}$`));
        expect(ALLOWED[n].has(word)).toBe(true);
      }
    }
  });

  it('gives the same order for the same seed and a different one otherwise', () => {
    expect(wordsForSeed('abc123')).toEqual(wordsForSeed('abc123'));
    expect(wordsForSeed('abc123').slice(0, 10)).not.toEqual(wordsForSeed('abc124').slice(0, 10));
    expect([...wordsForSeed('abc123', 7)].sort()).toEqual([...ANSWERS[7]].sort());
  });
});

describe('tower', () => {
  it('climbs 3 → 8 letters, then starts over', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((n) => lengthFor('tower', n))).toEqual([3, 4, 5, 6, 7, 8, 3]);
    expect(lengthFor('race', 4)).toBe(5);
  });

  it('stays on the same length after a miss, with a fresh word', () => {
    const first = nextWord('tower', 's1', []);
    expect(first).toHaveLength(3);
    const afterMiss = nextWord('tower', 's1', [board(first, false)]);
    expect(afterMiss).toHaveLength(3);
    expect(afterMiss).not.toBe(first);
    expect(nextWord('tower', 's1', [board(first, true)])).toHaveLength(4);
  });

  it('counts lives', () => {
    expect(livesLeft([board('cat', true), board('dog', false)], 3)).toBe(2);
  });
});

describe('daily', () => {
  it('numbers days from launch in local time', () => {
    expect(dailyNumber(new Date(2026, 10, 16, 0, 5))).toBe(1);
    expect(dailyNumber(new Date(2026, 10, 16, 23, 55))).toBe(1);
    expect(dailyNumber(new Date(2026, 10, 26, 12))).toBe(11);
    expect(dailyNumber(new Date(2027, 2, 30, 12))).toBe(135);
  });
});

describe('streaks and sharing', () => {
  it('counts the run of solves at the end', () => {
    expect(streakOf([])).toBe(0);
    expect(streakOf([board('a', true), board('b', false), board('c', true), board('d', true)])).toBe(2);
  });

  it('shares a race as one square per word', () => {
    const text = shareText({ kind: 'race', seed: 'day3', minutes: 3, daily: 3, boards: [board('crane', true), board('moist', false)] });
    expect(text).toContain('Word Race Daily #3');
    expect(text).toContain('I solved 1 word in 3 minutes!');
    expect(text).toContain('🟩⬛');
  });

  it('shares a tower as stacked bricks, top floor first', () => {
    const text = shareText({
      kind: 'tower',
      seed: 'tower3',
      minutes: null,
      daily: 3,
      boards: [board('cat', true), board('dove', false), board('word', true)],
    });
    expect(text).toContain('Word Tower Daily #3');
    expect(text).toContain('I built 2 floors today!');
    expect(text.indexOf('🟨🟨🟨🟨')).toBeLessThan(text.indexOf('🟩🟩🟩'));
  });
});

describe('challenges', () => {
  it('round-trips through a link', () => {
    const race = { kind: 'race' as const, seed: 'k3x9aa', minutes: 3 as const, solved: 7, guesses: 29, name: 'Sam & Jo' };
    expect(decodeChallenge('#' + encodeChallenge(race))).toEqual(race);
    const tower = { ...race, kind: 'tower' as const, minutes: 5 as const };
    expect(decodeChallenge('#' + encodeChallenge(tower))).toEqual(tower);
  });

  it('rejects junk', () => {
    expect(decodeChallenge('')).toBeNull();
    expect(decodeChallenge('#c=abc&m=4&s=1&g=3')).toBeNull();
    expect(decodeChallenge('#c=abc&m=3&s=-1&g=3')).toBeNull();
    expect(decodeChallenge('#c=<b>&m=3&s=1&g=3')).toBeNull();
  });

  it('ranks by solves, then by fewer guesses', () => {
    expect(compareScores({ solved: 5, guesses: 30 }, { solved: 4, guesses: 10 })).toBeGreaterThan(0);
    expect(compareScores({ solved: 5, guesses: 20 }, { solved: 5, guesses: 24 })).toBeGreaterThan(0);
    expect(compareScores({ solved: 5, guesses: 20 }, { solved: 5, guesses: 20 })).toBe(0);
  });
});
