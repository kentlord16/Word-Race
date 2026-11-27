// Tiny synthesized sound effects — no audio files to load.
let ctx: AudioContext | null = null;
let enabled = true;

export function setSoundEnabled(on: boolean) {
  enabled = on;
}

function tone(freq: number, at: number, length: number, volume: number, type: OscillatorType = 'sine') {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const start = ctx.currentTime + at;
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + length);
}

function play(notes: [freq: number, at: number, length: number, volume: number, type?: OscillatorType][]) {
  if (!enabled) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    for (const note of notes) tone(...note);
  } catch {
    // No audio available; the game is fine without it.
  }
}

const buzz = (ms: number | number[]) => {
  if (enabled) navigator.vibrate?.(ms);
};

export const sfx = {
  tap: () => play([[520, 0, 0.05, 0.04, 'triangle']]),
  guess: () => play([[330, 0, 0.09, 0.07, 'triangle'], [392, 0.07, 0.1, 0.07, 'triangle']]),
  nope: () => {
    play([[150, 0, 0.16, 0.09, 'square']]);
    buzz(40);
  },
  solved: () => {
    play([[523, 0, 0.12, 0.1], [659, 0.08, 0.12, 0.1], [784, 0.16, 0.12, 0.1], [1047, 0.24, 0.28, 0.1]]);
    buzz([20, 40, 20]);
  },
  missed: () => play([[330, 0, 0.18, 0.08, 'triangle'], [247, 0.16, 0.3, 0.08, 'triangle']]),
  count: () => play([[440, 0, 0.12, 0.08]]),
  go: () => play([[880, 0, 0.3, 0.1]]),
  tick: () => play([[1000, 0, 0.04, 0.05, 'square']]),
  finish: () => {
    play([[784, 0, 0.14, 0.1], [659, 0.14, 0.14, 0.1], [523, 0.28, 0.14, 0.1], [784, 0.42, 0.5, 0.1]]);
    buzz(120);
  },
};
