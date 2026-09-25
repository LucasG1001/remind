/**
 * Alarme sintetizado (sem arquivo de áudio). Só toca com o app aberto: o service
 * worker não tem áudio, e o autoplay exige que o AudioContext tenha sido destravado
 * por um gesto — por isso `unlockAudio` roda no toque do play.
 */
const BEEP_EVERY_MS = 1200;
const AUTO_STOP_MS = 2 * 60_000;

let context: AudioContext | null = null;
let loop: number | null = null;
let autoStop: number | null = null;

function getContext(): AudioContext | null {
  if (context) return context;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  context = new Ctor();
  return context;
}

export function unlockAudio(): void {
  const ctx = getContext();
  if (ctx?.state === "suspended") void ctx.resume().catch(() => undefined);
}

function beepBurst(ctx: AudioContext): void {
  const start = ctx.currentTime;
  for (let i = 0; i < 3; i++) {
    const at = start + i * 0.22;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.25, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
    osc.connect(gain).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + 0.18);
  }
  navigator.vibrate?.([160, 60, 160, 60, 160]);
}

export function startAlarm(): void {
  const ctx = getContext();
  stopAlarm();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
  beepBurst(ctx);
  loop = window.setInterval(() => beepBurst(ctx), BEEP_EVERY_MS);
  autoStop = window.setTimeout(stopAlarm, AUTO_STOP_MS);
}

export function stopAlarm(): void {
  if (loop !== null) window.clearInterval(loop);
  if (autoStop !== null) window.clearTimeout(autoStop);
  loop = null;
  autoStop = null;
  navigator.vibrate?.(0);
}
