import { getAudioTime, visualEvents } from '../lib/audio';

const TAU = Math.PI * 2;
const ss   = (a: number, b: number, t: number) => { const x = Math.max(0, Math.min(1, (t-a)/(b-a))); return x*x*(3-2*x); };
const lerp = (a: number, b: number, t: number) => a + (b-a)*t;

// ── Bessel functions via series expansion + forward recurrence ─────────────────
function seriesJ0(x: number): number {
  const x2 = x * x * 0.25;
  let s = 1, term = 1;
  for (let k = 1; k <= 20; k++) {
    term *= -x2 / (k * k);
    s += term;
    if (Math.abs(term) < 1e-12) break;
  }
  return s;
}
function seriesJ1(x: number): number {
  const x2 = x * x * 0.25;
  let s = x * 0.5, term = x * 0.5;
  for (let k = 1; k <= 20; k++) {
    term *= -x2 / (k * (k + 1));
    s += term;
    if (Math.abs(term) < 1e-12) break;
  }
  return s;
}
function besselJ(n: number, x: number): number {
  if (n === 0) return seriesJ0(x);
  if (n === 1) return seriesJ1(Math.abs(x)) * (x < 0 ? -1 : 1);
  let jm1 = seriesJ0(x), j0 = seriesJ1(x);
  for (let k = 1; k < n; k++) {
    const j1 = x > 1e-9 ? (2 * k / x) * j0 - jm1 : 0;
    jm1 = j0; j0 = j1;
  }
  return j0;
}

const LUT_SIZE = 512;
const LUT_MAX  = 14.0;
const BESSEL_LUT: Float32Array[] = [];
function buildLUT() {
  for (let n = 0; n <= 6; n++) {
    const lut = new Float32Array(LUT_SIZE);
    for (let i = 0; i < LUT_SIZE; i++) {
      lut[i] = besselJ(n, i * LUT_MAX / LUT_SIZE);
    }
    BESSEL_LUT[n] = lut;
  }
}
buildLUT();
function jLUT(n: number, x: number): number {
  const i = Math.min(LUT_SIZE - 1, Math.floor(Math.abs(x) / LUT_MAX * LUT_SIZE));
  return BESSEL_LUT[Math.min(6, n)][i];
}

// ── Mode catalogue: [angular order n, first Bessel zero znm] ──────────────────
const MODES: [number, number][] = [
  [1, 3.8317],
  [2, 5.1356],
  [0, 5.5201],
  [3, 6.3802],
  [1, 7.0156],
  [4, 7.5883],
  [2, 8.4172],
  [0, 8.6537],
  [5, 8.7715],
  [3, 9.7610],
];

const OMEGA = [0.048, 0.075, 0.119];

const W_SIM = 320, H_SIM = 240;

// Per chapter: [plateR,plateG,plateB, warmR,warmG,warmB, coolR,coolG,coolB, nodalR,nodalG,nodalB]
const CHROMA: number[][] = [
  [  8,  7, 10,  210, 165,  72,   28,  48, 105,  238, 228, 205],
  [ 10,  8,  8,  175,  90,  42,   42,  95, 115,  225, 210, 195],
  [  7,  9, 10,   85, 145, 130,  105,  42,  78,  215, 225, 230],
  [  6,  6,  8,  188, 185, 178,   32,  50,  88,  245, 242, 238],
];

// ── Module-level mutable state (reset in setup) ────────────────────────────────
let tau_C    = [0, 0, 0];
let frames_C = 0;
let offscreen_C:  HTMLCanvasElement | null = null;
let offCtx_C:     CanvasRenderingContext2D | null = null;
let imgData_C:    ImageData | null = null;

