/**
 * Expression Town - Retro 8-Bit SMB3 Web Audio Synthesizer
 * 
 * Lightweight, zero-asset Web Audio synthesizer for Super Mario Bros 3 style SFX.
 * Persists mute preference in localStorage.
 */

class HubAudioEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.hasUnlockedAudio = false;

    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('numeria_hub_muted');
      this.isMuted = saved === 'true';
    }
  }

  init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    } catch (e) {
      console.warn('[AudioEngine] Web Audio not supported', e);
    }
  }

  unlockAudio() {
    if (this.hasUnlockedAudio) return;
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    this.hasUnlockedAudio = true;
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (typeof window !== 'undefined') {
      localStorage.setItem('numeria_hub_muted', String(this.isMuted));
    }
    return this.isMuted;
  }

  playTone(freq, type = 'square', duration = 0.12, gainVal = 0.1, decay = 0.04) {
    if (this.isMuted) return;
    this.unlockAudio();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(gainVal, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + duration + decay);
    } catch (e) {
      // Audio safety
    }
  }

  // SMB3 Map tile movement blip
  playStep() {
    this.playTone(330, 'triangle', 0.05, 0.12);
    setTimeout(() => {
      this.playTone(440, 'triangle', 0.06, 0.1);
    }, 35);
  }

  playSelect() {
    this.playTone(587.33, 'square', 0.07, 0.08);
  }

  playNodeHover() {
    this.playTone(523.25, 'triangle', 0.05, 0.07);
  }

  playQuestOpen() {
    if (this.isMuted) return;
    this.unlockAudio();
    const notes = [392.00, 523.25, 659.25];
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        this.playTone(freq, 'square', 0.1, 0.08);
      }, idx * 45);
    });
  }

  // Classic Mario Stage Enter fanfare
  playCartridgeLaunch() {
    if (this.isMuted) return;
    this.unlockAudio();
    const chord = [523.25, 659.25, 783.99, 1046.50];
    chord.forEach((freq, idx) => {
      setTimeout(() => {
        this.playTone(freq, 'square', 0.18, 0.1);
      }, idx * 60);
    });
  }

  // Authentic Mario Coin (B5 -> E6)
  playCoinClink() {
    if (this.isMuted) return;
    this.unlockAudio();
    this.playTone(987.77, 'square', 0.08, 0.12); // B5
    setTimeout(() => {
      this.playTone(1318.51, 'square', 0.25, 0.14); // E6
    }, 75);
  }

  // Classic 1-Up / Stage Clear Fanfare (E5 - G5 - E6 - C6 - D6 - G6)
  playLevelUp() {
    if (this.isMuted) return;
    this.unlockAudio();
    const notes = [
      { f: 659.25, d: 0.11 }, // E5
      { f: 783.99, d: 0.11 }, // G5
      { f: 1318.51, d: 0.11 }, // E6
      { f: 1046.50, d: 0.11 }, // C6
      { f: 1174.66, d: 0.11 }, // D6
      { f: 1567.98, d: 0.30 }, // G6
    ];
    let time = 0;
    notes.forEach((note) => {
      setTimeout(() => {
        this.playTone(note.f, 'square', note.d, 0.12);
      }, time);
      time += 105;
    });
  }

  playLockRattle() {
    if (this.isMuted) return;
    this.unlockAudio();
    this.playTone(130, 'sawtooth', 0.1, 0.15);
    setTimeout(() => {
      this.playTone(95, 'sawtooth', 0.14, 0.18);
    }, 85);
  }
}

export const hubAudio = new HubAudioEngine();
