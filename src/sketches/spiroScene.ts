const TAU = Math.PI * 2;

function ss(a: number, b: number, t: number) {
  const x = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
}

const CH_BG: [number, number, number][] = [
  [4, 3, 8],
  [3, 7, 4],
  [8, 4, 2],
  [2, 4, 12],
];

// ── Rose: r = cos(k·θ) ───────────────────────────────────────────────────────
const ROSE_L = [
  { k: 3,   hue: 280, alpha: 0.65, lw: 1.4 },
  { k: 5,   hue: 318, alpha: 0.48, lw: 1.1 },
  { k: 7,   hue: 255, alpha: 0.34, lw: 0.9 },
  { k: 2/3, hue: 302, alpha: 0.44, lw: 1.1 },
];
const ROSE_T = 6 * Math.PI;

// ── Lissajous: x=sin(at+δ), y=sin(bt) ───────────────────────────────────────
const LISSA_L = [
  { a: 3, b: 2, d: Math.PI * 0.25, hue: 150, alpha: 0.65, lw: 1.3 },
  { a: 5, b: 4, d: Math.PI * 0.50, hue: 185, alpha: 0.48, lw: 1.0 },
  { a: 7, b: 5, d: Math.PI * 0.33, hue: 165, alpha: 0.36, lw: 0.9 },
  { a: 2, b: 1, d: Math.PI * 0.70, hue: 140, alpha: 0.44, lw: 1.1 },
];
const LISSA_T = TAU * 5;

// ── Hypotrochoid: (R-r)cosT + d·cos((R-r)/r·T) ──────────────────────────────
const HYPOT_L = [
  { R: 5, r: 3, d: 4.8, hue: 28, alpha: 0.65, lw: 1.3 },
  { R: 7, r: 3, d: 5.5, hue: 48, alpha: 0.46, lw: 1.0 },
  { R: 5, r: 2, d: 3.5, hue: 16, alpha: 0.38, lw: 0.9 },
  { R: 8, r: 5, d: 2.5, hue: 44, alpha: 0.43, lw: 1.1 },
];
const HYPOT_T = TAU * 5;

// ── Superformula (Gielis): r = (|cos(mθ/4)|^n2 + |sin(mθ/4)|^n3)^(-1/n1) ───
const SUPER_L = [
  { m: 6, n1: 1, n2: 1,   n3: 1,   hue: 200, alpha: 0.65, lw: 1.4 },
  { m: 8, n1: 1, n2: 1,   n3: 1,   hue: 220, alpha: 0.48, lw: 1.1 },
  { m: 5, n1: 2, n2: 7,   n3: 7,   hue: 185, alpha: 0.36, lw: 0.9 },
  { m: 3, n1: 1, n2: 1,   n3: 1,   hue: 210, alpha: 0.44, lw: 1.2 },
];
const SUPER_T = TAU;

const TOTAL_T_S = [ROSE_T, LISSA_T, HYPOT_T, SUPER_T];

function superR(theta: number, m: number, n1: number, n2: number, n3: number) {
  const t = m * theta / 4;
  const v = Math.pow(Math.abs(Math.cos(t)), n2) + Math.pow(Math.abs(Math.sin(t)), n3);
  return v === 0 ? 0 : Math.pow(v, -1 / n1);
}

// ── Module-level drawing state ───────────────────────────────────────────────
let lastTArr_S = [0, 0, 0, 0];
let lastCh_S = -1;
let off_S: HTMLCanvasElement | null = null;
let offCtx_S: CanvasRenderingContext2D | null = null;
let W_S = 0, H_S = 0;

function segPts(dt: number) { return Math.min(600, Math.max(2, Math.ceil(dt / 0.008))); }

