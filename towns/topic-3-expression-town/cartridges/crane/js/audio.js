/**
 * Demolition Crane - Procedural Web Audio API Sound Synthesizer
 * Provides realistic industrial crunch, metallic clank, hydraulic hiss,
 * alarm buzzer, radar pulse, and celebratory chimes without external dependencies.
 */

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = false;

    try {
      const savedMute = localStorage.getItem('demolition_crane_muted');
      if (savedMute !== null) {
        this.isMuted = savedMute === 'true';
      }
    } catch {
      // ignore
    }
  }

  initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setMuted(muted) {
    this.isMuted = muted;
    try {
      localStorage.setItem('demolition_crane_muted', String(muted));
    } catch {
      // ignore
    }
  }

  getMuted() {
    return this.isMuted;
  }

  /**
   * Heavy metallic crunch & explosion when the wrecking ball crushes a legal operator block.
   */
  playDropCrunch() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;

    // 1. Deep impact sub-bass thump
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(110, t);
    subOsc.frequency.exponentialRampToValueAtTime(32, t + 0.35);

    subGain.gain.setValueAtTime(0.7, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    subOsc.connect(subGain);
    subGain.connect(this.ctx.destination);
    subOsc.start(t);
    subOsc.stop(t + 0.35);

    // 2. White noise debris & rubble crunch
    const bufferSize = this.ctx.sampleRate * 0.3;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, t);
    filter.frequency.exponentialRampToValueAtTime(200, t + 0.3);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.5, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.28);

    whiteNoise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);

    whiteNoise.start(t);
    whiteNoise.stop(t + 0.3);

    // 3. Metallic anvil ring
    const anvil = this.ctx.createOscillator();
    const anvilGain = this.ctx.createGain();
    anvil.type = 'sawtooth';
    anvil.frequency.setValueAtTime(380, t);
    anvil.frequency.exponentialRampToValueAtTime(220, t + 0.2);

    anvilGain.gain.setValueAtTime(0.4, t);
    anvilGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    anvil.connect(anvilGain);
    anvilGain.connect(this.ctx.destination);
    anvil.start(t);
    anvil.stop(t + 0.25);
  }

  /**
   * Harsh metallic rejection clank & warning buzzer when an illegal operator is targeted.
   */
  playFaultClank() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;

    // High dissonance twin square waves
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'square';
    osc2.type = 'sawtooth';

    osc1.frequency.setValueAtTime(196, t); // G3
    osc1.frequency.setValueAtTime(147, t + 0.08); // D3

    osc2.frequency.setValueAtTime(207.65, t); // G#3 (half step clash)
    osc2.frequency.setValueAtTime(155.56, t + 0.08);

    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.35);
    osc2.stop(t + 0.35);
  }

  /**
   * Catastrophic site collapse siren and rumble when an illegal hit triggers full collapse.
   */
  playCollapseAlarm() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;

    // 1. Two-tone warning siren
    const siren = this.ctx.createOscillator();
    const sirenGain = this.ctx.createGain();
    siren.type = 'sawtooth';
    siren.frequency.setValueAtTime(600, t);
    siren.frequency.linearRampToValueAtTime(350, t + 0.2);
    siren.frequency.linearRampToValueAtTime(600, t + 0.4);
    siren.frequency.linearRampToValueAtTime(300, t + 0.65);

    sirenGain.gain.setValueAtTime(0.35, t);
    sirenGain.gain.exponentialRampToValueAtTime(0.01, t + 0.7);

    siren.connect(sirenGain);
    sirenGain.connect(this.ctx.destination);
    siren.start(t);
    siren.stop(t + 0.7);

    // 2. Heavy low rumbling collapse debris
    const bufferSize = this.ctx.sampleRate * 0.8;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, t);
    filter.frequency.exponentialRampToValueAtTime(80, t + 0.75);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.6, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.75);

    whiteNoise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);

    whiteNoise.start(t);
    whiteNoise.stop(t + 0.75);
  }

  /**
   * Air compressor & cable release hiss when the crane drops.
   */
  playHydraulicDrop() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const dur = 0.2;
    const bufferSize = this.ctx.sampleRate * dur;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const bandpass = this.ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(1400, t);
    bandpass.frequency.exponentialRampToValueAtTime(400, t + dur);
    bandpass.Q.setValueAtTime(3.0, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + dur);

    noise.connect(bandpass);
    bandpass.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(t);
    noise.stop(t + dur);
  }

  /**
   * High-tech sonar blip when the PEMDAS guidance radar is toggled.
   */
  playRadarPulse() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(1760, t + 0.12);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.25);
  }

  /**
   * Triumphant industrial chime arpeggio when a full expression is demolished.
   */
  playVictory() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    const startTime = this.ctx.currentTime;

    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime + idx * 0.1);

      gain.gain.setValueAtTime(0.001, startTime + idx * 0.1);
      gain.gain.linearRampToValueAtTime(0.35, startTime + idx * 0.1 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + idx * 0.1 + 0.6);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(startTime + idx * 0.1);
      osc.stop(startTime + idx * 0.1 + 0.65);
    });
  }

  /**
   * Reactor core pulsating hazard alarm when Boss phase activates.
   */
  playReactorWarning() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(130, t);
    osc.frequency.linearRampToValueAtTime(80, t + 0.4);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.5);
  }

  /**
   * Subtle mechanical tick when Station Shift timer is counting down in final 10s.
   */
  playTimerTick() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.exponentialRampToValueAtTime(400, t + 0.03);

    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.03);
  }
  /** Short blip for keypad presses. */
  playKeyClick() {
    this.tone(660, 0.04, 'square', 0.05);
  }

  /** Bright two-note ding for a correct step value. */
  playCorrect() {
    this.tone(880, 0.09, 'triangle', 0.22);
    this.tone(1318.5, 0.14, 'triangle', 0.2, 0.07);
  }

  /** Small helper: one enveloped oscillator note. */
  tone(freq, dur, type = 'sine', vol = 0.2, delay = 0) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }
}

export const soundEngine = new SoundEngine();
