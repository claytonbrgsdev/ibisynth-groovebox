let ctx: AudioContext | null = null;

// --- Bus gain nodes (created in initAudio) ---
let drumBusGain: GainNode | null = null;
let bassBusGain: GainNode | null = null;
let dubBusGain: GainNode | null = null;
let samplerBusGain: GainNode | null = null;
let masterGain: GainNode | null = null;
let globalFilterNode: BiquadFilterNode | null = null;
let washDelayNode: DelayNode | null = null;
let washFeedbackGain: GainNode | null = null;
let washWetGain: GainNode | null = null;

export function initAudio() {
  if (!ctx) {
    ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

    // --- Create routing graph ---
    drumBusGain    = ctx.createGain();
    bassBusGain    = ctx.createGain();
    dubBusGain     = ctx.createGain();
    samplerBusGain = ctx.createGain();
    masterGain     = ctx.createGain();

    // Global wash: lowpass filter + delay feedback loop
    globalFilterNode  = ctx.createBiquadFilter();
    globalFilterNode.type = 'lowpass';
    globalFilterNode.frequency.value = 20000; // fully open by default
    globalFilterNode.Q.value = 1;

    washDelayNode    = ctx.createDelay(2.0);
    washDelayNode.delayTime.value = 0.06; // 60ms

    washFeedbackGain = ctx.createGain();
    washFeedbackGain.gain.value = 0; // default: no feedback

    washWetGain      = ctx.createGain();
    washWetGain.gain.value = 0; // default: dry

    // Routing: buses → masterGain → globalFilter → destination
    //          globalFilter also feeds wash loop → destination
    drumBusGain.connect(masterGain);
    bassBusGain.connect(masterGain);
    dubBusGain.connect(masterGain);
    samplerBusGain.connect(masterGain);

    masterGain.connect(globalFilterNode);
    globalFilterNode.connect(ctx.destination);

    // Wash loop: globalFilter → washDelay → washFeedback (→ washDelay) + washWet → destination
    globalFilterNode.connect(washDelayNode);
    washDelayNode.connect(washFeedbackGain);
    washFeedbackGain.connect(washDelayNode); // feedback
    washDelayNode.connect(washWetGain);
    washWetGain.connect(ctx.destination);

    // Default volumes
    drumBusGain.gain.value    = 1;
    bassBusGain.gain.value    = 1;
    dubBusGain.gain.value     = 1;
    samplerBusGain.gain.value = 1;
    masterGain.gain.value     = 0.8;
  }
  if (ctx.state === 'suspended') {
    ctx.resume();
  }
}

export function getAudioTime() {
  if (!ctx) return 0;
  return ctx.currentTime;
}

// --- Setter functions (call setTargetAtTime for zipper-noise-free changes) ---

export function setMasterVolume(value: number) {
  if (!masterGain || !ctx) return;
  masterGain.gain.setTargetAtTime(value, ctx.currentTime, 0.02);
}

export function setDrumBusVolume(value: number) {
  if (!drumBusGain || !ctx) return;
  drumBusGain.gain.setTargetAtTime(value, ctx.currentTime, 0.02);
}

export function setBassBusVolume(value: number) {
  if (!bassBusGain || !ctx) return;
  bassBusGain.gain.setTargetAtTime(value, ctx.currentTime, 0.02);
}

export function setDubBusVolume(value: number) {
  if (!dubBusGain || !ctx) return;
  dubBusGain.gain.setTargetAtTime(value, ctx.currentTime, 0.02);
}

export function setSamplerBusVolume(value: number) {
  if (!samplerBusGain || !ctx) return;
  samplerBusGain.gain.setTargetAtTime(value, ctx.currentTime, 0.02);
}

export function setGlobalFilter(freqHz: number) {
  // freqHz range: 200–20000. Higher = open, lower = darker wash.
  if (!globalFilterNode || !ctx) return;
  const q = 1 + ((20000 - freqHz) / 20000) * 13; // Q: 1 (open) → 14 (closed)
  globalFilterNode.frequency.setTargetAtTime(freqHz, ctx.currentTime, 0.02);
  globalFilterNode.Q.setTargetAtTime(q, ctx.currentTime, 0.02);
}

