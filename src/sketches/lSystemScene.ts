const ss = (a: number, b: number, t: number) => { const x=Math.max(0,Math.min(1,(t-a)/(b-a))); return x*x*(3-2*x); };

// ── L-system definitions ───────────────────────────────────────────────────────
interface LSystem { axiom: string; rules: Record<string,string>; angle: number; depth: number; initAngle: number; }

const L_SYSTEMS: LSystem[] = [
  { axiom: "F--F--F",  rules: { F: "F+F--F+F" }, angle: 60, depth: 4, initAngle: 0 },
  { axiom: "FX",       rules: { X: "X+YF+", Y: "-FX-Y" }, angle: 90, depth: 12, initAngle: 0 },
  { axiom: "A",        rules: { A: "+BF-AFA-FB+", B: "-AF+BFB+FA-" }, angle: 90, depth: 5, initAngle: 0 },
  { axiom: "X",        rules: { X: "F+[[X]-X]-F[-FX]+X", F: "FF" }, angle: 25, depth: 6, initAngle: -Math.PI * 0.5 },
];

function expand(axiom: string, rules: Record<string,string>, n: number): string {
  let s = axiom;
  for (let i = 0; i < n; i++) {
    const parts: string[] = [];
    for (let j = 0; j < s.length; j++) parts.push(rules[s[j]] ?? s[j]);
    s = parts.join("");
    if (s.length > 900_000) break;
  }
  return s;
}

interface LData {
  segs: Float32Array;  // [x0,y0,x1,y1, ...]
  nSegs: number;
  xMin: number; xMax: number; yMin: number; yMax: number;
}

function interpret(s: string, angleDeg: number, initAngle: number): LData {
  const da = angleDeg * Math.PI / 180;
  const x0s: number[] = [], y0s: number[] = [], x1s: number[] = [], y1s: number[] = [];
  let x = 0, y = 0, θ = initAngle;
  const stack: [number,number,number][] = [];

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === 'F' || c === 'G') {
      const nx = x + Math.cos(θ), ny = y + Math.sin(θ);
      x0s.push(x); y0s.push(y); x1s.push(nx); y1s.push(ny);
      x = nx; y = ny;
    } else if (c === '+') θ += da;
    else if (c === '-') θ -= da;
    else if (c === '[') stack.push([x, y, θ]);
    else if (c === ']') { const sv = stack.pop(); if (sv) { x=sv[0]; y=sv[1]; θ=sv[2]; } }
  }

  const n = x0s.length;
  const segs = new Float32Array(n * 4);
  let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
  for (let i = 0; i < n; i++) {
    segs[i*4]   = x0s[i]; segs[i*4+1] = y0s[i];
    segs[i*4+2] = x1s[i]; segs[i*4+3] = y1s[i];
    if (x0s[i] < xMin) xMin=x0s[i]; if (x1s[i] < xMin) xMin=x1s[i];
    if (x0s[i] > xMax) xMax=x0s[i]; if (x1s[i] > xMax) xMax=x1s[i];
    if (y0s[i] < yMin) yMin=y0s[i]; if (y1s[i] < yMin) yMin=y1s[i];
    if (y0s[i] > yMax) yMax=y0s[i]; if (y1s[i] > yMax) yMax=y1s[i];
  }
  return { segs, nSegs: n, xMin, xMax, yMin, yMax };
}

let lastChL = -1;
let currentData: LData | null = null;

const CH_GRADIENTS: [[string,string],[string,string]][] = [
  [["rgba(40,140,255,0.9)","rgba(20,60,180,0.35)"],   ["rgba(120,220,255,0.7)","rgba(20,80,160,0.2)"]],
  [["rgba(40,230,120,0.9)","rgba(20,100,50,0.35)"],    ["rgba(140,255,160,0.7)","rgba(20,100,40,0.2)"]],
  [["rgba(160,60,255,0.9)","rgba(60,10,140,0.35)"],    ["rgba(200,120,255,0.7)","rgba(60,10,130,0.2)"]],
  [["rgba(60,200,60,0.9)","rgba(20,80,10,0.35)"],      ["rgba(160,255,80,0.7)","rgba(20,80,5,0.2)"]],
];

const CH_LINE_W = [0.55, 0.45, 0.50, 0.65];
const CH_NAMES_L = ["KOCH","DRAGON","HILBERT","PLANT"];
const CH_DARK = ["#06080e","#040e06","#08040e","#040a04"];

