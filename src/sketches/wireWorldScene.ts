const ss = (a: number, b: number, t: number) => { const x=Math.max(0,Math.min(1,(t-a)/(b-a))); return x*x*(3-2*x); };

// ── WireWorld constants ────────────────────────────────────────────────────────
const GW = 100, GH = 66, GN = GW * GH;
// States: 0=empty, 1=electron head, 2=electron tail, 3=wire
let gridWW      = new Uint8Array(GN);
let gridWW_next = new Uint8Array(GN);
const pixBuf_WW = new Uint8Array(GN * 4);
let lastChWW    = -1;
let stepCount   = 0;

const CX = GW * 0.5, CY = GH * 0.5;

function wire(x: number, y: number) {
  const xi = Math.round(x), yi = Math.round(y);
  if (xi >= 0 && xi < GW && yi >= 0 && yi < GH && gridWW[yi*GW+xi] === 0)
    gridWW[yi*GW+xi] = 3;
}

function head(x: number, y: number) {
  const xi = Math.round(x), yi = Math.round(y);
  if (xi >= 0 && xi < GW && yi >= 0 && yi < GH) gridWW[yi*GW+xi] = 1;
}

function tail(x: number, y: number) {
  const xi = Math.round(x), yi = Math.round(y);
  if (xi >= 0 && xi < GW && yi >= 0 && yi < GH) gridWW[yi*GW+xi] = 2;
}

// ch1 — concentric rings
function initCircles() {
  gridWW.fill(0);
  for (const r of [9, 14, 20, 27]) {
    const steps = Math.ceil(2 * Math.PI * r * 1.3);
    for (let k = 0; k < steps; k++) {
      const θ = k / steps * 2 * Math.PI;
      wire(CX + r * Math.cos(θ), CY + r * Math.sin(θ));
    }
    // Two electrons: one at 0, one at π (opposite side of ring)
    const stepAngle = 2 * Math.PI / steps;
    for (const θ0 of [0, Math.PI]) {
      head(CX + r * Math.cos(θ0), CY + r * Math.sin(θ0));
      tail(CX + r * Math.cos(θ0 - stepAngle), CY + r * Math.sin(θ0 - stepAngle));
    }
  }
}

// ch2 — Lissajous 2:3
function initLissajous() {
  gridWW.fill(0);
  const A = GW * 0.39, B = GH * 0.39;
  const steps = 1800;
  for (let k = 0; k <= steps; k++) {
    const t = k / steps * 2 * Math.PI;
    wire(CX + A * Math.cos(2*t), CY + B * Math.sin(3*t));
  }
  const t0 = 0, tprev = (steps-1) / steps * 2 * Math.PI;
  head(CX + A * Math.cos(2*t0), CY + B * Math.sin(3*t0));
  tail(CX + A * Math.cos(2*tprev), CY + B * Math.sin(3*tprev));
  // Second electron offset by 1/3 period
  const t1 = 2 * Math.PI / 3, tp1 = t1 - 2*Math.PI/1800;
  head(CX + A * Math.cos(2*t1), CY + B * Math.sin(3*t1));
  tail(CX + A * Math.cos(2*tp1), CY + B * Math.sin(3*tp1));
}

// ch3 — 8-petal rose r = a·cos(4θ)
function initRose() {
  gridWW.fill(0);
  const a = Math.min(GW, GH) * 0.44;
  const steps = 3000;
  for (let k = 0; k <= steps; k++) {
    const θ = k / steps * 2 * Math.PI;
    const r = a * Math.cos(4 * θ);
    wire(CX + r * Math.cos(θ), CY + r * Math.sin(θ));
  }
  // 4 electrons at petal tips (θ = 0, π/4, π/2, 3π/4)
  for (let p = 0; p < 4; p++) {
    const θh = p * Math.PI / 4;
    const rh = a * Math.cos(4 * θh);
    head(CX + rh * Math.cos(θh), CY + rh * Math.sin(θh));
    const θt = θh - 2 * Math.PI / steps;
    const rt = a * Math.cos(4 * θt);
    tail(CX + rt * Math.cos(θt), CY + rt * Math.sin(θt));
  }
}

// ch4 — hypocycloid (astroid-like, R=28, r=7)
function initHypocycloid() {
  gridWW.fill(0);
  const R = 28, r = 7;
  const steps = 2500;
  for (let k = 0; k <= steps; k++) {
    const t = k / steps * 2 * Math.PI;
    const x = CX + (R-r)*Math.cos(t) + r*Math.cos((R-r)/r*t);
    const y = CY + (R-r)*Math.sin(t) - r*Math.sin((R-r)/r*t);
    wire(x, y);
  }
  const t0 = 0, tprev = (steps-1)/steps*2*Math.PI;
  head(CX + (R-r)*Math.cos(t0)      + r*Math.cos((R-r)/r*t0),
       CY + (R-r)*Math.sin(t0)      - r*Math.sin((R-r)/r*t0));
  tail(CX + (R-r)*Math.cos(tprev)   + r*Math.cos((R-r)/r*tprev),
       CY + (R-r)*Math.sin(tprev)   - r*Math.sin((R-r)/r*tprev));
}

const INIT_FNS = [initCircles, initLissajous, initRose, initHypocycloid];

