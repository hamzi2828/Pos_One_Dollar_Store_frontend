// Tells a USB barcode scanner apart from a person typing.
// A USB scanner (e.g. SpeedX SP-8600) acts as a keyboard: it "types" the
// code a few milliseconds per character and then presses Enter (or Tab).
// People are much slower, so: at least MIN_LENGTH characters, every gap
// short, then Enter/Tab right after = a scan. No browser APIs here, so the
// logic can be tested on its own.

export const SCAN_MIN_LENGTH = 4;
/** Longest pause between two characters of one scan (scanners: ~2–20 ms; people: 80 ms+). */
export const SCAN_MAX_GAP_MS = 50;
/** Longest pause between the last character and Enter/Tab. */
export const SCAN_END_GAP_MS = 100;

/** The parts of a KeyboardEvent the detector reads. */
export interface ScanKey {
  key: string;
  code: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}

export type ScanStep =
  /** First character of a possible scan: remember what the field held before it. */
  | { kind: 'start' }
  | { kind: 'char' }
  /** Enter/Tab ending a scan: cancel the key, put the field back, look the code up. */
  | { kind: 'scan'; code: string }
  | { kind: 'ignore' };

const PUNCTUATION: Record<string, string> = {
  Minus: '-', Equal: '=', Period: '.', Comma: ',', Slash: '/', Backslash: '\\',
  Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']', Backquote: '`', Space: ' ',
  NumpadSubtract: '-', NumpadAdd: '+', NumpadDecimal: '.', NumpadDivide: '/', NumpadMultiply: '*',
};

/**
 * The character a key stands for, or null for keys that are not characters (Shift, F2…).
 * With a non-English keyboard layout (e.g. Urdu) the scanner's keys come out as
 * other letters; the physical key (e.code) still says which one was meant.
 */
export function keyToChar(e: Pick<ScanKey, 'key' | 'code' | 'shiftKey'>): string | null {
  if (e.key.length !== 1) return null;
  if (e.key >= ' ' && e.key <= '~') return e.key;
  const c = e.code || '';
  if (/^Key[A-Z]$/.test(c)) return e.shiftKey ? c[3] : c[3].toLowerCase();
  if (/^(Digit|Numpad)[0-9]$/.test(c)) return c[c.length - 1];
  return PUNCTUATION[c] ?? null;
}

const MODIFIERS = new Set(['Shift', 'CapsLock', 'NumLock']);

export class ScanDetector {
  private chars = '';
  private times: number[] = [];
  private target: unknown = null;
  private readonly minLength: number;
  private readonly maxGap: number;
  private readonly endGap: number;

  constructor(minLength = SCAN_MIN_LENGTH, maxGap = SCAN_MAX_GAP_MS, endGap = SCAN_END_GAP_MS) {
    this.minLength = minLength;
    this.maxGap = maxGap;
    this.endGap = endGap;
  }

  reset() {
    this.chars = '';
    this.times = [];
    this.target = null;
  }

  /** Feed every key press (time in ms, target = the focused element). */
  push(e: ScanKey, now: number, target: unknown): ScanStep {
    if (e.ctrlKey || e.altKey || e.metaKey) {
      this.reset();
      return { kind: 'ignore' };
    }
    if (MODIFIERS.has(e.key)) return { kind: 'ignore' }; // Shift between letters is part of a scan

    const last = this.times[this.times.length - 1];
    const ch = keyToChar(e);
    if (ch !== null) {
      // A slow key or a different field starts over from this character.
      if (this.chars && (now - last > this.maxGap || target !== this.target)) this.reset();
      const first = !this.chars;
      if (first) this.target = target;
      this.chars += ch;
      this.times.push(now);
      return { kind: first ? 'start' : 'char' };
    }

    if (e.key === 'Enter' || e.key === 'Tab') {
      const code = this.chars.trim();
      const isScan =
        code.length >= this.minLength &&
        target === this.target &&
        now - last <= this.endGap &&
        this.times.every((t, i) => i === 0 || t - this.times[i - 1] <= this.maxGap);
      this.reset();
      return isScan ? { kind: 'scan', code } : { kind: 'ignore' };
    }

    this.reset(); // Backspace, arrows, F-keys…: a person is at the keyboard
    return { kind: 'ignore' };
  }
}
