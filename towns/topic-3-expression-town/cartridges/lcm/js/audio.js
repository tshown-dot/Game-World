/**
 * Grid Sync: The LCM Substation - Audio
 * Procedural Web Audio only (no files). Mute choice is saved in localStorage.
 */

const STORAGE_KEY = 'lcm_power_grid_muted';

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    try {
      this.isMuted = localStorage.getItem(STORAGE_KEY) === 'true';
    } catch (e) { /* storage blocked */ }
    this.lastHopAt = 0;
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

  getMuted() {
    return this.isMuted;
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

  /** One oscillator note. */
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

  /** Short burst of filtered noise (electric crackle). */
  noise({ dur = 0.25, vol = 0.2, freq = 1800, delay = 0 }) {
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
  playKey() { this.tone({ type: 'square', from: 1100, dur: 0.03, vol: 0.04 }); }
  playTick() { this.tone({ type: 'square', from: 1500, dur: 0.04, vol: 0.05 }); }

  /** A pulse landing on a block. Lanes get different pitches; rapid hops are thinned out. */
  playHop(lane = 0) {
    const now = performance.now();
    if (now - this.lastHopAt < 45) return;
    this.lastHopAt = now;
    const base = [520, 392, 660][lane] || 520;
    this.tone({ from: base, to: base * 0.6, dur: 0.08, vol: 0.08 });
  }

  /** Two of three pulses meet (not the real collision). */
  playPartial() {
    this.tone({ type: 'triangle', from: 880, to: 1100, dur: 0.12, vol: 0.12 });
  }

  /** Breaker clamps onto the track. */
  playBreakerLock() {
    this.tone({ type: 'triangle', from: 160, to: 45, dur: 0.14, vol: 0.35 });
    this.noise({ dur: 0.06, vol: 0.12, freq: 3000 });
  }

  /** Big arc when all pulses collide. */
  playCollision() {
    this.tone({ type: 'sawtooth', from: 180, to: 60, dur: 0.35, vol: 0.2 });
    this.tone({ type: 'sawtooth', from: 184, to: 62, dur: 0.35, vol: 0.2 });
    this.noise({ dur: 0.35, vol: 0.25, freq: 1400 });
  }

  /** Breaker caught the surge. */
  playCatch() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone({ type: 'triangle', from: f, dur: 0.5, vol: 0.2, delay: i * 0.07 }));
  }

  playFault() {
    this.tone({ type: 'sawtooth', from: 95, to: 55, dur: 0.4, vol: 0.3 });
    this.noise({ dur: 0.3, vol: 0.2, freq: 600 });
  }

  playAlarm() {
    for (let i = 0; i < 3; i++) this.tone({ type: 'sawtooth', from: 880, to: 440, dur: 0.2, vol: 0.14, delay: i * 0.24 });
  }

  playChargeUp() {
    this.tone({ from: 150, to: 800, dur: 0.45, vol: 0.18, attack: 0.3 });
  }

  playPowerDown() {
    this.tone({ type: 'sawtooth', from: 440, to: 40, dur: 1.1, vol: 0.22 });
  }

  playBossHit() {
    this.noise({ dur: 0.45, vol: 0.3, freq: 900 });
    this.tone({ type: 'square', from: 300, to: 70, dur: 0.4, vol: 0.18 });
  }

  playVictory() {
    const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5];
    notes.forEach((f, i) => this.tone({ type: 'triangle', from: f, dur: 0.35, vol: 0.18, delay: i * 0.11 }));
  }
}

export const soundEngine = new SoundEngine();