export function setGlobalDryWet(wetAmount: number) {
  // wetAmount: 0 (dry) → 1 (wet). Controls the wash wet send.
  if (!washWetGain || !washFeedbackGain || !ctx) return;
  const wet = wetAmount * 0.6;        // max wet send = 0.6
  const fb  = wetAmount * 0.45;       // max feedback = 0.45
  washWetGain.gain.setTargetAtTime(wet, ctx.currentTime, 0.02);
  washFeedbackGain.gain.setTargetAtTime(fb, ctx.currentTime, 0.02);
}

export function setGlobalWash(washAmount: number) {
  // washAmount: 0–1. Closes the lowpass filter for a "wash out" effect.
  // 0 = fully open (20kHz), 1 = closed (200Hz)
  if (!globalFilterNode || !ctx) return;
  const freq = 20000 * Math.pow(200 / 20000, washAmount); // exponential sweep
  const q = 1 + washAmount * 13;
  globalFilterNode.frequency.setTargetAtTime(freq, ctx.currentTime, 0.02);
  globalFilterNode.Q.setTargetAtTime(q, ctx.currentTime, 0.02);
}

export function setEchoDelayTime(seconds: number) {
  if (!washDelayNode || !ctx) return;
  const clamped = Math.max(0.01, Math.min(2.0, seconds));
  washDelayNode.delayTime.setTargetAtTime(clamped, ctx.currentTime, 0.02);
}

// --- Visual event bus ---
export const visualEvents: { type: string; time: number; param?: any }[] = [];

export function scheduleVisualEvent(type: string, time: number, param?: any) {
  visualEvents.push({ type, time, param });
  if (visualEvents.length > 100) {
    visualEvents.shift();
  }
}

// --- Sound functions (all route through bus gains) ---

export function playSampleAtTime(padId: number, time: number, pitchSemitones: number = 0) {
  scheduleVisualEvent('SAMPLE', time, padId);
  if (!ctx || !samplerBusGain) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  const baseFreq = 220;
  const scale = [1, 1.122, 1.333, 1.5, 1.782, 2, 2.245, 2.667, 3, 3.564, 4, 4.49, 5.334, 6, 7.127, 8];
  const pitchMult = Math.pow(2, pitchSemitones / 12);

  osc.frequency.value = baseFreq * (scale[padId] || 1) * pitchMult;
  osc.type = padId % 2 === 0 ? 'square' : 'sawtooth';

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1000 + padId * 300, time);
  filter.frequency.exponentialRampToValueAtTime(100, time + 0.3);

  gain.gain.setValueAtTime(0.3, time);
  gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(samplerBusGain);

  osc.start(time);
  osc.stop(time + 0.5);
}

export function playSoundAtTime(instrument: string, time: number, param?: number) {
  scheduleVisualEvent(instrument, time, param);
  if (!ctx || !drumBusGain) return;

  switch (instrument) {
    case 'KICK': {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(drumBusGain);
      osc.frequency.setValueAtTime(150, time);
      osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);
      gain.gain.setValueAtTime(1, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);
      osc.start(time);
      osc.stop(time + 0.5);
      break;
    }
    case 'SNARE': {
      const osc    = ctx.createOscillator();
      const gain   = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      osc.type = 'triangle';
      osc.connect(gain);
      gain.connect(filter);
      filter.connect(drumBusGain);
      osc.frequency.setValueAtTime(250, time);
      gain.gain.setValueAtTime(0.5, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
      osc.start(time);
      osc.stop(time + 0.2);

      const noise       = ctx.createBufferSource();
      const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
      const output      = noiseBuffer.getChannelData(0);
      for (let i = 0; i < output.length; i++) output[i] = Math.random() * 2 - 1;
      noise.buffer = noiseBuffer;
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'highpass';
      noiseFilter.frequency.value = 1000;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.5, time);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(drumBusGain);
      noise.start(time);
      break;
    }
    case 'HIHAT': {
      const noise       = ctx.createBufferSource();
      const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
      const output      = noiseBuffer.getChannelData(0);
      for (let i = 0; i < output.length; i++) output[i] = Math.random() * 2 - 1;
      noise.buffer = noiseBuffer;
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'highpass';
      noiseFilter.frequency.value = 7000;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.3, time);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(drumBusGain);
      noise.start(time);
      break;
    }
    case 'CLAP': {
      const noise       = ctx.createBufferSource();
      const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
      const output      = noiseBuffer.getChannelData(0);
      for (let i = 0; i < output.length; i++) output[i] = Math.random() * 2 - 1;
      noise.buffer = noiseBuffer;
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.value = 1500;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.5, time);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.15);
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(drumBusGain);
      noise.start(time);
      break;
    }
  }
}

