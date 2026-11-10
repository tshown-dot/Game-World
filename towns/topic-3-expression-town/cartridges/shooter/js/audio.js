/**
 * Term Popper - Audio
 * Procedural Web Audio only (no files). Mute choice is saved in localStorage.
 */

const STORAGE_KEY = 'term_popper_muted';

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    try {
      this.isMuted = localStorage.getItem(STORAGE_KEY) === 'true';
    } catch (e) { /* storage blocked */ }
    this.lastBounceAt = 0;
  }

  getContext() {
    if (this.isMuted) return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  setMuted(muted) {
    this.isMuted = muted;
    try { localStorage.setItem(STORAGE_KEY, String(muted)); } catch (e) { /* ignore */ }
    if (muted && this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
  }

  toggleMuted() {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  tone({ type = 'sine', from, to = from, dur = 0.12, vol = 0.15, delay = 0, attack = 0.005 }) {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const t = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(from, t);
      if (to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(vol, t + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch (e) { /* audio is optional */ }
  }

  noise({ dur = 0.25, vol = 0.2, freq = 1800, delay = 0, q = 1 }) {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const t = ctx.currentTime + delay;
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = freq;
      filter.Q.value = q;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      src.start(t);
    } catch (e) { /* audio is optional */ }
  }

  playClick() { this.tone({ from: 700, to: 900, dur: 0.05, vol: 0.08 }); }

  playShoot() {
    this.tone({ type: 'square', from: 520, to: 1040, dur: 0.09, vol: 0.07 });
    this.noise({ dur: 0.08, vol: 0.08, freq: 2600 });
  }

  playSwap() {
    this.tone({ type: 'triangle', from: 660, to: 880, dur: 0.06, vol: 0.1 });
    this.tone({ type: 'triangle', from: 880, to: 660, dur: 0.06, vol: 0.1, delay: 0.06 });
  }

  playBounce() {
    const now = performance.now();
    if (now - this.lastBounceAt < 60) return;
    this.lastBounceAt = now;
    this.tone({ type: 'triangle', from: 900, to: 600, dur: 0.05, vol: 0.08 });
  }

  /** Term sticks with no like neighbor. */
  playStick() {
    this.tone({ type: 'triangle', from: 220, to: 140, dur: 0.1, vol: 0.18 });
  }

  /** Misfire: stuck even though a like term existed. */
  playMisfire() {
    this.tone({ type: 'sawtooth', from: 180, to: 90, dur: 0.25, vol: 0.16 });
    this.tone({ type: 'sawtooth', from: 186, to: 92, dur: 0.25, vol: 0.12 });
  }

  /** Like terms combine. Pitch climbs with combo. */
  playCombine(combo = 1) {
    const base = 440 * Math.pow(1.06, Math.min(combo, 10));
    this.tone({ type: 'triangle', from: base, to: base * 1.5, dur: 0.14, vol: 0.16 });
    this.tone({ type: 'sine', from: base * 2, dur: 0.12, vol: 0.06, delay: 0.05 });
  }

  /** Group sums to zero and pops. */
  playZero(size = 2, combo = 1) {
    const lift = Math.pow(1.06, Math.min(combo, 10));
    const chord = size >= 4 ? [523.25, 659.25, 783.99, 1046.5, 1318.5] : [523.25, 659.25, 783.99, 1046.5];
    chord.forEach((f, i) => this.tone({ type: 'triangle', from: f * lift, dur: 0.22, vol: 0.14, delay: i * 0.04 }));
    this.noise({ dur: 0.2, vol: 0.14, freq: 4200 });
    this.tone({ from: 140, to: 50, dur: 0.18, vol: 0.25 });
  }

  /** Bubbles fall off. */
  playDrop(count) {
    const n = Math.min(count, 6);
    for (let i = 0; i < n; i++) {
      this.tone({ type: 'square', from: 900 - i * 90, to: 500 - i * 50, dur: 0.07, vol: 0.05, delay: 0.12 + i * 0.05 });
    }
  }

  playCeiling() {
    this.tone({ type: 'sawtooth', from: 110, to: 45, dur: 0.4, vol: 0.28 });
    this.noise({ dur: 0.3, vol: 0.2, freq: 400 });
  }

  playWarning() {
    this.tone({ type: 'square', from: 880, dur: 0.07, vol: 0.06 });
  }

  playStageClear() {
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => this.tone({ type: 'triangle', from: f, dur: 0.3, vol: 0.17, delay: i * 0.09 }));
  }

  playDefeat() {
    this.tone({ type: 'sawtooth', from: 330, to: 50, dur: 0.9, vol: 0.25 });
    this.noise({ dur: 0.6, vol: 0.2, freq: 500 });
  }

  playBossHit() {
    this.noise({ dur: 0.45, vol: 0.3, freq: 900 });
    this.tone({ type: 'square', from: 300, to: 70, dur: 0.4, vol: 0.18 });
  }

  playBossShift() {
    for (let i = 0; i < 4; i++) this.tone({ type: 'sine', from: 300 + i * 120, to: 200 + i * 60, dur: 0.12, vol: 0.1, delay: i * 0.07 });
  }

  playBossRoar() {
    this.tone({ type: 'sawtooth', from: 90, to: 60, dur: 0.7, vol: 0.22 });
    this.tone({ type: 'sawtooth', from: 93, to: 58, dur: 0.7, vol: 0.18 });
    this.noise({ dur: 0.6, vol: 0.18, freq: 300 });
  }

  playVictory() {
    const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5];
    notes.forEach((f, i) => this.tone({ type: 'triangle', from: f, dur: 0.35, vol: 0.18, delay: i * 0.11 }));
  }
}

export const soundEngine = new SoundEngine();