function drawDelta_S(chIdx: number, cx: number, cy: number, R: number, t0: number, t1: number) {
  const oc = offCtx_S!;
  const n = segPts(t1 - t0);
  oc.lineCap = "round";
  oc.lineJoin = "round";

  if (chIdx === 0) {
    for (const l of ROSE_L) {
      oc.beginPath();
      oc.strokeStyle = `hsla(${l.hue},80%,65%,${l.alpha})`;
      oc.lineWidth = l.lw;
      let first = true;
      for (let i = 0; i <= n; i++) {
        const t = t0 + (t1 - t0) * i / n;
        const r = Math.cos(l.k * t) * R;
        const x = cx + r * Math.cos(t), y = cy + r * Math.sin(t);
        first ? (oc.moveTo(x, y), first = false) : oc.lineTo(x, y);
      }
      oc.stroke();
    }
  } else if (chIdx === 1) {
    for (const l of LISSA_L) {
      oc.beginPath();
      oc.strokeStyle = `hsla(${l.hue},85%,62%,${l.alpha})`;
      oc.lineWidth = l.lw;
      let first = true;
      for (let i = 0; i <= n; i++) {
        const t = t0 + (t1 - t0) * i / n;
        const x = cx + Math.sin(l.a * t + l.d) * R * 0.88;
        const y = cy + Math.sin(l.b * t) * R * 0.72;
        first ? (oc.moveTo(x, y), first = false) : oc.lineTo(x, y);
      }
      oc.stroke();
    }
  } else if (chIdx === 2) {
    for (const l of HYPOT_L) {
      const sc = R / l.R;
      oc.beginPath();
      oc.strokeStyle = `hsla(${l.hue},85%,60%,${l.alpha})`;
      oc.lineWidth = l.lw;
      let first = true;
      for (let i = 0; i <= n; i++) {
        const t = t0 + (t1 - t0) * i / n;
        const x = cx + sc * ((l.R - l.r) * Math.cos(t) + l.d * Math.cos((l.R - l.r) / l.r * t));
        const y = cy + sc * ((l.R - l.r) * Math.sin(t) - l.d * Math.sin((l.R - l.r) / l.r * t));
        first ? (oc.moveTo(x, y), first = false) : oc.lineTo(x, y);
      }
      oc.stroke();
    }
  } else {
    for (const l of SUPER_L) {
      oc.beginPath();
      oc.strokeStyle = `hsla(${l.hue},80%,65%,${l.alpha})`;
      oc.lineWidth = l.lw;
      let first = true;
      for (let i = 0; i <= n; i++) {
        const t = t0 + (t1 - t0) * i / n;
        const r2 = superR(t, l.m, l.n1, l.n2, l.n3) * R * 0.82;
        const x = cx + r2 * Math.cos(t), y = cy + r2 * Math.sin(t);
        first ? (oc.moveTo(x, y), first = false) : oc.lineTo(x, y);
      }
      oc.stroke();
    }
  }
}

