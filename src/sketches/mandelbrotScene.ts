import { getAudioTime, visualEvents } from '../lib/audio';

const ss   = (a: number, b: number, t: number) => { const x=Math.max(0,Math.min(1,(t-a)/(b-a))); return x*x*(3-2*x); };
const lerp = (a: number, b: number, t: number) => a+(b-a)*t;

// ── Mandelbrot constants ───────────────────────────────────────────────────────
const W_M = 200, H_M = 133, N_M = W_M * H_M;
const MAX_ITER = 200;
const BAIL_OUT2 = 4.0;

// Zoom journey keyframes: [cx, cy, extent]
const KEY_FRAMES: [number, number, number][] = [
  [-0.500,    0.0000,  1.80],
  [-0.750,    0.1000,  0.35],
  [-0.7470,   0.1015,  0.022],
  [-0.7269,   0.1889,  0.003],
  [-0.7269,   0.1889,  0.0003],
];

function viewFromSp(sp: number): [number, number, number] {
  const t = sp * (KEY_FRAMES.length - 1);
  const i = Math.min(KEY_FRAMES.length - 2, Math.floor(t));
  const f = t - i;
  const sf = ss(0, 1, f);
  const [cx0, cy0, e0] = KEY_FRAMES[i];
  const [cx1, cy1, e1] = KEY_FRAMES[i+1];
  return [lerp(cx0, cx1, sf), lerp(cy0, cy1, sf), Math.exp(lerp(Math.log(e0), Math.log(e1), sf))];
}

const CH_HUE_OFFSET = [0.00, 0.20, 0.45, 0.65];
const CH_NAMES_M = ["MANDELBROT","SEAHORSE","DEPTH","EMBEDDED"];

function hsvToRgb255(h: number, s: number, v: number): [number,number,number] {
  const hi = (h * 6) | 0;
  const f = h * 6 - hi, p = v*(1-s), q = v*(1-f*s), t2 = v*(1-(1-f)*s);
  switch (hi % 6) {
    case 0: return [v*255|0, t2*255|0, p*255|0];
    case 1: return [q*255|0, v*255|0, p*255|0];
    case 2: return [p*255|0, v*255|0, t2*255|0];
    case 3: return [p*255|0, q*255|0, v*255|0];
    case 4: return [t2*255|0, p*255|0, v*255|0];
    default: return [v*255|0, p*255|0, q*255|0];
  }
}

// ── Mandelbrot pixel buffer ────────────────────────────────────────────────────
const pixBuf_M = new Uint8Array(N_M * 4);
let lastComputedSp_M = -99;

function computeMandelbrot(sp: number) {
  const chF = sp * 4, chIdx = Math.min(3, Math.floor(chF));
  const [cx, cy, extent] = viewFromSp(sp);
  const hueOff = CH_HUE_OFFSET[chIdx];

  const scaleX = extent * 2 / W_M;
  const scaleY = extent * 2 / H_M;

  for (let py = 0; py < H_M; py++) {
    const ci = cy - extent + (py + 0.5) * scaleY;
    for (let px = 0; px < W_M; px++) {
      const cr = cx - extent + (px + 0.5) * scaleX;
      let zr = 0, zi = 0;
      let iter = 0;
      while (iter < MAX_ITER) {
        const zr2 = zr*zr, zi2 = zi*zi;
        if (zr2 + zi2 > BAIL_OUT2) break;
        zi = 2*zr*zi + ci;
        zr = zr2 - zi2 + cr;
        iter++;
      }

      const pi = (py * W_M + px) * 4;
      if (iter === MAX_ITER) {
        pixBuf_M[pi] = 2; pixBuf_M[pi+1] = 2; pixBuf_M[pi+2] = 4; pixBuf_M[pi+3] = 255;
      } else {
        const zr2 = zr*zr, zi2 = zi*zi;
        const logZn = Math.log(zr2 + zi2) * 0.5;
        const nu = Math.log(logZn / Math.LN2) / Math.LN2;
        const smoothIter = iter + 1 - nu;
        const hue = ((smoothIter * 0.04 + hueOff) % 1.0 + 1.0) % 1.0;
        const val = 0.65 + 0.35 * Math.sin(smoothIter * 0.08 * Math.PI);
        const [r, g, b] = hsvToRgb255(hue, 0.88, val);
        pixBuf_M[pi] = r; pixBuf_M[pi+1] = g; pixBuf_M[pi+2] = b; pixBuf_M[pi+3] = 255;
      }
    }
  }
}

