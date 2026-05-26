import { getAudioTime, visualEvents } from '../lib/audio';

// CITY SCAN v3
// LiDAR-aesthetic point-cloud city with cinematic camera + rich audio reactivity.
//   - 32 buildings across 4 archetypes (rect / setback / cylinder / slab)
//   - Lit windows on faces (drawn cheaply; halos only on events)
//   - Cinematic camera: ambient sway + dolly/shake/roll on audio
//   - Audio: building flashes, ground ripple, scan plane, skywalks, snare-ring,
//     rooftop flicker, city duck

const PALETTE = {
  bg:     [6, 10, 20]      as const,
  text:   [220, 239, 250]  as const,
  accent: [0, 217, 255]    as const,
  far:    [40, 60, 130]    as const,
  warm:   [180, 230, 255]  as const,
  cool:   [25, 50, 110]    as const,
  muted:  [27, 38, 56]     as const,
};

const FLOOR_GRID     = 14;
const FLOOR_SIZE     = 8;
const BUILDING_COUNT = 32;
const BASE_CAM_Z     = 8;
const FOV            = 460;
const BASE_CAM_TILT  = 0.42;

type BuildingType = 'rect' | 'setback' | 'cylinder' | 'slab';
type Tint = 'normal' | 'warm' | 'cool';

