/**
 * Charge Runner: Exponent Reactor - Audio Engine
 * Pure Web Audio API synthesized sound generator.
 * Zero external audio files / zero CDN latency.
 * Safe for school networks and low-spec Chromebooks.
 */

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    const saved = localStorage.getItem('charge_runner_muted');
    if (saved !== null) {
      this.isMuted = saved === 'true';
    }
  }

  getContext() {
    if (this.isMuted) return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  getMuted() {
    return this.isMuted;
  }

  setMuted(muted) {
    this.isMuted = muted;
    localStorage.setItem('charge_runner_muted', String(muted));
    if (muted && this.ctx && this.ctx.state === 'running') {
      this.ctx.suspend().catch(() => {});
    }
  }

  toggleMuted() {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  /**
   * Quick tactile UI click
   */
  playClick() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.04);

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.04);
    } catch {
      // Audio fallback silent
    }
  }

  /**
   * Energetic tone as numbers multiply along the visualizer ribbon.
   * Pitch climbs pentatonically with each exponential multiplication step!
   */
  playStepTone(stepIndex, totalSteps = 4, factor = 2) {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const pentatonicFreqs = [261.63, 293.66, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50];
      const freq = pentatonicFreqs[Math.min(stepIndex, pentatonicFreqs.length - 1)];

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq * 0.8, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.25, now + 0.08);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.16);

      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(freq * 2, now);
      subGain.gain.setValueAtTime(0.05, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      subOsc.connect(subGain);
      subGain.connect(ctx.destination);
      subOsc.start(now);
      subOsc.stop(now + 0.06);
    } catch {
      // Silent fail
    }
  }

  /**
   * Heavy bass thud / electrical stall buzzer when reactor stalls (especially on multiplication trap)
   */
  playStallBuzzer(isMultiplicationTrap = false) {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      const bassOsc = ctx.createOscillator();
      const bassGain = ctx.createGain();
      bassOsc.type = 'sawtooth';
      bassOsc.frequency.setValueAtTime(isMultiplicationTrap ? 120 : 90, now);
      bassOsc.frequency.exponentialRampToValueAtTime(32, now + 0.45);

      bassGain.gain.setValueAtTime(0.3, now);
      bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(280, now);
      filter.frequency.linearRampToValueAtTime(70, now + 0.45);

      bassOsc.connect(filter);
      filter.connect(bassGain);
      bassGain.connect(ctx.destination);

      bassOsc.start(now);
      bassOsc.stop(now + 0.48);

      if (isMultiplicationTrap) {
        const buzzOsc = ctx.createOscillator();
        const buzzGain = ctx.createGain();
        buzzOsc.type = 'square';
        buzzOsc.frequency.setValueAtTime(65, now);
        buzzGain.gain.setValueAtTime(0.14, now);
        buzzGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        buzzOsc.connect(buzzGain);
        buzzGain.connect(ctx.destination);
        buzzOsc.start(now);
        buzzOsc.stop(now + 0.35);
      }
    } catch {
      // Silent fail
    }
  }

  /**
   * Radiant futuristic chord for successful target power match
   */
  playSuccessChord() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const chord = [523.25, 659.25, 783.99, 1046.50, 1318.51];

      chord.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        const delay = idx * 0.04;
        const noteStart = now + delay;
        const duration = 0.5;

        osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, noteStart);

        gain.gain.setValueAtTime(0.0001, noteStart);
        gain.gain.linearRampToValueAtTime(0.12, noteStart + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, noteStart + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(noteStart);
        osc.stop(noteStart + duration);
      });
    } catch {
      // Silent fail
    }
  }

  /**
   * Subtle alert tick when surge countdown is low (<5s)
   */
  playAlarmTick() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.06);

      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.06);
    } catch {
      // Silent fail
    }
  }

  /**
   * Beam discharge laser sound
   */
  playDischargeLaser() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(900, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.22);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.22);
    } catch {
      // Silent fail
    }
  }

  /**
   * Meltdown alarm siren
   */
  playMeltdown() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.linearRampToValueAtTime(220, now + 0.3);
      osc.frequency.linearRampToValueAtTime(440, now + 0.6);
      osc.frequency.linearRampToValueAtTime(180, now + 1.0);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 1.0);
    } catch {
      // Silent fail
    }
  }

  /**
   * Triumphant victory fanfare for Sector Clear
   */
  playVictoryFanfare() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const notes = [440, 554.37, 659.25, 880]; // A4, C#5, E5, A5
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + idx * 0.12;
        const dur = idx === notes.length - 1 ? 0.7 : 0.2;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.15, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        osc.stop(start + dur);
      });
    } catch {
      // Silent fail
    }
  }
}

export const soundManager = new SoundEngine();
