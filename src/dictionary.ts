// The guess dictionary is large, so it loads in the background after the first
// screen is up. Until it arrives, any guess of the right length is accepted.
let allowed: Record<number, ReadonlySet<string>> | null = null;

export const dictionaryReady = import('./words/allowed').then((m) => {
  allowed = m.ALLOWED;
});

export function isWord(word: string): boolean {
  return allowed ? (allowed[word.length]?.has(word) ?? false) : true;
}