// ── Sketch ─────────────────────────────────────────────────────────────────────
export const lSystemScene = (p: any) => {
  let W = 0, H = 0;

  p.setup = () => {
    lastChL = -1;
    currentData = null;

    W = p.windowWidth; H = p.windowHeight;
    const cnv = p.createCanvas(W, H);
    (cnv as unknown as {style:(k:string,v:string)=>void}).style("display","block");
    p.pixelDensity(1);
  };

  p.windowResized = () => { W = p.windowWidth; H = p.windowHeight; p.resizeCanvas(W, H); };

  p.draw = () => {
    const sp = (p.millis() / 60000) % 1;
    const chF = sp*4, chIdx = Math.min(3, Math.floor(chF)), chT = chF - chIdx;

    if (chIdx !== lastChL) {
      const ls = L_SYSTEMS[chIdx];
      const str = expand(ls.axiom, ls.rules, ls.depth);
      currentData = interpret(str, ls.angle, ls.initAngle);
      lastChL = chIdx;
    }

    const dark = CH_DARK[chIdx];
    const dc = p.drawingContext as CanvasRenderingContext2D;
    dc.fillStyle = dark;
    dc.fillRect(0, 0, W, H);

    if (!currentData) return;
    const { segs, nSegs, xMin, xMax, yMin, yMax } = currentData;

    const lsW = Math.max(0.001, xMax - xMin);
    const lsH = Math.max(0.001, yMax - yMin);
    const margin = 0.88;
    const scale = Math.min(W / lsW, H / lsH) * margin;
    const ox = (W - lsW * scale) * 0.5 - xMin * scale;
    const oy = (H - lsH * scale) * 0.5 - yMin * scale;

    // Progressive reveal — fully drawn by chT≈0.78
    const revealFrac = ss(0, 0.78, chT);
    const revealCount = Math.min(nSegs, Math.ceil(revealFrac * nSegs));

    // Gradient: horizontal for Koch/Dragon/Hilbert, vertical for Plant
    const [[c0, c1], [gc0, gc1]] = CH_GRADIENTS[chIdx];
    let grad: CanvasGradient;
    if (chIdx === 3) {
      grad = dc.createLinearGradient(0, H, 0, 0);
    } else {
      grad = dc.createLinearGradient(0, 0, W, H);
    }
    grad.addColorStop(0, c0); grad.addColorStop(1, c1);
    dc.strokeStyle = grad;
    dc.lineWidth = CH_LINE_W[chIdx];
    dc.lineCap = "round";

    // Main path
    dc.beginPath();
    for (let i = 0; i < revealCount; i++) {
      dc.moveTo(ox + segs[i*4] * scale, oy + segs[i*4+1] * scale);
      dc.lineTo(ox + segs[i*4+2] * scale, oy + segs[i*4+3] * scale);
    }
    dc.stroke();

    // Pulsing drawing-tip cursor on the newest revealed segments
    if (revealFrac < 0.99 && revealCount > 0) {
      const tipLen = Math.max(1, Math.min(40, Math.floor(nSegs * 0.008)));
      const tipStart = Math.max(0, revealCount - tipLen);
      const tp = 0.55 + 0.45 * Math.sin(p.frameCount * 0.18);
      dc.strokeStyle = `rgba(255,255,255,${tp.toFixed(2)})`;
      dc.lineWidth = CH_LINE_W[chIdx] * 2.2;
      dc.beginPath();
      for (let i = tipStart; i < revealCount; i++) {
        dc.moveTo(ox + segs[i*4] * scale, oy + segs[i*4+1] * scale);
        dc.lineTo(ox + segs[i*4+2] * scale, oy + segs[i*4+3] * scale);
      }
      dc.stroke();
    }

    // Faint "ghost" overlay of the full structure once 80% revealed
    const ghostA = ss(0.80, 1.0, revealFrac) * 0.18;
    if (ghostA > 0.01 && revealCount < nSegs) {
      let grad2: CanvasGradient;
      if (chIdx === 3) {
        grad2 = dc.createLinearGradient(0, H, 0, 0);
      } else {
        grad2 = dc.createLinearGradient(0, 0, W, H);
      }
      grad2.addColorStop(0, gc0); grad2.addColorStop(1, gc1);
      dc.strokeStyle = grad2;
      dc.lineWidth = CH_LINE_W[chIdx] * 0.5;
      dc.globalAlpha = ghostA;
      dc.beginPath();
      for (let i = revealCount; i < nSegs; i++) {
        dc.moveTo(ox + segs[i*4] * scale, oy + segs[i*4+1] * scale);
        dc.lineTo(ox + segs[i*4+2] * scale, oy + segs[i*4+3] * scale);
      }
      dc.stroke();
      dc.globalAlpha = 1;
    }

    // Edge vignette
    const vig = dc.createRadialGradient(W*0.5, H*0.5, Math.min(W,H)*0.30, W*0.5, H*0.5, Math.min(W,H)*0.72);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,0,0.42)");
    dc.fillStyle = vig;
    dc.fillRect(0, 0, W, H);

    // HUD
    const hudA = ss(0.04, 0.16, sp);
    if (hudA > 0.01) {
      const ls = L_SYSTEMS[chIdx];
      p.noStroke();
      p.fill(200, 200, 220, Math.round(hudA * 45));
      p.textSize(7);
      p.textAlign(p.LEFT, p.TOP);
      p.text(`depth ${ls.depth} · ${revealCount} seg`, W*0.018, H*0.018);
      p.textAlign(p.RIGHT, p.TOP);
      p.text(`sp ${sp.toFixed(4)}`, W*0.982, H*0.018);
      p.textAlign(p.LEFT, p.BOTTOM);
      p.text(`CH${chIdx+1} · ${CH_NAMES_L[chIdx]}`, W*0.018, H*0.982);
      p.textAlign(p.RIGHT, p.BOTTOM);
      p.text(`${(revealFrac*100).toFixed(0)}% drawn`, W*0.982, H*0.982);
    }
  };
};