export function playDubChordAtTime(
  chordIndex: number,
  time: number,
  filterFreq: number = 800,
  delayAmt: number = 0.5,
  bpm: number = 120,
  decayAmt: number = 0.6,
) {
  scheduleVisualEvent('DUB', time, { filterFreq, delayAmt, decayAmt });
  if (!ctx || !dubBusGain) return;

  const chords = [
    [130.81, 155.56, 196.0, 233.08],
    [174.61, 207.65, 261.63, 311.13],
    [196.0, 233.08, 293.66, 349.23],
    [233.08, 277.18, 349.23, 415.3],
  ];

  const idx        = Math.min(Math.max(chordIndex, 0), chords.length - 1);
  const frequencies = chords[idx];

  const mainGain = ctx.createGain();
  mainGain.gain.setValueAtTime(0, time);
  mainGain.gain.linearRampToValueAtTime(0.15, time + 0.05);
  mainGain.gain.exponentialRampToValueAtTime(0.01, time + (decayAmt || 0.6));

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(filterFreq, time);
  filter.frequency.exponentialRampToValueAtTime(filterFreq * 0.3, time + (decayAmt || 0.5));
  filter.Q.value = 6;

  const delay          = ctx.createDelay();
  delay.delayTime.value = (60 / bpm) * 0.75;
  const delayFeedback = ctx.createGain();
  delayFeedback.gain.value = delayAmt * 0.8;
  const delayWet      = ctx.createGain();
  delayWet.gain.value = delayAmt;

  mainGain.connect(filter);
  filter.connect(dubBusGain);
  filter.connect(delay);
  delay.connect(delayFeedback);
  delayFeedback.connect(delay);
  delay.connect(delayWet);
  delayWet.connect(dubBusGain);

  frequencies.forEach((freq) => {
    const osc1 = ctx!.createOscillator();
    const osc2 = ctx!.createOscillator();
    osc1.type = 'sawtooth';
    osc2.type = 'square';
    osc1.frequency.value = freq;
    osc2.frequency.value = freq * 1.008;
    osc1.connect(mainGain);
    osc2.connect(mainGain);
    osc1.start(time);
    osc2.start(time);
    osc1.stop(time + 2.0);
    osc2.stop(time + 2.0);
  });
}

export function playBassAtTime(noteIndex: number, time: number, decayAmt: number = 0.3) {
  scheduleVisualEvent('BASS', time);
  if (!ctx || !bassBusGain) return;

  const notes = [65.41, 87.31, 98.0, 116.54];
  const idx   = Math.min(Math.max(noteIndex, 0), notes.length - 1);
  const freq  = notes[idx];

  const osc      = ctx.createOscillator();
  const subOsc   = ctx.createOscillator();
  const subGain  = ctx.createGain();
  const mainGain = ctx.createGain();
  const filter   = ctx.createBiquadFilter();

  osc.type    = 'sawtooth';
  subOsc.type = 'sine';
  osc.frequency.value    = freq;
  subOsc.frequency.value = freq / 2;

  subGain.gain.value = 0.5;
  subOsc.connect(subGain);
  osc.connect(mainGain);
  subGain.connect(mainGain);

  mainGain.gain.setValueAtTime(0, time);
  mainGain.gain.linearRampToValueAtTime(0.5, time + 0.02);
  mainGain.gain.exponentialRampToValueAtTime(0.001, time + decayAmt);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1200, time);
  filter.frequency.exponentialRampToValueAtTime(100, time + decayAmt * 0.8);
  filter.Q.value = 4;

  mainGain.connect(filter);
  filter.connect(bassBusGain);

  osc.start(time);
  subOsc.start(time);
  osc.stop(time + decayAmt + 0.1);
  subOsc.stop(time + decayAmt + 0.1);
}