// ── Sketch ───────────────────────────────────────────────────────────────────
export const spiroScene = (p: any) => {
  p.setup = () => {
    lastTArr_S = [0, 0, 0, 0];
    lastCh_S = -1;
    off_S = null;
    offCtx_S = null;

    const _par = p.canvas?.parentElement;
    const _w = _par ? _par.clientWidth  : p.windowWidth;
    const _h = _par ? _par.clientHeight : p.windowHeight;
    const cvs = p.createCanvas(_w, _h);
    (cvs as unknown as {style:(k:string,v:string)=>void}).style("display","block");
    p.pixelDensity(1);
    W_S = p.width; H_S = p.height;
    off_S = document.createElement("canvas");
    off_S.width = W_S; off_S.height = H_S;
    offCtx_S = off_S.getContext("2d")!;
    offCtx_S.fillStyle = `rgb(${CH_BG[0][0]},${CH_BG[0][1]},${CH_BG[0][2]})`;
    offCtx_S.fillRect(0, 0, W_S, H_S);
  };

  p.windowResized = () => {
    const _par = p.canvas?.parentElement;
    const _w = _par ? _par.clientWidth  : p.windowWidth;
    const _h = _par ? _par.clientHeight : p.windowHeight;
    p.resizeCanvas(_w, _h);
    W_S = p.width; H_S = p.height;
    if (off_S && offCtx_S) {
      off_S.width = W_S; off_S.height = H_S;
      const ch = Math.max(0, lastCh_S);
      const [r, g, b] = CH_BG[ch];
      offCtx_S.fillStyle = `rgb(${r},${g},${b})`;
      offCtx_S.fillRect(0, 0, W_S, H_S);
      lastTArr_S = [0, 0, 0, 0];
    }
  };

  p.draw = () => {
    if (!off_S || !offCtx_S) return;
    const sp = (p.millis() / 60000) % 1;
    const chF = sp * 4;
    const chIdx = Math.min(3, Math.floor(chF));
    const chT = chF - chIdx;
    const [bgR, bgG, bgB] = CH_BG[chIdx];
    const dc = p.drawingContext as CanvasRenderingContext2D;
    const cx = W_S / 2, cy = H_S / 2;
    const R = Math.min(W_S, H_S) * 0.38;

    if (chIdx !== lastCh_S) {
      offCtx_S.fillStyle = `rgb(${bgR},${bgG},${bgB})`;
      offCtx_S.fillRect(0, 0, W_S, H_S);
      lastTArr_S[chIdx] = 0;
      lastCh_S = chIdx;
    }

    offCtx_S.fillStyle = `rgba(${bgR},${bgG},${bgB},0.018)`;
    offCtx_S.fillRect(0, 0, W_S, H_S);

    const tMax = ss(0, 0.92, chT) * TOTAL_T_S[chIdx];
    const tPrev = lastTArr_S[chIdx];
    if (tMax > tPrev + 0.001) {
      drawDelta_S(chIdx, cx, cy, R, tPrev, tMax);
      lastTArr_S[chIdx] = tMax;
    }

    // Blit accumulated trail
    dc.drawImage(off_S, 0, 0, W_S, H_S);

    // Spirograph guide overlay (very faint)
    dc.save();
    dc.strokeStyle = "rgba(255,255,255,0.032)";
    dc.lineWidth = 0.5;
    for (let i = 1; i <= 4; i++) {
      dc.beginPath();
      dc.arc(cx, cy, R * i / 3.6, 0, TAU);
      dc.stroke();
    }
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      dc.beginPath();
      dc.moveTo(cx, cy);
      dc.lineTo(cx + R * 1.18 * Math.cos(a), cy + R * 1.18 * Math.sin(a));
      dc.stroke();
    }
    dc.restore();

    // Edge vignette
    dc.save();
    const vg = dc.createRadialGradient(cx, cy, R * 0.55, cx, cy, Math.max(W_S, H_S) * 0.72);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.46)");
    dc.fillStyle = vg;
    dc.fillRect(0, 0, W_S, H_S);
    dc.restore();

    // Drawing-tip cursor with glow
    const tc = lastTArr_S[chIdx];
    if (tc > 0.001) {
      let dotX = cx, dotY = cy;
      if (chIdx === 0) {
        const l = ROSE_L[0];
        const r = Math.cos(l.k * tc) * R;
        dotX = cx + r * Math.cos(tc); dotY = cy + r * Math.sin(tc);
      } else if (chIdx === 1) {
        const l = LISSA_L[0];
        dotX = cx + Math.sin(l.a * tc + l.d) * R * 0.88;
        dotY = cy + Math.sin(l.b * tc) * R * 0.72;
      } else if (chIdx === 2) {
        const l = HYPOT_L[0];
        const sc = R / l.R;
        dotX = cx + sc * ((l.R - l.r) * Math.cos(tc) + l.d * Math.cos((l.R - l.r) / l.r * tc));
        dotY = cy + sc * ((l.R - l.r) * Math.sin(tc) - l.d * Math.sin((l.R - l.r) / l.r * tc));
      } else {
        const l = SUPER_L[0];
        const r2 = superR(tc, l.m, l.n1, l.n2, l.n3) * R * 0.82;
        dotX = cx + r2 * Math.cos(tc); dotY = cy + r2 * Math.sin(tc);
      }
      const pulse = 0.55 + 0.45 * Math.sin(p.frameCount * 0.14);
      dc.save();
      const grd = dc.createRadialGradient(dotX, dotY, 0, dotX, dotY, 9);
      grd.addColorStop(0, `rgba(255,255,255,${(pulse * 0.9).toFixed(3)})`);
      grd.addColorStop(0.35, `rgba(255,255,255,${(pulse * 0.35).toFixed(3)})`);
      grd.addColorStop(1, "rgba(255,255,255,0)");
      dc.fillStyle = grd;
      dc.beginPath();
      dc.arc(dotX, dotY, 9, 0, TAU);
      dc.fill();
      dc.fillStyle = `rgba(255,255,255,${(pulse * 0.95).toFixed(3)})`;
      dc.beginPath();
      dc.arc(dotX, dotY, 2, 0, TAU);
      dc.fill();
      dc.restore();
    }

    // HUD
    const names = ["ROSE", "LISSAJOUS", "HYPOTROCHOID", "SUPERFORMULA"];
    const eqs   = ["r = cos(kθ)", "x=sin(at+δ), y=sin(bt)", "hypotrochoid R,r,d", "Gielis superformula"];
    const prog = Math.min(1, lastTArr_S[chIdx] / TOTAL_T_S[chIdx]);
    dc.save();
    dc.font = "bold 11px monospace";
    dc.fillStyle = "rgba(255,255,255,0.28)";
    dc.fillText(names[chIdx], 16, 24);
    dc.font = "10px monospace";
    dc.fillStyle = "rgba(255,255,255,0.16)";
    dc.fillText(eqs[chIdx], 16, 40);
    const bx = W_S - 96, by = H_S - 20;
    dc.fillStyle = "rgba(255,255,255,0.10)";
    dc.fillRect(bx, by, 80, 2);
    dc.fillStyle = "rgba(255,255,255,0.42)";
    dc.fillRect(bx, by, 80 * prog, 2);
    dc.restore();
  };
};