// ── CA step ────────────────────────────────────────────────────────────────────
function stepWW() {
  gridWW_next.set(gridWW);
  for (let y = 0; y < GH; y++) {
    for (let x = 0; x < GW; x++) {
      const idx = y*GW+x, s = gridWW[idx];
      if (s === 0) continue;
      if (s === 1) { gridWW_next[idx] = 2; continue; }
      if (s === 2) { gridWW_next[idx] = 3; continue; }
      // s === 3: count adjacent heads (8-connected, periodic boundary)
      let hc = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = (y+dy+GH) % GH;
        for (let dx2 = -1; dx2 <= 1; dx2++) {
          if (dy===0 && dx2===0) continue;
          if (gridWW[ny*GW + (x+dx2+GW)%GW] === 1) hc++;
        }
      }
      gridWW_next[idx] = (hc === 1 || hc === 2) ? 1 : 3;
    }
  }
  const tmp = gridWW; gridWW = gridWW_next; gridWW_next = tmp;
  stepCount++;
}

// Per-chapter: [empty, head, tail, wire] as RGB
const CH_PALS_WW: [[number,number,number],[number,number,number],[number,number,number],[number,number,number]][] = [
  [[2,2,10], [255,255,220], [30,50,200], [100,70,30]],
  [[6,2,10], [255,220,80], [220,70,20], [90,50,100]],
  [[2,8,2],  [180,255,80], [40,200,60], [20,60,20]],
  [[8,2,10], [220,80,255], [80,20,210], [50,20,70]],
];
const CH_NAMES_WW = ["ORBITAL","LISSAJOUS","ROSE","ASTROID"];

function renderWW(chIdx: number) {
  const [bg,hd,tl,wr] = CH_PALS_WW[chIdx];
  for (let idx = 0; idx < GN; idx++) {
    const pi = idx*4, s = gridWW[idx];
    const c = s===0?bg : s===1?hd : s===2?tl : wr;
    pixBuf_WW[pi]=c[0]; pixBuf_WW[pi+1]=c[1]; pixBuf_WW[pi+2]=c[2]; pixBuf_WW[pi+3]=255;
  }
}

// ── Sketch ─────────────────────────────────────────────────────────────────────
export const wireWorldScene = (p: any) => {
  let W = 0, H = 0;
  let offscreen: HTMLCanvasElement, offCtx: CanvasRenderingContext2D, offImg: ImageData;

  p.setup = () => {
    lastChWW = -1; stepCount = 0;
    INIT_FNS[0]();

    const _par = p.canvas?.parentElement;
    W = _par ? _par.clientWidth : p.windowWidth;
    H = _par ? _par.clientHeight : p.windowHeight;
    const cnv = p.createCanvas(W, H);
    (cnv as unknown as {style:(k:string,v:string)=>void}).style("display","block");
    p.pixelDensity(1);
    offscreen = document.createElement("canvas");
    offscreen.width = GW; offscreen.height = GH;
    offCtx = offscreen.getContext("2d") as CanvasRenderingContext2D;
    offImg = offCtx.createImageData(GW, GH);
    lastChWW = 0;
    renderWW(0);
  };

  p.windowResized = () => {
    const _par = p.canvas?.parentElement;
    W = _par ? _par.clientWidth : p.windowWidth;
    H = _par ? _par.clientHeight : p.windowHeight;
    p.resizeCanvas(W, H);
  };

  p.draw = () => {
    const sp = (p.millis() / 60000) % 1;
    const chF = sp*4, chIdx = Math.min(3, Math.floor(chF));

    if (chIdx !== lastChWW) {
      INIT_FNS[chIdx]();
      stepCount = 0;
      lastChWW = chIdx;
    }

    // 2 CA steps per frame
    stepWW(); stepWW();
    renderWW(chIdx);

    offImg.data.set(pixBuf_WW);
    offCtx.putImageData(offImg, 0, 0);
    const dc = p.drawingContext as CanvasRenderingContext2D;
    dc.imageSmoothingEnabled = false;
    dc.drawImage(offscreen, 0, 0, W, H);

    // Additive glow on each electron head
    const [,hd,,] = CH_PALS_WW[chIdx];
    const glowR = W / GW * 3.5;
    dc.globalCompositeOperation = "lighter";
    for (let gy = 0; gy < GH; gy++) {
      for (let gx = 0; gx < GW; gx++) {
        if (gridWW[gy*GW+gx] === 1) {
          const pcx = (gx + 0.5) / GW * W;
          const pcy = (gy + 0.5) / GH * H;
          const grd = dc.createRadialGradient(pcx, pcy, 0, pcx, pcy, glowR);
          grd.addColorStop(0, `rgba(${hd[0]},${hd[1]},${hd[2]},0.50)`);
          grd.addColorStop(1, "rgba(0,0,0,0)");
          dc.fillStyle = grd;
          dc.fillRect(pcx - glowR, pcy - glowR, glowR*2, glowR*2);
        }
      }
    }
    dc.globalCompositeOperation = "source-over";

    const hudA = ss(0.04, 0.16, sp);
    if (hudA > 0.01) {
      const [,hd2,,] = CH_PALS_WW[chIdx];
      p.noStroke();
      p.fill(hd2[0], hd2[1], hd2[2], Math.round(hudA * 40));
      p.textSize(7);
      p.textAlign(p.LEFT, p.TOP);
      p.text(`step ${stepCount}`, W*0.018, H*0.018);
      p.textAlign(p.RIGHT, p.TOP);
      p.text(`sp ${sp.toFixed(4)}`, W*0.982, H*0.018);
      p.textAlign(p.LEFT, p.BOTTOM);
      p.text(`CH${chIdx+1} · ${CH_NAMES_WW[chIdx]}`, W*0.018, H*0.982);
      p.textAlign(p.RIGHT, p.BOTTOM);
      p.text(`${GW}×${GH}`, W*0.982, H*0.982);
    }
  };
};