// ── Julia companion buffer ─────────────────────────────────────────────────────
const W_J = 72, H_J = 48, N_J = W_J * H_J;
const MAX_ITER_J = 100;
const pixBuf_J = new Uint8Array(N_J * 4);

function computeJulia(cx: number, cy: number, hueOff: number) {
  const ext = 1.6;
  const scX = ext * 2 / W_J;
  const scY = ext * 2 / H_J;

  for (let py = 0; py < H_J; py++) {
    const zi0 = -ext + (py + 0.5) * scY;
    for (let px = 0; px < W_J; px++) {
      let zr = -ext + (px + 0.5) * scX;
      let zi = zi0;
      let iter = 0;
      while (iter < MAX_ITER_J) {
        const zr2 = zr*zr, zi2 = zi*zi;
        if (zr2 + zi2 > BAIL_OUT2) break;
        zi = 2*zr*zi + cy;
        zr = zr2 - zi2 + cx;
        iter++;
      }
      const pi = (py * W_J + px) * 4;
      if (iter === MAX_ITER_J) {
        pixBuf_J[pi] = 2; pixBuf_J[pi+1] = 2; pixBuf_J[pi+2] = 4; pixBuf_J[pi+3] = 255;
      } else {
        const zr2 = zr*zr, zi2 = zi*zi;
        const logZn = Math.log(zr2 + zi2) * 0.5;
        const nu = Math.log(logZn / Math.LN2) / Math.LN2;
        const smoothIter = iter + 1 - nu;
        const hue = ((smoothIter * 0.04 + hueOff) % 1.0 + 1.0) % 1.0;
        const val = 0.65 + 0.35 * Math.sin(smoothIter * 0.08 * Math.PI);
        const [r, g, b] = hsvToRgb255(hue, 0.88, val);
        pixBuf_J[pi] = r; pixBuf_J[pi+1] = g; pixBuf_J[pi+2] = b; pixBuf_J[pi+3] = 255;
      }
    }
  }
}

