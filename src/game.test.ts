import { describe, expect, it } from 'vitest';
import { compareScores, dailyNumber, shareText, streakOf, decodeChallenge, encodeChallenge, letterMarks, scoreGuess, wordsForSeed } from './game';
import { ALLOWED } from './words/allowed';
import { ANSWERS } from './words/answers';

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
});

describe('letterMarks', () => {
  it('keeps the best mark for each letter', () => {
    const marks = letterMarks(['nacre', 'crane'], 'crane');
    expect(marks.get('c')).toBe('hit');
    expect(letterMarks(['fuzzy'], 'crane').get('z')).toBe('miss');
  });
});

describe('words', () => {
  it('every answer is a five-letter word players can also type', () => {
    for (const word of ANSWERS) {
      expect(word).toMatch(/^[a-z]{5}$/);
      expect(ALLOWED.has(word)).toBe(true);
    }
  });

  it('gives the same order for the same seed and a different one otherwise', () => {
    expect(wordsForSeed('abc123')).toEqual(wordsForSeed('abc123'));
    expect(wordsForSeed('abc123').slice(0, 10)).not.toEqual(wordsForSeed('abc124').slice(0, 10));
    expect([...wordsForSeed('abc123')].sort()).toEqual([...ANSWERS].sort());
  });
});

describe('challenges', () => {
  it('round-trips through a link', () => {
    const challenge = { seed: 'k3x9aa', minutes: 3 as const, solved: 7, guesses: 29, name: 'Sam & Jo' };
    expect(decodeChallenge('#' + encodeChallenge(challenge))).toEqual(challenge);
  });

  it('rejects junk', () => {
    expect(decodeChallenge('')).toBeNull();
    expect(decodeChallenge('#c=abc&m=4&s=1&g=3')).toBeNull();
    expect(decodeChallenge('#c=abc&m=3&s=-1&g=3')).toBeNull();
    expect(decodeChallenge('#c=<b>&m=3&s=1&g=3')).toBeNull();
  });

  it('ranks by boards, then by fewer guesses', () => {
    expect(compareScores({ solved: 5, guesses: 30 }, { solved: 4, guesses: 10 })).toBeGreaterThan(0);
    expect(compareScores({ solved: 5, guesses: 20 }, { solved: 5, guesses: 24 })).toBeGreaterThan(0);
    expect(compareScores({ solved: 5, guesses: 20 }, { solved: 5, guesses: 20 })).toBe(0);
  });
});

describe('daily race', () => {
  it('numbers days from launch in local time', () => {
    expect(dailyNumber(new Date(2026, 10, 16, 0, 5))).toBe(1);
    expect(dailyNumber(new Date(2026, 10, 16, 23, 55))).toBe(1);
    expect(dailyNumber(new Date(2026, 10, 26, 12))).toBe(11);
    expect(dailyNumber(new Date(2027, 2, 30, 12))).toBe(135);
  });
});

describe('streaks and sharing', () => {
  const b = (solved: boolean) => ({ word: 'crane', solved, guesses: 3 });

  it('counts the run of solves at the end', () => {
    expect(streakOf([])).toBe(0);
    expect(streakOf([b(true), b(false), b(true), b(true)])).toBe(2);
    expect(streakOf([b(true), b(false)])).toBe(0);
  });

  it('builds a brag line with one square per word', () => {
    const text = shareText({ seed: 'day3', minutes: 3, daily: 3, boards: [b(true), b(false), b(true)] });
    expect(text).toContain('Word Race Daily #3');
    expect(text).toContain('I solved 2 words in 3 minutes!');
    expect(text).toContain('🟩⬛🟩');
  });
});
