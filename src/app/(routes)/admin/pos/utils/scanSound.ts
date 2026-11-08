// Short low buzz when a scan is not added (unknown code, out of stock), so the
// cashier notices without looking at the screen. The scanner's own beep only
// means "barcode read". Silent if the browser has no sound.

let ctx: AudioContext | null = null;

export function playScanError() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = ctx || new AC();
    if (ctx.state === 'suspended') void ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 220;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch {
    // no sound available
  }
}

/** Loud alarm (three high–low beeps) for "no product with this code". */
export function playScanAlert() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = ctx || new AC();
    if (ctx.state === 'suspended') void ctx.resume();
    const t0 = ctx.currentTime;
    for (let i = 0; i < 6; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = i % 2 === 0 ? 1040 : 700;
      const s = t0 + i * 0.16;
      gain.gain.setValueAtTime(0.0001, s);
      gain.gain.exponentialRampToValueAtTime(0.18, s + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, s + 0.14);
      osc.connect(gain).connect(ctx.destination);
      osc.start(s);
      osc.stop(s + 0.15);
    }
  } catch {
    // no sound available
  }
}