// ── Sketch ─────────────────────────────────────────────────────────────────────
export const mandelbrotScene = (p: any) => {
  let W = 0, H = 0;
  let offscreen: HTMLCanvasElement, offCtx: CanvasRenderingContext2D, offImg: ImageData;
  let offJ: HTMLCanvasElement, offCtxJ: CanvasRenderingContext2D, offImgJ: ImageData;

  // ── Audio impact variables ──────────────────────────────────────────────────
  let kickImpact   = 0;
  let snareImpact  = 0;
  let hihatImpact  = 0;
  let clapImpact   = 0;
  let bassImpact   = 0;
  let dubImpact    = 0;
  const smpImpact  = [0, 0, 0, 0];

  // Clear stale events from previous scene loads
  visualEvents.length = 0;

  function drawRotated90(dc: CanvasRenderingContext2D, src: HTMLCanvasElement, dx: number, dy: number, dw: number, dh: number) {
    dc.save();
    dc.translate(dx + dw * 0.5, dy + dh * 0.5);
    dc.rotate(Math.PI * 0.5);
    dc.drawImage(src, -dw * 0.5, -dh * 0.5, dw, dh);
    dc.restore();
  }

  p.setup = () => {
    lastComputedSp_M = -99;
    pixBuf_M.fill(0);
    pixBuf_J.fill(0);

    const _par = p.canvas?.parentElement;
    W = _par ? _par.clientWidth  : p.windowWidth;
    H = _par ? _par.clientHeight : p.windowHeight;
    const cnv = p.createCanvas(W, H);
    (cnv as unknown as {style:(k:string,v:string)=>void}).style("display","block");
    p.pixelDensity(1);

    offscreen = document.createElement("canvas");
    offscreen.width = W_M; offscreen.height = H_M;
    offCtx = offscreen.getContext("2d") as CanvasRenderingContext2D;
    offImg = offCtx.createImageData(W_M, H_M);

    offJ = document.createElement("canvas");
    offJ.width = W_J; offJ.height = H_J;
    offCtxJ = offJ.getContext("2d") as CanvasRenderingContext2D;
    offImgJ = offCtxJ.createImageData(W_J, H_J);

    computeMandelbrot(0);
    const [cx0, cy0] = viewFromSp(0);
    computeJulia(cx0, cy0, CH_HUE_OFFSET[0]);
    lastComputedSp_M = 0;
  };

  p.windowResized = () => {
    const _par = p.canvas?.parentElement;
    W = _par ? _par.clientWidth  : p.windowWidth;
    H = _par ? _par.clientHeight : p.windowHeight;
    p.resizeCanvas(W, H);
  };

  p.draw = () => {
    // ── Consume audio events ────────────────────────────────────────────────
    const now = getAudioTime();
    for (let i = visualEvents.length - 1; i >= 0; i--) {
      const ev = visualEvents[i];
      if (now >= ev.time) {
        if (ev.type === 'KICK')  kickImpact  = 1.0;
        if (ev.type === 'SNARE') snareImpact = 1.0;
        if (ev.type === 'HIHAT') hihatImpact = 1.0;
        if (ev.type === 'CLAP')  clapImpact  = 1.0;
        if (ev.type === 'BASS')  bassImpact  = 1.0;
        if (ev.type === 'DUB')   dubImpact   = 1.0;
        if (ev.type === 'SAMPLE' && ev.param !== undefined && ev.param >= 0 && ev.param <= 3) {
          smpImpact[ev.param as number] = 1.0;
        }
        visualEvents.splice(i, 1);
      }
    }

    // ── Decay impacts ───────────────────────────────────────────────────────
    kickImpact   = p.lerp(kickImpact,   0, 0.12);
    snareImpact  = p.lerp(snareImpact,  0, 0.08);
    hihatImpact  = p.lerp(hihatImpact,  0, 0.22);
    clapImpact   = p.lerp(clapImpact,   0, 0.10);
    bassImpact   = p.lerp(bassImpact,   0, 0.08);
    dubImpact    = p.lerp(dubImpact,    0, 0.05);
    for (let k = 0; k < 4; k++) {
      smpImpact[k] = p.lerp(smpImpact[k], 0, 0.10);
    }

    const sp = (p.millis() / 60000) % 1;
    const chF = sp*4, chIdx = Math.min(3, Math.floor(chF));

    if (Math.abs(sp - lastComputedSp_M) > 0.0022) {
      computeMandelbrot(sp);
      const [cx, cy] = viewFromSp(sp);
      computeJulia(cx, cy, CH_HUE_OFFSET[chIdx]);
      lastComputedSp_M = sp;
    }

    // Main Mandelbrot render
    offImg.data.set(pixBuf_M);
    offCtx.putImageData(offImg, 0, 0);
    const dc = p.drawingContext as CanvasRenderingContext2D;
    dc.imageSmoothingEnabled = true;
    dc.imageSmoothingQuality = "high";

    // ── KICK: canvas shake — translate before drawing, restore after ────────
    if (kickImpact > 0.005) {
      const shakeX = Math.sin(p.frameCount * 37) * kickImpact * 8;
      const shakeY = Math.cos(p.frameCount * 53) * kickImpact * 6;
      dc.save();
      dc.translate(shakeX, shakeY);
      drawRotated90(dc, offscreen, 0, 0, W, H);
      dc.restore();
    } else {
      drawRotated90(dc, offscreen, 0, 0, W, H);
    }

    // ── BASS: additive brightness wash ──────────────────────────────────────
    if (bassImpact > 0.005) {
      dc.save();
      dc.globalCompositeOperation = 'lighter';
      dc.globalAlpha = bassImpact * 0.4;
      drawRotated90(dc, offscreen, 0, 0, W, H);
      dc.restore();
    }

    // ── HIHAT: chromatic smear ───────────────────────────────────────────────
    if (hihatImpact > 0.005) {
      const hihatShift = hihatImpact * 6;
      dc.save();
      dc.globalCompositeOperation = 'screen';
      dc.globalAlpha = hihatImpact * 0.25;
      drawRotated90(dc, offscreen, hihatShift, 0, W, H);
      drawRotated90(dc, offscreen, -hihatShift, 0, W, H);
      dc.restore();
    }

    // ── CLAP: scale burst ────────────────────────────────────────────────────
    if (clapImpact > 0.005) {
      const sc = 1 + clapImpact * 0.06;
      dc.save();
      dc.globalAlpha = 0.7;
      drawRotated90(dc, offscreen, -W*(sc-1)/2, -H*(sc-1)/2, W*sc, H*sc);
      dc.restore();
    }

    // ── SNARE: hue-rotate screen blend ──────────────────────────────────────
    if (snareImpact > 0.005) {
      dc.save();
      dc.filter = `hue-rotate(${Math.round(180 * snareImpact)}deg) saturate(${(1 + snareImpact * 4).toFixed(2)})`;
      dc.globalAlpha = snareImpact * 0.55;
      dc.globalCompositeOperation = 'screen';
      drawRotated90(dc, offscreen, 0, 0, W, H);
      dc.filter = 'none';
      dc.restore();
    }

    // ── DUB: edge vignette ───────────────────────────────────────────────────
    if (dubImpact > 0.005) {
      const vgR = dc.createRadialGradient(W/2, H/2, W*0.3, W/2, H/2, Math.max(W,H)*0.75);
      vgR.addColorStop(0, 'rgba(0,0,0,0)');
      vgR.addColorStop(1, `rgba(0,0,0,${(dubImpact * 0.7).toFixed(3)})`);
      dc.save();
      dc.fillStyle = vgR;
      dc.fillRect(0, 0, W, H);
      dc.restore();
    }

    // ── SMP_00: top-left — zoom burst (lighter blend) ────────────────────────
    if (smpImpact[0] > 0.005) {
      dc.save();
      dc.beginPath(); dc.rect(0, 0, W/2, H/2); dc.clip();
      dc.globalCompositeOperation = 'lighter';
      dc.globalAlpha = smpImpact[0] * 0.6;
      const sc0 = 1 + smpImpact[0] * 0.45;
      drawRotated90(dc, offscreen, 0, 0, W * sc0, H * sc0);
      dc.restore();
    }
    // ── SMP_01: top-right — hue shift + screen blend ─────────────────────────
    if (smpImpact[1] > 0.005) {
      dc.save();
      dc.beginPath(); dc.rect(W/2, 0, W/2, H/2); dc.clip();
      dc.filter = `hue-rotate(240deg) saturate(${(1 + smpImpact[1] * 3).toFixed(2)})`;
      dc.globalCompositeOperation = 'screen';
      dc.globalAlpha = smpImpact[1] * 0.6;
      drawRotated90(dc, offscreen, 0, 0, W, H);
      dc.filter = 'none';
      dc.restore();
    }
    // ── SMP_02: bottom-left — horizontal mirror lighter blend ─────────────────
    if (smpImpact[2] > 0.005) {
      dc.save();
      dc.beginPath(); dc.rect(0, H/2, W/2, H/2); dc.clip();
      dc.globalCompositeOperation = 'lighter';
      dc.globalAlpha = smpImpact[2] * 0.55;
      drawRotated90(dc, offscreen, 0, 0, W, H);
      dc.restore();
    }
    // ── SMP_03: bottom-right — 180° rotation screen blend ────────────────────
    if (smpImpact[3] > 0.005) {
      dc.save();
      dc.beginPath(); dc.rect(W/2, H/2, W/2, H/2); dc.clip();
      dc.globalCompositeOperation = 'screen';
      dc.globalAlpha = smpImpact[3] * 0.55;
      drawRotated90(dc, offscreen, 0, 0, W, H);
      dc.restore();
    }

    // Crosshair at viewport center — pulse size with kick
    const crossA = ss(0.02, 0.14, sp) * (1 - ss(0.86, 0.94, sp));
    if (crossA > 0.01) {
      const crossSize = 10 + kickImpact * 8;
      dc.strokeStyle = `rgba(255,255,255,${(crossA * 0.25).toFixed(2)})`;
      dc.lineWidth = 0.6;
      dc.beginPath(); dc.moveTo(W*0.5-crossSize, H*0.5); dc.lineTo(W*0.5+crossSize, H*0.5); dc.stroke();
      dc.beginPath(); dc.moveTo(W*0.5, H*0.5-crossSize); dc.lineTo(W*0.5, H*0.5+crossSize); dc.stroke();
    }

    // Julia companion PiP: J(c) for current viewport center c
    const jupA = ss(0.06, 0.22, sp);
    if (jupA > 0.01) {
      offImgJ.data.set(pixBuf_J);
      offCtxJ.putImageData(offImgJ, 0, 0);
      const pw = 80, ph = 54;
      const pxPos = W * 0.5 - pw * 0.5;
      const pyPos = H * 0.90 - ph;
      dc.save();
      dc.globalAlpha = jupA * 0.88;
      dc.imageSmoothingEnabled = true;
      dc.imageSmoothingQuality = "high";
      dc.drawImage(offJ, pxPos, pyPos, pw, ph);
      dc.globalAlpha = jupA * 0.55;
      dc.strokeStyle = "rgba(255,255,255,0.8)";
      dc.lineWidth = 0.5;
      dc.strokeRect(pxPos, pyPos, pw, ph);
      dc.globalAlpha = jupA * 0.50;
      dc.fillStyle = "rgba(180,180,210,1)";
      dc.font = "5.5px Arial, 'Helvetica Neue', sans-serif";
      dc.textAlign = "center";
      dc.fillText("J(c)", W * 0.5, pyPos - 2.5);
      dc.restore();
    }

    // HUD
    const hudA = ss(0.04, 0.16, sp);
    if (hudA > 0.01) {
      const [cx, cy, extent] = viewFromSp(sp);
      const zoom = (1.8 / extent).toFixed(0);
      const hueOff = CH_HUE_OFFSET[chIdx];
      const [hr,hg,hb] = hsvToRgb255((hueOff + 0.55) % 1, 0.7, 0.88);
      p.noStroke();
      p.fill(hr, hg, hb, Math.round(hudA * 50));
      p.textSize(7);
      p.textAlign(p.LEFT, p.TOP);
      p.text(`${zoom}× zoom`, W*0.018, H*0.018);
      p.textAlign(p.RIGHT, p.TOP);
      p.text(`sp ${sp.toFixed(4)}`, W*0.982, H*0.018);
      p.textAlign(p.LEFT, p.BOTTOM);
      p.text(`CH${chIdx+1} · MANDELBROT`, W*0.018, H*0.982);
      p.textAlign(p.RIGHT, p.BOTTOM);
      p.text(`(${cx.toFixed(6)}, ${cy.toFixed(6)})`, W*0.982, H*0.982);
    }
  };
};
