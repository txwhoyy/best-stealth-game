// Shadowline — sound: every sound is synthesized with WebAudio, no audio files
// and no network. Footsteps tell you where a guard is; the sting tells you
// you have been seen; the chime tells you the exit is open.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.noiseBuffer = null;
  }

  /** Create the AudioContext on the first user gesture (browsers require it). */
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 0.25;
    this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  }

  /** Volume falls with distance (0 = at the listener, 1 = far away). */
  volumeByDistance(dist, maxDist) {
    return Math.max(0, 1 - dist / maxDist);
  }

  tone(freq, dur, type, vol, when = 0, slideTo = null) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  noise(dur, vol, filterFreq) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  /** A soft footstep; vol 0..1, sneak steps are quieter and higher. */
  step(vol, sneak) {
    if (vol <= 0.02) return;
    this.noise(sneak ? 0.05 : 0.08, vol * (sneak ? 0.25 : 0.6), sneak ? 900 : 480);
  }

  /** Two-note alert sting when a guard starts investigating. */
  alertSting() {
    this.tone(392, 0.16, 'square', 0.22);
    this.tone(311, 0.28, 'square', 0.22, 0.14);
  }

  /** Harsh buzz when the player is caught. */
  caughtSting() {
    this.tone(220, 0.5, 'sawtooth', 0.3, 0, 110);
    this.tone(233, 0.5, 'sawtooth', 0.2, 0.05, 116);
  }

  /** Bright chime for a picked-up data shard. */
  pickup() {
    this.tone(880, 0.14, 'sine', 0.25);
    this.tone(1318, 0.22, 'sine', 0.2, 0.08);
  }

  /** Rising chime when a level is cleared. */
  exitChime() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.3, 'sine', 0.22, i * 0.09));
  }

  /** Soft click for menu keys. */
  uiClick() {
    this.tone(660, 0.06, 'sine', 0.15);
  }
}