export const cityScanSketch = (p: any) => {

  type Pt = {
    x: number; y: number; z: number;
    brightness: number;
    kind: 0 | 1;  // 0 = normal, 1 = lit window (brighter + halo on events)
  };

  type Building = {
    cx: number;
    cz: number;
    w:  number;
    d:  number;
    h:  number;
    type: BuildingType;
    tint: Tint;
    points: Pt[];
    flash: number;        // 0-1
    flicker: number;      // 0-1 (HIHAT random flicker)
    duck: number;         // 0-1 (SNARE city ducks)
    tallRoofXZ: { x: number; y: number; z: number } | null; // for skywalk endpoints (only tall buildings)
  };

  let buildings: Building[] = [];
  let floorPoints: Pt[]     = [];

  // ── Camera state ──────────────────────────────────────────────────────
  let rotY      = 0.4;
  let rotYVel   = 0.0028;
  let camDolly  = 0;        // 0-1, brief zoom-in
  let camShakeX = 0;
  let camShakeY = 0;
  let camRoll   = 0;        // radians, brief tilt
  const swayPhase = { v: 0 };  // continuous

  let dragging  = false;
  let dragLastX = 0;

  // ── Audio envelopes ───────────────────────────────────────────────────
  let bassPulse    = 0;
  let groundPulse  = 0;       // ground ripple
  let dubGlow      = 0;
  let flashAmount  = 0;

  // Scan plane Y in world space
  let scanPlaneY = 99;
  const SCAN_SPEED = 0.06;

  // Snare floor ring
  let snareRing = { active: false, radius: 0, life: 0 };

  // CLAP skywalk lines (active for ~30 frames)
  let skywalk = { active: false, life: 0, pairs: [] as { a: Building; b: Building }[] };

  let firstFrame = true;

  // ── Helpers ───────────────────────────────────────────────────────────
  function addPillar(pts: Pt[], x: number, z: number, yTop: number, yBot: number, density = 10) {
    const samples = Math.max(4, Math.floor(Math.abs(yBot - yTop) * density));
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      pts.push({ x, y: yTop + (yBot - yTop) * t, z, brightness: 0.95, kind: 0 });
    }
  }

  function addEdge(pts: Pt[], x1: number, z1: number, x2: number, z2: number, y: number, brightness: number, samples: number) {
    for (let s = 1; s < samples; s++) {
      const t = s / samples;
      pts.push({
        x: x1 + (x2 - x1) * t,
        y,
        z: z1 + (z2 - z1) * t,
        brightness,
        kind: 0,
      });
    }
  }

  function addFaceDots(pts: Pt[], corners: { x: number; z: number }[], yTop: number, yBot: number, density: number) {
    const h = Math.abs(yBot - yTop);
    for (let i = 0; i < 4; i++) {
      const a = corners[i];
      const b = corners[(i + 1) % 4];
      const w = Math.sqrt((a.x - b.x) ** 2 + (a.z - b.z) ** 2);
      const n = Math.floor(w * h * density);
      for (let k = 0; k < n; k++) {
        const u = Math.random();
        const v = Math.random();
        pts.push({
          x: a.x + (b.x - a.x) * u,
          y: yTop + v * h,
          z: a.z + (b.z - a.z) * u,
          brightness: 0.28 + Math.random() * 0.22,
          kind: 0,
        });
      }
    }
  }

  function addWindows(pts: Pt[], aX: number, aZ: number, bX: number, bZ: number, yTop: number, yBot: number, litChance: number) {
    const width  = Math.sqrt((aX - bX) ** 2 + (aZ - bZ) ** 2);
    const height = Math.abs(yBot - yTop);
    const cols = Math.max(2, Math.floor(width * 4));
    const rows = Math.max(3, Math.floor(height * 6));
    for (let i = 1; i < cols; i++) {
      for (let j = 1; j < rows; j++) {
        const lit = Math.random() < litChance;
        if (!lit) continue; // skip dim window pos for perf — only render lit ones
        const u = i / cols;
        const v = j / rows;
        pts.push({
          x: aX + (bX - aX) * u,
          y: yTop + v * height,
          z: aZ + (bZ - aZ) * u,
          brightness: 1.0,
          kind: 1,
        });
      }
    }
  }

  // ── Building generators ───────────────────────────────────────────────
  function buildRect(b: Building) {
    const pts: Pt[] = [];
    const hw = b.w / 2;
    const hd = b.d / 2;
    const top = -b.h;
    const bot = 0;
    const corners = [
      { x: b.cx - hw, z: b.cz - hd },
      { x: b.cx + hw, z: b.cz - hd },
      { x: b.cx + hw, z: b.cz + hd },
      { x: b.cx - hw, z: b.cz + hd },
    ];
    for (const c of corners) addPillar(pts, c.x, c.z, top, bot, 11);
    for (let i = 0; i < 4; i++) {
      const a = corners[i];
      const bb = corners[(i + 1) % 4];
      addEdge(pts, a.x, a.z, bb.x, bb.z, top, 0.9, 8);
      addEdge(pts, a.x, a.z, bb.x, bb.z, bot, 0.55, 6);
    }
    addFaceDots(pts, corners, top, bot, 8);
    // sparse top
    const topDots = Math.floor(b.w * b.d * 8);
    for (let i = 0; i < topDots; i++) {
      pts.push({
        x: b.cx - hw + Math.random() * b.w,
        y: top,
        z: b.cz - hd + Math.random() * b.d,
        brightness: 0.5 + Math.random() * 0.3,
        kind: 0,
      });
    }
    for (let i = 0; i < 4; i++) {
      const a = corners[i];
      const bb = corners[(i + 1) % 4];
      addWindows(pts, a.x, a.z, bb.x, bb.z, top, bot, 0.18);
    }
    if (b.h > 1.6) {
      const antH = b.h * 0.35;
      const samples = 9;
      for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        pts.push({ x: b.cx, y: top - t * antH, z: b.cz, brightness: 0.75 - t * 0.4, kind: 0 });
      }
      pts.push({ x: b.cx, y: top - antH, z: b.cz, brightness: 1, kind: 1 });
      b.tallRoofXZ = { x: b.cx, y: top, z: b.cz };
    }
    b.points = pts;
  }

  function buildSetback(b: Building) {
    const pts: Pt[] = [];
    const tiers = Math.random() > 0.5 ? 2 : 3;
    let curW = b.w;
    let curD = b.d;
    let curY = 0;
    const tierHeight = b.h / tiers;
    for (let t = 0; t < tiers; t++) {
      const hw = curW / 2;
      const hd = curD / 2;
      const yTop = curY - tierHeight;
      const yBot = curY;
      const corners = [
        { x: b.cx - hw, z: b.cz - hd },
        { x: b.cx + hw, z: b.cz - hd },
        { x: b.cx + hw, z: b.cz + hd },
        { x: b.cx - hw, z: b.cz + hd },
      ];
      for (const c of corners) addPillar(pts, c.x, c.z, yTop, yBot, 11);
      for (let i = 0; i < 4; i++) {
        const a = corners[i];
        const bb = corners[(i + 1) % 4];
        addEdge(pts, a.x, a.z, bb.x, bb.z, yTop, 0.9, 7);
        addEdge(pts, a.x, a.z, bb.x, bb.z, yBot, 0.65, 5);
      }
      addFaceDots(pts, corners, yTop, yBot, 7);
      for (let i = 0; i < 4; i++) {
        const a = corners[i];
        const bb = corners[(i + 1) % 4];
        addWindows(pts, a.x, a.z, bb.x, bb.z, yTop, yBot, 0.18);
      }
      curW *= 0.72;
      curD *= 0.72;
      curY = yTop;
    }
    // top face dots
    {
      const hw = curW / 2;
      const hd = curD / 2;
      const topDots = Math.floor(curW * curD * 10);
      for (let i = 0; i < topDots; i++) {
        pts.push({
          x: b.cx - hw + Math.random() * curW,
          y: curY,
          z: b.cz - hd + Math.random() * curD,
          brightness: 0.55 + Math.random() * 0.3,
          kind: 0,
        });
      }
    }
    // antenna
    const antH = b.h * 0.35;
    const samples = 10;
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      pts.push({ x: b.cx, y: curY - t * antH, z: b.cz, brightness: 0.85 - t * 0.45, kind: 0 });
    }
    pts.push({ x: b.cx, y: curY - antH, z: b.cz, brightness: 1, kind: 1 });
    b.tallRoofXZ = { x: b.cx, y: curY, z: b.cz };
    b.points = pts;
  }

  function buildCylinder(b: Building) {
    const pts: Pt[] = [];
    const r = Math.max(b.w, b.d) / 2;
    const top = -b.h;
    const bot = 0;
    const circumSegments = 14;
    for (let i = 0; i < circumSegments; i++) {
      const a = (i / circumSegments) * Math.PI * 2;
      const x = b.cx + Math.cos(a) * r;
      const z = b.cz + Math.sin(a) * r;
      addPillar(pts, x, z, top, bot, 9);
    }
    const ringSamples = 36;
    for (let i = 0; i < ringSamples; i++) {
      const a = (i / ringSamples) * Math.PI * 2;
      const x = b.cx + Math.cos(a) * r;
      const z = b.cz + Math.sin(a) * r;
      pts.push({ x, y: top, z, brightness: 0.9, kind: 0 });
      pts.push({ x, y: bot, z, brightness: 0.55, kind: 0 });
    }
    // skin dots
    const skinDots = Math.floor(b.h * r * 25);
    for (let i = 0; i < skinDots; i++) {
      const a = Math.random() * Math.PI * 2;
      const y = top + Math.random() * b.h;
      pts.push({
        x: b.cx + Math.cos(a) * r,
        y,
        z: b.cz + Math.sin(a) * r,
        brightness: 0.3 + Math.random() * 0.2,
        kind: 0,
      });
    }
    // windows
    const windowCount = Math.floor(b.h * r * 8);
    for (let i = 0; i < windowCount; i++) {
      const lit = Math.random() < 0.22;
      if (!lit) continue;
      const a = Math.random() * Math.PI * 2;
      const y = top + Math.random() * b.h;
      pts.push({
        x: b.cx + Math.cos(a) * r,
        y,
        z: b.cz + Math.sin(a) * r,
        brightness: 1,
        kind: 1,
      });
    }
    // top face sparse
    const topDots = Math.floor(r * r * 40);
    for (let i = 0; i < topDots; i++) {
      const a = Math.random() * Math.PI * 2;
      const rr = Math.random() * r;
      pts.push({
        x: b.cx + Math.cos(a) * rr,
        y: top,
        z: b.cz + Math.sin(a) * rr,
        brightness: 0.5 + Math.random() * 0.3,
        kind: 0,
      });
    }
    if (b.h > 1.4) b.tallRoofXZ = { x: b.cx, y: top, z: b.cz };
    b.points = pts;
  }

  function buildSlab(b: Building) {
    buildRect(b);
    // Helipad ring on top
    const top = -b.h;
    const helipadR = Math.min(b.w, b.d) * 0.28;
    const helipadSamples = 14;
    for (let i = 0; i < helipadSamples; i++) {
      const a = (i / helipadSamples) * Math.PI * 2;
      b.points.push({
        x: b.cx + Math.cos(a) * helipadR,
        y: top - 0.01,
        z: b.cz + Math.sin(a) * helipadR,
        brightness: 1,
        kind: 1,
      });
    }
  }

  function buildPoints(b: Building) {
    switch (b.type) {
      case 'rect':     buildRect(b); break;
      case 'setback':  buildSetback(b); break;
      case 'cylinder': buildCylinder(b); break;
      case 'slab':     buildSlab(b); break;
    }
  }

  function pickType(): BuildingType {
    const r = Math.random();
    if (r < 0.45) return 'rect';
    if (r < 0.70) return 'setback';
    if (r < 0.85) return 'cylinder';
    return 'slab';
  }

  function pickTint(): Tint {
    const r = Math.random();
    if (r < 0.65) return 'normal';
    if (r < 0.85) return 'warm';
    return 'cool';
  }

  function initBuildings() {
    buildings = [];
    const placed: { cx: number; cz: number; w: number; d: number }[] = [];
    let attempts = 0;
    while (buildings.length < BUILDING_COUNT && attempts < 2000) {
      attempts++;
      const type = pickType();
      let w: number, d: number, h: number;
      if (type === 'slab') {
        w = 0.9 + Math.random() * 0.6;
        d = 0.9 + Math.random() * 0.6;
        h = 0.4 + Math.random() * 0.5;
      } else if (type === 'cylinder') {
        const r = 0.3 + Math.random() * 0.35;
        w = d = r * 2;
        h = 0.8 + Math.random() ** 1.3 * 2.0;
      } else if (type === 'setback') {
        w = 0.55 + Math.random() * 0.5;
        d = 0.55 + Math.random() * 0.5;
        h = 1.5 + Math.random() ** 1.3 * 1.6;
      } else {
        w = 0.35 + Math.random() * 0.7;
        d = 0.35 + Math.random() * 0.7;
        h = 0.6 + Math.random() ** 1.4 * 2.4;
      }
      const cx = -FLOOR_SIZE / 2 + Math.random() * FLOOR_SIZE;
      const cz = -FLOOR_SIZE / 2 + Math.random() * FLOOR_SIZE;
      let overlap = false;
      for (const pl of placed) {
        const minDx = (w + pl.w) / 2 + 0.15;
        const minDz = (d + pl.d) / 2 + 0.15;
        if (Math.abs(cx - pl.cx) < minDx && Math.abs(cz - pl.cz) < minDz) {
          overlap = true; break;
        }
      }
      if (overlap) continue;
      const b: Building = {
        cx, cz, w, d, h,
        type,
        tint: pickTint(),
        points: [],
        flash: 0,
        flicker: 0,
        duck: 0,
        tallRoofXZ: null,
      };
      buildPoints(b);
      buildings.push(b);
      placed.push({ cx, cz, w, d });
    }
  }

  function initFloor() {
    floorPoints = [];
    const step = FLOOR_SIZE / FLOOR_GRID;
    const half = FLOOR_SIZE / 2;
    for (let i = 0; i <= FLOOR_GRID; i++) {
      for (let j = 0; j <= FLOOR_GRID; j++) {
        floorPoints.push({
          x: -half + i * step,
          y: 0,
          z: -half + j * step,
          brightness: 0.55,
          kind: 0,
        });
      }
    }
  }

  // Find nearest-neighbor pairs of tall buildings for skywalks
  function makeSkywalkPairs(): { a: Building; b: Building }[] {
    const tall = buildings.filter(b => b.tallRoofXZ !== null);
    if (tall.length < 2) return [];
    const pairs: { a: Building; b: Building; d: number }[] = [];
    for (let i = 0; i < tall.length; i++) {
      let best: Building | null = null;
      let bestD = Infinity;
      for (let j = 0; j < tall.length; j++) {
        if (i === j) continue;
        const a = tall[i].tallRoofXZ!;
        const b = tall[j].tallRoofXZ!;
        const d = Math.sqrt((a.x - b.x) ** 2 + (a.z - b.z) ** 2);
        if (d < bestD) { bestD = d; best = tall[j]; }
      }
      if (best && bestD < 3.5) pairs.push({ a: tall[i], b: best, d: bestD });
    }
    // dedupe pairs
    const seen = new Set<string>();
    const out: { a: Building; b: Building }[] = [];
    for (const pr of pairs) {
      const i1 = buildings.indexOf(pr.a);
      const i2 = buildings.indexOf(pr.b);
      const key = i1 < i2 ? `${i1}-${i2}` : `${i2}-${i1}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ a: pr.a, b: pr.b });
    }
    return out;
  }

  // ── Setup ─────────────────────────────────────────────────────────────
  p.setup = () => {
    const parent = p.canvas?.parentElement;
    const w = parent ? parent.clientWidth : 800;
    const h = parent ? parent.clientHeight : 600;
    p.createCanvas(w, h);
    p.pixelDensity(1);
    p.smooth();
    visualEvents.length = 0;
    initFloor();
    initBuildings();
    firstFrame = true;
  };

  p.windowResized = () => {
    const parent = p.canvas?.parentElement;
    if (parent) {
      p.resizeCanvas(parent.clientWidth, parent.clientHeight);
      firstFrame = true;
    }
  };

  p.mousePressed = () => {
    if (p.mouseX > 0 && p.mouseX < p.width && p.mouseY > 0 && p.mouseY < p.height) {
      dragging  = true;
      dragLastX = p.mouseX;
    }
  };
  p.mouseReleased = () => { dragging = false; };

  // ── 3D project ────────────────────────────────────────────────────────
  function project(wx: number, wy: number, wz: number, cx: number, cy: number, viewportFactor: number, dynZ: number, dynTilt: number) {
    const cosY = Math.cos(rotY);
    const sinY = Math.sin(rotY);
    const x1 = wx * cosY - wz * sinY;
    const z1 = wx * sinY + wz * cosY;

    const cosT = Math.cos(dynTilt);
    const sinT = Math.sin(dynTilt);
    const y1 = wy * cosT - z1 * sinT;
    const z2 = wy * sinT + z1 * cosT;

    const yLifted = y1 - 0.2;
    const dist = dynZ - z2;
    if (dist <= 0.1) return null;
    const f = (FOV * viewportFactor) / dist;

    // Apply camera roll (2D rotation on screen)
    let sx = x1 * f;
    let sy = yLifted * f;
    if (Math.abs(camRoll) > 0.001) {
      const cr = Math.cos(camRoll);
      const sr = Math.sin(camRoll);
      const sx2 = sx * cr - sy * sr;
      const sy2 = sx * sr + sy * cr;
      sx = sx2; sy = sy2;
    }

    return {
      sx: cx + sx + camShakeX,
      sy: cy + sy + camShakeY,
      depth: z2,
      f,
    };
  }

  function colorForDepth(depth: number, brightness: number, hit: number, tint: Tint) {
    const t = Math.max(0, Math.min(1, (depth + 3.5) / 7));
    let nearC: readonly [number, number, number] = PALETTE.accent;
    let farC:  readonly [number, number, number] = PALETTE.far;
    if (tint === 'warm') { nearC = PALETTE.warm; }
    if (tint === 'cool') { farC = PALETTE.cool; }
    const r = farC[0] + (nearC[0] - farC[0]) * t;
    const g = farC[1] + (nearC[1] - farC[1]) * t;
    const b = farC[2] + (nearC[2] - farC[2]) * t;
    const fogAtt = 0.4 + t * 0.6;
    const baseAlpha = 220;
    const alpha = baseAlpha * brightness * fogAtt
                + flashAmount * 90
                + dubGlow * 50
                + hit * 100;
    return { r, g, b, a: Math.min(255, alpha) };
  }

  // ── Draw ──────────────────────────────────────────────────────────────
  p.draw = () => {
    const cx = p.width / 2;
    const cy = p.height / 2;
    const scale = Math.min(p.width, p.height);
    const viewportFactor = scale / 700;

    // ── Audio events ────────────────────────────────────────────────────
    const now = getAudioTime();
    for (let i = visualEvents.length - 1; i >= 0; i--) {
      const ev = visualEvents[i];
      if (now >= ev.time) {
        switch (ev.type) {
          case 'KICK': {
            for (let k = 0; k < 4; k++) {
              const idx = Math.floor(Math.random() * buildings.length);
              buildings[idx].flash = 1;
            }
            camShakeX += (Math.random() - 0.5) * 4;
            camShakeY += (Math.random() - 0.5) * 4;
            break;
          }
          case 'BASS':
            bassPulse   = 1;
            groundPulse = 1;
            break;
          case 'HIHAT': {
            // Trigger flicker on a few random buildings
            for (let k = 0; k < 5; k++) {
              const idx = Math.floor(Math.random() * buildings.length);
              buildings[idx].flicker = 1;
            }
            break;
          }
          case 'DUB':
            dubGlow    = 1;
            scanPlaneY = -3.5;
            rotYVel    = 0.014;
            camDolly  += 0.6;
            break;
          case 'SNARE':
            snareRing = { active: true, radius: 0, life: 1 };
            // City ducks: all buildings briefly drop height
            for (const b of buildings) b.duck = 1;
            camRoll += (Math.random() - 0.5) * 0.04;
            break;
          case 'CLAP':
            flashAmount = 1;
            // Skywalks
            skywalk = { active: true, life: 1, pairs: makeSkywalkPairs() };
            break;
        }
        visualEvents.splice(i, 1);
      }
    }

    // ── Decay envelopes & camera ────────────────────────────────────────
    bassPulse   *= 0.92;
    groundPulse *= 0.93;
    dubGlow     *= 0.94;
    flashAmount *= 0.88;
    camShakeX   *= 0.82;
    camShakeY   *= 0.82;
    camRoll     *= 0.90;
    camDolly    *= 0.92;
    rotYVel      = p.lerp(rotYVel, 0.0028, 0.05);
    rotY        += rotYVel;
    swayPhase.v += 0.006;

    for (const b of buildings) {
      b.flash  *= 0.91;
      b.flicker *= 0.82;
      b.duck   *= 0.86;
    }

    if (scanPlaneY < 1) scanPlaneY += SCAN_SPEED;

    if (snareRing.active) {
      snareRing.radius += 0.13;
      snareRing.life   *= 0.94;
      if (snareRing.life < 0.05) snareRing.active = false;
    }

    if (skywalk.active) {
      skywalk.life *= 0.94;
      if (skywalk.life < 0.05) skywalk.active = false;
    }

    if (dragging && p.mouseIsPressed) {
      const dx = p.mouseX - dragLastX;
      rotY += dx * 0.008;
      dragLastX = p.mouseX;
    } else if (!p.mouseIsPressed) {
      dragging = false;
    }

    // Dynamic camera params
    const dynCamZ   = BASE_CAM_Z - camDolly * 1.6;
    const tiltSway  = Math.sin(swayPhase.v) * 0.03;
    const dynTilt   = BASE_CAM_TILT + tiltSway;

    // ── BG fade ─────────────────────────────────────────────────────────
    if (firstFrame) {
      p.background(PALETTE.bg[0], PALETTE.bg[1], PALETTE.bg[2]);
      firstFrame = false;
    }
    p.noStroke();
    p.fill(PALETTE.bg[0], PALETTE.bg[1], PALETTE.bg[2], 42);
    p.rect(0, 0, p.width, p.height);

    // ── Floor points (with ground ripple from BASS) ─────────────────────
    p.noStroke();
    for (let i = 0; i < floorPoints.length; i++) {
      const fp = floorPoints[i];
      const proj = project(fp.x, fp.y, fp.z, cx, cy, viewportFactor, dynCamZ, dynTilt);
      if (!proj) continue;

      // Snare ring boost
      let ringBoost = 0;
      if (snareRing.active) {
        const distToRing = Math.abs(Math.sqrt(fp.x * fp.x + fp.z * fp.z) - snareRing.radius);
        if (distToRing < 0.35) ringBoost = (1 - distToRing / 0.35) * snareRing.life;
      }

      // Ground pulse: brightness wave radiating outward
      let groundBoost = 0;
      if (groundPulse > 0.05) {
        const radial = Math.sqrt(fp.x * fp.x + fp.z * fp.z);
        // moving wave: front travels outward over time, sin-shaped
        const front = (1 - groundPulse) * 5;  // 0 at peak, 5 at decay end
        const dr = Math.abs(radial - front);
        if (dr < 0.5) groundBoost = (1 - dr / 0.5) * groundPulse * 0.8;
      }

      const c = colorForDepth(proj.depth, fp.brightness, ringBoost + groundBoost, 'normal');
      const size = Math.max(1.1, proj.f * 0.008 + ringBoost * 2.5 + groundBoost * 1.5);
      p.fill(c.r, c.g, c.b, c.a * 0.85);
      p.circle(proj.sx, proj.sy, size);
    }

    // ── Buildings ───────────────────────────────────────────────────────
    for (let bi = 0; bi < buildings.length; bi++) {
      const b = buildings[bi];

      // Effective height scale = bass stretch − snare duck
      const effHeightScale = (1 + bassPulse * 0.16) * (1 - b.duck * 0.18);

      // Flicker boosts a portion of windows briefly
      const flickerActive = b.flicker > 0.1;
      const flickerThreshold = 0.6; // ~40% of windows flicker when active

      for (let pi = 0; pi < b.points.length; pi++) {
        const pt = b.points[pi];
        const py = pt.y * effHeightScale;
        const px = pt.x;
        const pz = pt.z;

        const proj = project(px, py, pz, cx, cy, viewportFactor, dynCamZ, dynTilt);
        if (!proj) continue;

        // Scan plane hit
        let scanHit = 0;
        if (scanPlaneY < 1 && scanPlaneY > -3.5) {
          const dy = Math.abs(py - scanPlaneY);
          if (dy < 0.15) scanHit = (1 - dy / 0.15);
        }

        // Per-point flicker
        let flickerBoost = 0;
        if (flickerActive && pt.kind === 1 && Math.random() > flickerThreshold) {
          flickerBoost = b.flicker;
        }

        const totalHit = b.flash + scanHit * 0.8 + flickerBoost;
        const c = colorForDepth(proj.depth, pt.brightness, totalHit, b.tint);

        let size = Math.max(1, proj.f * 0.013 + b.flash * 2.5 + scanHit * 2 + flickerBoost * 1.5);
        if (pt.kind === 1) size *= 1.3;

        // Halo ONLY on event-triggered points (perf win)
        const needHalo = (totalHit > 0.15) || (flashAmount > 0.15 && pt.kind === 1);
        if (needHalo) {
          const haloA = (totalHit * 140 + flashAmount * 70);
          p.fill(PALETTE.accent[0], PALETTE.accent[1], PALETTE.accent[2], haloA * 0.7);
          p.circle(proj.sx, proj.sy, size * 3);
        }

        p.fill(c.r, c.g, c.b, c.a);
        p.circle(proj.sx, proj.sy, size);

        // Bright core: lit windows always, normal points only when near + bright
        if (pt.kind === 1) {
          p.fill(PALETTE.text[0], PALETTE.text[1], PALETTE.text[2], 235);
          p.circle(proj.sx, proj.sy, size * 0.55);
        } else if (proj.depth > 1.4 && pt.brightness > 0.85) {
          p.fill(PALETTE.text[0], PALETTE.text[1], PALETTE.text[2], 200 + flashAmount * 55);
          p.circle(proj.sx, proj.sy, size * 0.5);
        }
      }
    }

    // ── Snare floor ring ────────────────────────────────────────────────
    if (snareRing.active) {
      const ringSamples = 64;
      p.noFill();
      p.stroke(PALETTE.accent[0], PALETTE.accent[1], PALETTE.accent[2], snareRing.life * 200);
      p.strokeWeight(1.4 * snareRing.life);
      let prev: { sx: number; sy: number } | null = null;
      for (let i = 0; i <= ringSamples; i++) {
        const a = (i / ringSamples) * Math.PI * 2;
        const wx = Math.cos(a) * snareRing.radius;
        const wz = Math.sin(a) * snareRing.radius;
        const proj = project(wx, 0, wz, cx, cy, viewportFactor, dynCamZ, dynTilt);
        if (proj && prev) p.line(prev.sx, prev.sy, proj.sx, proj.sy);
        prev = proj;
      }
      p.noStroke();
    }

    // ── CLAP skywalks ───────────────────────────────────────────────────
    if (skywalk.active) {
      p.stroke(PALETTE.text[0], PALETTE.text[1], PALETTE.text[2], skywalk.life * 200);
      p.strokeWeight(0.9 * skywalk.life);
      for (const pair of skywalk.pairs) {
        if (!pair.a.tallRoofXZ || !pair.b.tallRoofXZ) continue;
        const pa = project(pair.a.tallRoofXZ.x, pair.a.tallRoofXZ.y, pair.a.tallRoofXZ.z, cx, cy, viewportFactor, dynCamZ, dynTilt);
        const pb = project(pair.b.tallRoofXZ.x, pair.b.tallRoofXZ.y, pair.b.tallRoofXZ.z, cx, cy, viewportFactor, dynCamZ, dynTilt);
        if (pa && pb) p.line(pa.sx, pa.sy, pb.sx, pb.sy);
      }
      p.noStroke();
    }
  };
};