export const chladniScene = (p: any) => {
  let W = 0, H = 0;

  // ── Audio impact variables ──────────────────────────────────────────────────
  let kickImpact  = 0;
  let snareImpact = 0;
  let hihatImpact = 0;
  let clapImpact  = 0;
  let bassImpact  = 0;
  let dubImpact   = 0;
  const smpImpact = [0, 0, 0, 0];

  visualEvents.length = 0;

  p.setup = () => {
    tau_C    = [0, 0, 0];
    frames_C = 0;
    kickImpact = snareImpact = hihatImpact = clapImpact = bassImpact = dubImpact = 0;
    smpImpact.fill(0);

    const _par = p.canvas?.parentElement;
    W = _par ? _par.clientWidth  : p.windowWidth;
    H = _par ? _par.clientHeight : p.windowHeight;
    const cnv = p.createCanvas(W, H);
    (cnv as unknown as {style:(k:string,v:string)=>void}).style("display","block");
    p.pixelDensity(1);
    p.colorMode(p.RGB, 255, 255, 255, 255);
    p.background(8, 7, 10);

    offscreen_C         = document.createElement("canvas");
    offscreen_C.width   = W_SIM;
    offscreen_C.height  = H_SIM;
    offCtx_C            = offscreen_C.getContext("2d") as CanvasRenderingContext2D;
    imgData_C           = offCtx_C.createImageData(W_SIM, H_SIM);
  };

  p.windowResized = () => {
    const _par = p.canvas?.parentElement;
    W = _par ? _par.clientWidth  : p.windowWidth;
    H = _par ? _par.clientHeight : p.windowHeight;
    p.resizeCanvas(W, H);
  };

  p.draw = () => {
    if (!offscreen_C || !offCtx_C || !imgData_C) return;

    // ── Consume audio events ────────────────────────────────────────────────
    const now = getAudioTime();
    for (let i = visualEvents.length - 1; i >= 0; i--) {
      const ev = visualEvents[i];
      if (now >= ev.time) {
        if (ev.type === 'KICK')   kickImpact  = 1.0;
        if (ev.type === 'SNARE')  snareImpact = 1.0;
        if (ev.type === 'HIHAT')  hihatImpact = 1.0;
        if (ev.type === 'CLAP')   clapImpact  = 1.0;
        if (ev.type === 'BASS')   bassImpact  = 1.0;
        if (ev.type === 'DUB')    dubImpact   = 1.0;
        if (ev.type === 'SAMPLE' && ev.param !== undefined && ev.param >= 0 && ev.param <= 3)
          smpImpact[ev.param as number] = 1.0;
        visualEvents.splice(i, 1);
      }
    }

    // ── Decay impacts ───────────────────────────────────────────────────────
    kickImpact  = p.lerp(kickImpact,  0, 0.12);
    snareImpact = p.lerp(snareImpact, 0, 0.08);
    hihatImpact = p.lerp(hihatImpact, 0, 0.22);
    clapImpact  = p.lerp(clapImpact,  0, 0.10);
    bassImpact  = p.lerp(bassImpact,  0, 0.08);
    dubImpact   = p.lerp(dubImpact,   0, 0.05);
    for (let k = 0; k < 4; k++) smpImpact[k] = p.lerp(smpImpact[k], 0, 0.10);

    const sp = (p.millis() / 60000) % 1;

    // ── HIHAT: speed up oscillator clocks ───────────────────────────────────
    const omegaScale = 1 + hihatImpact * 3.0;
    for (let k = 0; k < 3; k++) tau_C[k] += OMEGA[k] * omegaScale;

    // ── CLAP: phase snap → momentary constructive interference ──────────────
    if (clapImpact > 0.95) { tau_C[0] = 0; tau_C[1] = 0; tau_C[2] = 0; }

    const modeF = sp * (MODES.length - 1);
    const mi0   = Math.min(MODES.length - 2, Math.floor(modeF));
    const mi1   = mi0 + 1;
    const mt    = modeF - mi0;
    const mi2   = Math.min(MODES.length - 1, mi0 + 2);
    const mi3   = Math.min(MODES.length - 1, mi0 + 4);

    const w0 = 1.0;
    const w1 = ss(0.18, 0.40, sp) * 0.58 + dubImpact * 0.55;
    const w2 = ss(0.44, 0.62, sp) * 0.34 + dubImpact * 0.38;

    const osc0 = Math.cos(tau_C[0]);
    const osc1 = Math.cos(tau_C[1]);
    const osc2 = Math.cos(tau_C[2]);

    // ── Chapter palette ─────────────────────────────────────────────────────
    const ci  = Math.min(2, Math.floor(sp * 3));
    const cn  = ci + 1;
    const ct  = Math.max(0, Math.min(1, ss(ci / 3, cn / 3, sp) * 3 - ci));
    const ch0 = CHROMA[ci], ch1 = CHROMA[Math.min(3, cn)];
    const pR = lerp(ch0[0], ch1[0], ct),  pG = lerp(ch0[1],  ch1[1],  ct), pB = lerp(ch0[2],  ch1[2],  ct);
    const wR = lerp(ch0[3], ch1[3], ct),  wG = lerp(ch0[4],  ch1[4],  ct), wB = lerp(ch0[5],  ch1[5],  ct);
    const cR = lerp(ch0[6], ch1[6], ct),  cG = lerp(ch0[7],  ch1[7],  ct), cB = lerp(ch0[8],  ch1[8],  ct);
    const nR = lerp(ch0[9], ch1[9], ct),  nG = lerp(ch0[10], ch1[10], ct), nB = lerp(ch0[11], ch1[11], ct);

    // ── BASS: pulse plate radius larger ─────────────────────────────────────
    const basePlateR = Math.min(W_SIM, H_SIM) * 0.44;
    const plateR     = basePlateR * (1 + bassImpact * 0.18);

    // ── Pixel render ────────────────────────────────────────────────────────
    const d   = imgData_C.data;
    const cx2 = W_SIM * 0.5, cy2 = H_SIM * 0.5;

    for (let j = 0; j < H_SIM; j++) {
      for (let i = 0; i < W_SIM; i++) {
        const dx = i - cx2, dy = j - cy2;
        const r  = Math.sqrt(dx*dx + dy*dy);
        const rn = r / plateR;
        const pi = (j * W_SIM + i) * 4;

        if (rn > 1.02) {
          d[pi] = pR | 0; d[pi+1] = pG | 0; d[pi+2] = pB | 0; d[pi+3] = 255;
          continue;
        }

        const theta = Math.atan2(dy, dx);

        const [n0a, z0a] = MODES[mi0];
        const [n0b, z0b] = MODES[mi1];
        const psi_a = jLUT(n0a, z0a * rn) * Math.cos(n0a * theta);
        const psi_b = jLUT(n0b, z0b * rn) * Math.cos(n0b * theta);
        const psi0  = lerp(psi_a, psi_b, mt) * osc0;

        const [n1a, z1a] = MODES[mi2];
        const psi1 = jLUT(n1a, z1a * rn) * Math.cos(n1a * theta) * osc1;

        const [n2a, z2a] = MODES[mi3];
        const psi2 = jLUT(n2a, z2a * rn) * Math.cos(n2a * theta) * osc2;

        const psi  = (w0 * psi0 + w1 * psi1 + w2 * psi2) / (w0 + w1 + w2);
        const pa   = Math.max(-1, Math.min(1, psi * 2.2));

        const posW  = Math.max(0,  pa);
        const negW  = Math.max(0, -pa);
        const nodal = Math.max(0, 1 - Math.abs(pa) * 5.5);
        const vigW  = Math.max(0, 1 - rn * rn * 0.45);

        const r4 = lerp(lerp(pR, wR, posW), cR, negW) * vigW + nR * nodal;
        const g4 = lerp(lerp(pG, wG, posW), cG, negW) * vigW + nG * nodal;
        const b4 = lerp(lerp(pB, wB, posW), cB, negW) * vigW + nB * nodal;

        d[pi]   = Math.min(255, r4) | 0;
        d[pi+1] = Math.min(255, g4) | 0;
        d[pi+2] = Math.min(255, b4) | 0;
        d[pi+3] = 255;
      }
    }
    offCtx_C.putImageData(imgData_C, 0, 0);

    const dc = p.drawingContext as CanvasRenderingContext2D;
    dc.imageSmoothingEnabled = true;
    dc.imageSmoothingQuality = "medium";

    // ── KICK: plate shake ────────────────────────────────────────────────────
    if (kickImpact > 0.005) {
      const shakeX = Math.sin(p.frameCount * 37) * kickImpact * 14;
      const shakeY = Math.cos(p.frameCount * 53) * kickImpact * 10;
      dc.save();
      dc.translate(shakeX, shakeY);
      dc.drawImage(offscreen_C, 0, 0, W, H);
      dc.restore();
    } else {
      dc.drawImage(offscreen_C, 0, 0, W, H);
    }

    // ── SNARE: hue-rotate screen blend ──────────────────────────────────────
    if (snareImpact > 0.005) {
      dc.save();
      dc.filter = `hue-rotate(${Math.round(140 * snareImpact)}deg) saturate(${(1 + snareImpact * 3.5).toFixed(2)})`;
      dc.globalAlpha = snareImpact * 0.50;
      dc.globalCompositeOperation = 'screen';
      dc.drawImage(offscreen_C, 0, 0, W, H);
      dc.filter = 'none';
      dc.restore();
    }

    // ── BASS: additive brightness pulse ─────────────────────────────────────
    if (bassImpact > 0.005) {
      dc.save();
      dc.globalCompositeOperation = 'lighter';
      dc.globalAlpha = bassImpact * 0.35;
      dc.drawImage(offscreen_C, 0, 0, W, H);
      dc.restore();
    }

    // ── SMP_00: top-left — zoom burst lighter ────────────────────────────────
    if (smpImpact[0] > 0.005) {
      dc.save();
      dc.beginPath(); dc.rect(0, 0, W/2, H/2); dc.clip();
      dc.globalCompositeOperation = 'lighter';
      dc.globalAlpha = smpImpact[0] * 0.60;
      const sc0 = 1 + smpImpact[0] * 0.42;
      dc.drawImage(offscreen_C, 0, 0, W * sc0, H * sc0);
      dc.restore();
    }
    // ── SMP_01: top-right — hue shift screen blend ───────────────────────────
    if (smpImpact[1] > 0.005) {
      dc.save();
      dc.beginPath(); dc.rect(W/2, 0, W/2, H/2); dc.clip();
      dc.filter = `hue-rotate(200deg) saturate(${(1 + smpImpact[1] * 3).toFixed(2)})`;
      dc.globalCompositeOperation = 'screen';
      dc.globalAlpha = smpImpact[1] * 0.58;
      dc.drawImage(offscreen_C, 0, 0, W, H);
      dc.filter = 'none';
      dc.restore();
    }
    // ── SMP_02: bottom-left — horizontal mirror lighter ──────────────────────
    if (smpImpact[2] > 0.005) {
      dc.save();
      dc.beginPath(); dc.rect(0, H/2, W/2, H/2); dc.clip();
      dc.globalCompositeOperation = 'lighter';
      dc.globalAlpha = smpImpact[2] * 0.52;
      dc.translate(W, 0);
      dc.scale(-1, 1);
      dc.drawImage(offscreen_C, 0, 0, W, H);
      dc.restore();
    }
    // ── SMP_03: bottom-right — 180° rotation screen blend ───────────────────
    if (smpImpact[3] > 0.005) {
      dc.save();
      dc.beginPath(); dc.rect(W/2, H/2, W/2, H/2); dc.clip();
      dc.globalCompositeOperation = 'screen';
      dc.globalAlpha = smpImpact[3] * 0.52;
      dc.translate(W, H);
      dc.scale(-1, -1);
      dc.drawImage(offscreen_C, 0, 0, W, H);
      dc.restore();
    }

    // ── Plate border ─────────────────────────────────────────────────────────
    const plateVisA = ss(0.02, 0.16, sp);
    if (plateVisA > 0.01) {
      const cx3 = W * 0.5, cy3 = H * 0.5;
      const pR3 = Math.min(W, H) * 0.44;
      dc.save();
      dc.strokeStyle = `rgba(255,255,255,${(plateVisA * 0.28).toFixed(3)})`;
      dc.lineWidth = 0.8;
      dc.setLineDash([6, 12]);
      dc.beginPath(); dc.arc(cx3, cy3, pR3, 0, TAU); dc.stroke();
      dc.setLineDash([]);
      dc.strokeStyle = `rgba(255,255,255,${(plateVisA * 0.12).toFixed(3)})`;
      dc.lineWidth = 0.5;
      dc.beginPath(); dc.moveTo(cx3-pR3, cy3); dc.lineTo(cx3+pR3, cy3); dc.stroke();
      dc.beginPath(); dc.moveTo(cx3, cy3-pR3); dc.lineTo(cx3, cy3+pR3); dc.stroke();
      dc.fillStyle = `rgba(255,255,255,${(plateVisA * 0.55).toFixed(3)})`;
      dc.beginPath(); dc.arc(cx3, cy3, 2.8, 0, TAU); dc.fill();
      dc.restore();
    }

    // ── Harmonic spectrum HUD ────────────────────────────────────────────────
    const hudA = ss(0.06, 0.20, sp);
    if (hudA > 0.01) {
      const barX = W - 100, barY = H - 88;
      const barW = 80,  barH = 68;
      const w1_  = ss(0.18, 0.40, sp) * 0.58;
      const w2_  = ss(0.44, 0.62, sp) * 0.34;
      dc.save();
      dc.fillStyle = `rgba(${pR|0},${pG|0},${pB|0},0.60)`;
      dc.fillRect(barX, barY, barW, barH);
      dc.strokeStyle = `rgba(255,255,255,${(hudA*0.18).toFixed(3)})`;
      dc.lineWidth = 0.5;
      dc.strokeRect(barX, barY, barW, barH);
      const weights   = [1.0, w1_, w2_];
      const barColors = [
        `rgba(${nR|0},${nG|0},${nB|0},`,
        `rgba(${wR|0},${wG|0},${wB|0},`,
        `rgba(${cR|0},${cG|0},${cB|0},`,
      ];
      const labels = [`n=${MODES[mi0][0]}`, `n=${MODES[mi2][0]}`, `n=${MODES[mi3][0]}`];
      const bw = barW / 4;
      for (let k = 0; k < 3; k++) {
        const bh = Math.round(weights[k] * (barH - 14));
        const bx = barX + bw * 0.6 + k * bw;
        dc.fillStyle = barColors[k] + `${(hudA * 0.80).toFixed(3)})`;
        dc.fillRect(bx, barY + barH - 10 - bh, bw * 0.65, bh);
        dc.fillStyle = `rgba(255,255,255,${(hudA*0.35).toFixed(3)})`;
        dc.font = "6px monospace";
        dc.textAlign = "center";
        dc.fillText(labels[k], bx + bw * 0.32, barY + barH - 2);
      }
      for (let k = 0; k < 3; k++) {
        const arc = tau_C[k] % TAU;
        dc.strokeStyle = barColors[k] + `${(hudA * weights[k] * 0.85).toFixed(3)})`;
        dc.lineWidth = 1.2;
        dc.beginPath(); dc.arc(barX + 8 + k*10, barY + 8, 3.5, 0, arc); dc.stroke();
      }
      dc.restore();

      p.noStroke();
      p.fill(255, 255, 255, Math.round(hudA * 70));
      p.textSize(7.5);
      p.textAlign(p.LEFT,  p.TOP);
      p.text(`ω₀ ${OMEGA[0].toFixed(3)}  ω₁ ${OMEGA[1].toFixed(3)}  ω₂ ${OMEGA[2].toFixed(3)}`, W*0.018, H*0.018);
      p.textAlign(p.RIGHT, p.TOP);
      p.text(`sp ${sp.toFixed(4)}`, W*0.982, H*0.018);
      p.textAlign(p.LEFT,  p.BOTTOM);
      p.text(`CH${Math.min(4, ci+1)} · CHLADNI`, W*0.018, H*0.982);
      p.textAlign(p.RIGHT, p.BOTTOM);
      p.text(`τ ${(frames_C%10000).toString().padStart(5,'0')}`, W*0.982, H*0.982);
    }

    // ── Equation annotation ──────────────────────────────────────────────────
    const annA = ss(0.50, 0.66, sp) * (1 - ss(0.88, 0.96, sp));
    if (annA > 0.01) {
      p.noStroke();
      p.fill(255, 255, 255, Math.round(annA * 68));
      p.textSize(7);
      p.textAlign(p.CENTER, p.BOTTOM);
      p.text("ψ(r,θ) = Jₙ(z·r/R)·cos(n·θ)·cos(ω·τ)", W*0.5, H*0.925);
      p.fill(255, 255, 255, Math.round(annA * 44));
      p.text("Ψ = Σ wₖ · ψₖ(r,θ,τ)  [superposition]", W*0.5, H*0.938);
    }

    frames_C++;
  };
};
