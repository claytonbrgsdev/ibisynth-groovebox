import { getAudioTime, visualEvents } from '../lib/audio';

// CITY SCAN v2
// LiDAR-aesthetic dense modular city.
//   - 14×14 floor dot-grid
//   - ~60 buildings across 4 archetypes: rect / setback / cylinder / slab
//   - Lit windows on faces (regular grid, ~20% lit)
//   - Antenna spires on tall buildings
//   - Subtle warm/cool tint per building
//   - Audio-reactive: building flashes, scan plane, height pulse, snare ring

const PALETTE = {
  bg:     [6, 10, 20]      as const,
  text:   [220, 239, 250]  as const,
  accent: [0, 217, 255]    as const, // cyan
  far:    [40, 60, 130]    as const, // indigo (depth fog)
  warm:   [180, 230, 255]  as const, // slightly warmer cyan (some buildings)
  cool:   [25, 50, 110]    as const, // slightly cooler indigo (some buildings)
  muted:  [27, 38, 56]     as const,
};

const FLOOR_GRID     = 14;
const FLOOR_SIZE     = 8;
const BUILDING_COUNT = 60;
const CAM_Z          = 8;
const FOV            = 460;
const CAM_TILT       = 0.42;

type BuildingType = 'rect' | 'setback' | 'cylinder' | 'slab';

export const cityScanSketch = (p: any) => {

  type Pt = {
    x: number; y: number; z: number;
    brightness: number;
    // 0 = normal point, 1 = lit window (drawn brighter + with glow)
    kind: 0 | 1;
  };

  type Building = {
    cx: number;
    cz: number;
    w:  number;
    d:  number;
    h:  number;
    type: BuildingType;
    tint: 'normal' | 'warm' | 'cool';
    points: Pt[];
    flash: number;
    heightScale: number;
  };

  let buildings: Building[] = [];
  let floorPoints: Pt[]     = [];

  // Camera/rotation
  let rotY     = 0.4;
  let rotYVel  = 0.0028;
  let dragging = false;
  let dragLastX = 0;

  // Audio envelopes
  let bassPulse    = 0;
  let hihatScatter = 0;
  let dubGlow      = 0;
  let flashAmount  = 0;

  // Scan plane in Y world space
  let scanPlaneY = 99;
  const SCAN_SPEED = 0.05;

  // Snare floor ring
  let snareRing = { active: false, radius: 0, life: 0 };

  let firstFrame = true;

  // ── Helpers ───────────────────────────────────────────────────────────
  function addCornerPillarPoints(
    pts: Pt[],
    x: number, z: number,
    yTop: number, yBot: number,
    density = 12,
  ) {
    const samples = Math.max(4, Math.floor(Math.abs(yBot - yTop) * density));
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      pts.push({ x, y: yTop + (yBot - yTop) * t, z, brightness: 0.95, kind: 0 });
    }
  }

  function addHorizontalEdgePoints(
    pts: Pt[],
    x1: number, z1: number,
    x2: number, z2: number,
    y: number,
    brightness: number,
    samples: number,
  ) {
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

  // Sparse face dots between corners
  function addFacePoints(
    pts: Pt[],
    corners: { x: number; z: number }[],
    yTop: number, yBot: number,
    density: number,
  ) {
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
          brightness: 0.3 + Math.random() * 0.25,
          kind: 0,
        });
      }
    }
  }

  // Lit window grid on a single face
  function addLitWindowsOnFace(
    pts: Pt[],
    aX: number, aZ: number,
    bX: number, bZ: number,
    yTop: number, yBot: number,
    litChance: number,
  ) {
    const width = Math.sqrt((aX - bX) ** 2 + (aZ - bZ) ** 2);
    const height = Math.abs(yBot - yTop);
    const cols = Math.max(2, Math.floor(width * 5));
    const rows = Math.max(3, Math.floor(height * 7));
    for (let i = 1; i < cols; i++) {
      for (let j = 1; j < rows; j++) {
        const u = i / cols;
        const v = j / rows;
        const lit = Math.random() < litChance;
        if (!lit && Math.random() < 0.5) continue; // skip many dim ones for cleanliness
        pts.push({
          x: aX + (bX - aX) * u,
          y: yTop + v * height,
          z: aZ + (bZ - aZ) * u,
          brightness: lit ? 1.0 : 0.25 + Math.random() * 0.15,
          kind: lit ? 1 : 0,
        });
      }
    }
  }

  // ── Building generators ───────────────────────────────────────────────
  function buildRectPoints(b: Building) {
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

    // 4 vertical corner pillars
    for (const c of corners) addCornerPillarPoints(pts, c.x, c.z, top, bot, 13);

    // top + bottom rectangle edges
    for (let i = 0; i < 4; i++) {
      const a = corners[i];
      const bb = corners[(i + 1) % 4];
      addHorizontalEdgePoints(pts, a.x, a.z, bb.x, bb.z, top, 0.9, 10);
      addHorizontalEdgePoints(pts, a.x, a.z, bb.x, bb.z, bot, 0.55, 8);
    }

    // sparse face dots
    addFacePoints(pts, corners, top, bot, 16);

    // top face sparse coverage
    const topDots = Math.floor(b.w * b.d * 12);
    for (let i = 0; i < topDots; i++) {
      pts.push({
        x: b.cx - hw + Math.random() * b.w,
        y: top,
        z: b.cz - hd + Math.random() * b.d,
        brightness: 0.5 + Math.random() * 0.3,
        kind: 0,
      });
    }

    // lit windows on each face
    for (let i = 0; i < 4; i++) {
      const a = corners[i];
      const bb = corners[(i + 1) % 4];
      addLitWindowsOnFace(pts, a.x, a.z, bb.x, bb.z, top, bot, 0.22);
    }

    // antenna on tall ones
    if (b.h > 1.6) {
      const antennaHeight = b.h * 0.35;
      const samples = 10;
      for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        pts.push({
          x: b.cx, y: top - t * antennaHeight, z: b.cz,
          brightness: 0.8 - t * 0.4,
          kind: 0,
        });
      }
      // blinking tip light
      pts.push({ x: b.cx, y: top - antennaHeight, z: b.cz, brightness: 1, kind: 1 });
    }

    b.points = pts;
  }

  function buildSetbackPoints(b: Building) {
    const pts: Pt[] = [];
    // Two-tier or three-tier setback
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
      for (const c of corners) addCornerPillarPoints(pts, c.x, c.z, yTop, yBot, 13);
      for (let i = 0; i < 4; i++) {
        const a = corners[i];
        const bb = corners[(i + 1) % 4];
        addHorizontalEdgePoints(pts, a.x, a.z, bb.x, bb.z, yTop, 0.9, 9);
        addHorizontalEdgePoints(pts, a.x, a.z, bb.x, bb.z, yBot, 0.7, 7);
      }
      addFacePoints(pts, corners, yTop, yBot, 14);
      // windows
      for (let i = 0; i < 4; i++) {
        const a = corners[i];
        const bb = corners[(i + 1) % 4];
        addLitWindowsOnFace(pts, a.x, a.z, bb.x, bb.z, yTop, yBot, 0.22);
      }

      // shrink for next tier
      curW *= 0.72;
      curD *= 0.72;
      curY = yTop;
    }
    // top face sparse on highest tier
    {
      const hw = curW / 2;
      const hd = curD / 2;
      const topDots = Math.floor(curW * curD * 14);
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
    // tall antenna
    const antH = b.h * 0.35;
    const samples = 11;
    for (let i = 0; i <= samples; i++) {
      const t2 = i / samples;
      pts.push({
        x: b.cx, y: curY - t2 * antH, z: b.cz,
        brightness: 0.85 - t2 * 0.45,
        kind: 0,
      });
    }
    pts.push({ x: b.cx, y: curY - antH, z: b.cz, brightness: 1, kind: 1 });

    b.points = pts;
  }

  function buildCylinderPoints(b: Building) {
    const pts: Pt[] = [];
    const r = Math.max(b.w, b.d) / 2;
    const top = -b.h;
    const bot = 0;
    const circumSegments = 18;

    // Vertical pillars around the cylinder
    for (let i = 0; i < circumSegments; i++) {
      const a = (i / circumSegments) * Math.PI * 2;
      const x = b.cx + Math.cos(a) * r;
      const z = b.cz + Math.sin(a) * r;
      addCornerPillarPoints(pts, x, z, top, bot, 11);
    }

    // Top + bottom circle rings (densely sampled)
    const ringSamples = 60;
    for (let i = 0; i < ringSamples; i++) {
      const a = (i / ringSamples) * Math.PI * 2;
      const x = b.cx + Math.cos(a) * r;
      const z = b.cz + Math.sin(a) * r;
      pts.push({ x, y: top, z, brightness: 0.9, kind: 0 });
      pts.push({ x, y: bot, z, brightness: 0.55, kind: 0 });
    }

    // Sparse "skin" dots on the cylindrical surface
    const skinDots = Math.floor(b.h * r * 60);
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

    // Lit "windows" — random bright spots on the cylinder
    const windowCount = Math.floor(b.h * r * 12);
    for (let i = 0; i < windowCount; i++) {
      const lit = Math.random() < 0.25;
      const a = Math.random() * Math.PI * 2;
      const y = top + Math.random() * b.h;
      pts.push({
        x: b.cx + Math.cos(a) * r,
        y,
        z: b.cz + Math.sin(a) * r,
        brightness: lit ? 1.0 : 0.4,
        kind: lit ? 1 : 0,
      });
    }

    // Top face sparse coverage
    const topDots = Math.floor(r * r * 60);
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

    b.points = pts;
  }

  function buildSlabPoints(b: Building) {
    // Same as rect but wider/shorter — generates with same routine but different size proportions
    buildRectPoints(b);

    // Add helipad / rooftop accent: circle of points on top
    const top = -b.h;
    const helipadR = Math.min(b.w, b.d) * 0.28;
    const helipadSamples = 16;
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

  function buildBuildingPoints(b: Building) {
    switch (b.type) {
      case 'rect':     buildRectPoints(b); break;
      case 'setback':  buildSetbackPoints(b); break;
      case 'cylinder': buildCylinderPoints(b); break;
      case 'slab':     buildSlabPoints(b); break;
    }
  }

  function pickBuildingType(): BuildingType {
    const r = Math.random();
    if (r < 0.45) return 'rect';
    if (r < 0.70) return 'setback';
    if (r < 0.85) return 'cylinder';
    return 'slab';
  }

  function pickTint(): 'normal' | 'warm' | 'cool' {
    const r = Math.random();
    if (r < 0.65) return 'normal';
    if (r < 0.85) return 'warm';
    return 'cool';
  }

  function initBuildings() {
    buildings = [];
    const placed: { cx: number; cz: number; w: number; d: number }[] = [];
    let attempts = 0;

    while (buildings.length < BUILDING_COUNT && attempts < 2500) {
      attempts++;
      const type = pickBuildingType();

      // Size by type
      let w: number, d: number, h: number;
      if (type === 'slab') {
        w = 0.8 + Math.random() * 0.7;
        d = 0.8 + Math.random() * 0.7;
        h = 0.4 + Math.random() * 0.5;
      } else if (type === 'cylinder') {
        const r = 0.25 + Math.random() * 0.35;
        w = d = r * 2;
        h = 0.7 + Math.random() ** 1.4 * 2.0;
      } else if (type === 'setback') {
        w = 0.5 + Math.random() * 0.5;
        d = 0.5 + Math.random() * 0.5;
        h = 1.4 + Math.random() ** 1.3 * 1.6;
      } else {
        w = 0.3 + Math.random() * 0.7;
        d = 0.3 + Math.random() * 0.7;
        h = 0.5 + Math.random() ** 1.5 * 2.4;
      }

      const cx = -FLOOR_SIZE / 2 + Math.random() * FLOOR_SIZE;
      const cz = -FLOOR_SIZE / 2 + Math.random() * FLOOR_SIZE;

      // Non-overlap check
      let overlap = false;
      for (const pl of placed) {
        const minDx = (w + pl.w) / 2 + 0.08;
        const minDz = (d + pl.d) / 2 + 0.08;
        if (Math.abs(cx - pl.cx) < minDx && Math.abs(cz - pl.cz) < minDz) {
          overlap = true;
          break;
        }
      }
      if (overlap) continue;

      const b: Building = {
        cx, cz, w, d, h,
        type,
        tint: pickTint(),
        points: [],
        flash: 0,
        heightScale: 1,
      };
      buildBuildingPoints(b);
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

  // ── 3D projection ─────────────────────────────────────────────────────
  function project(wx: number, wy: number, wz: number, cx: number, cy: number, viewportFactor: number) {
    const cosY = Math.cos(rotY);
    const sinY = Math.sin(rotY);
    const x1 = wx * cosY - wz * sinY;
    const z1 = wx * sinY + wz * cosY;

    const cosT = Math.cos(CAM_TILT);
    const sinT = Math.sin(CAM_TILT);
    const y1 = wy * cosT - z1 * sinT;
    const z2 = wy * sinT + z1 * cosT;

    const yLifted = y1 - 0.2;
    const dist = CAM_Z - z2;
    if (dist <= 0.1) return null;
    const f = (FOV * viewportFactor) / dist;
    return {
      sx: cx + x1 * f,
      sy: cy + yLifted * f,
      depth: z2,
      f: f,
    };
  }

  function colorForDepth(depth: number, brightness: number, hit: number, tint: 'normal' | 'warm' | 'cool') {
    const t = Math.max(0, Math.min(1, (depth + 3.5) / 7));

    // Pick endpoints by tint
    let nearC: readonly [number, number, number] = PALETTE.accent;
    let farC:  readonly [number, number, number] = PALETTE.far;
    if (tint === 'warm') { nearC = PALETTE.warm; }
    if (tint === 'cool') { nearC = PALETTE.accent; farC = PALETTE.cool; }

    const r = farC[0] + (nearC[0] - farC[0]) * t;
    const g = farC[1] + (nearC[1] - farC[1]) * t;
    const b = farC[2] + (nearC[2] - farC[2]) * t;

    // Depth fog: dim very far points
    const fogAttenuation = 0.4 + t * 0.6;

    const baseAlpha = 220;
    const alpha = baseAlpha * brightness * fogAttenuation
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

    // Consume audio events
    const now = getAudioTime();
    for (let i = visualEvents.length - 1; i >= 0; i--) {
      const ev = visualEvents[i];
      if (now >= ev.time) {
        switch (ev.type) {
          case 'KICK': {
            for (let k = 0; k < 3; k++) {
              const idx = Math.floor(Math.random() * buildings.length);
              buildings[idx].flash = 1;
            }
            break;
          }
          case 'BASS':
            bassPulse = 1;
            break;
          case 'HIHAT':
            hihatScatter = 1;
            break;
          case 'DUB':
            dubGlow = 1;
            scanPlaneY = -3.5;
            rotYVel = 0.012;
            break;
          case 'SNARE':
            snareRing = { active: true, radius: 0, life: 1 };
            break;
          case 'CLAP':
            flashAmount = 1;
            break;
        }
        visualEvents.splice(i, 1);
      }
    }

    // Decay envelopes
    bassPulse    *= 0.92;
    hihatScatter *= 0.85;
    dubGlow      *= 0.94;
    flashAmount  *= 0.88;
    rotYVel       = p.lerp(rotYVel, 0.0028, 0.05);
    rotY         += rotYVel;

    for (const b of buildings) {
      b.flash *= 0.91;
      b.heightScale = p.lerp(b.heightScale, 1 + bassPulse * 0.16, 0.18);
    }

    if (scanPlaneY < 1) scanPlaneY += SCAN_SPEED;

    if (snareRing.active) {
      snareRing.radius += 0.13;
      snareRing.life *= 0.94;
      if (snareRing.life < 0.05) snareRing.active = false;
    }

    if (dragging && p.mouseIsPressed) {
      const dx = p.mouseX - dragLastX;
      rotY += dx * 0.008;
      dragLastX = p.mouseX;
    } else if (!p.mouseIsPressed) {
      dragging = false;
    }

    // Background fade
    if (firstFrame) {
      p.background(PALETTE.bg[0], PALETTE.bg[1], PALETTE.bg[2]);
      firstFrame = false;
    }
    p.noStroke();
    p.fill(PALETTE.bg[0], PALETTE.bg[1], PALETTE.bg[2], 42);
    p.rect(0, 0, p.width, p.height);

    // Floor points
    p.noStroke();
    for (let i = 0; i < floorPoints.length; i++) {
      const fp = floorPoints[i];
      const proj = project(fp.x, fp.y, fp.z, cx, cy, viewportFactor);
      if (!proj) continue;

      let ringBoost = 0;
      if (snareRing.active) {
        const distToRing = Math.abs(Math.sqrt(fp.x * fp.x + fp.z * fp.z) - snareRing.radius);
        if (distToRing < 0.35) ringBoost = (1 - distToRing / 0.35) * snareRing.life;
      }

      const c = colorForDepth(proj.depth, fp.brightness, ringBoost, 'normal');
      const size = Math.max(1.1, proj.f * 0.008 + ringBoost * 2.5);
      p.fill(c.r, c.g, c.b, c.a * 0.8);
      p.circle(proj.sx, proj.sy, size);
    }

    // Buildings
    for (let bi = 0; bi < buildings.length; bi++) {
      const b = buildings[bi];

      for (let pi = 0; pi < b.points.length; pi++) {
        const pt = b.points[pi];

        const py = pt.y * b.heightScale;
        const jitterMag = (pt.kind === 1) ? 0 : hihatScatter * 0.06;
        const px = pt.x + (jitterMag > 0 ? (Math.random() - 0.5) * jitterMag : 0);
        const pz = pt.z + (jitterMag > 0 ? (Math.random() - 0.5) * jitterMag : 0);

        const proj = project(px, py, pz, cx, cy, viewportFactor);
        if (!proj) continue;

        // Scan plane hit
        let scanHit = 0;
        if (scanPlaneY < 1 && scanPlaneY > -3.5) {
          const dy = Math.abs(py - scanPlaneY);
          if (dy < 0.15) scanHit = (1 - dy / 0.15);
        }

        const totalHit = b.flash + scanHit * 0.8;
        const c = colorForDepth(proj.depth, pt.brightness, totalHit, b.tint);

        let size = Math.max(1, proj.f * 0.013 + b.flash * 2.5 + scanHit * 2);
        if (pt.kind === 1) size *= 1.4; // lit windows slightly larger

        // Glow halo
        if (totalHit > 0.1 || pt.kind === 1 || flashAmount > 0.1) {
          const haloA = (totalHit * 120 + flashAmount * 60 + (pt.kind === 1 ? 70 : 0));
          p.fill(PALETTE.accent[0], PALETTE.accent[1], PALETTE.accent[2], haloA * 0.7);
          p.circle(proj.sx, proj.sy, size * 3);
        }

        p.fill(c.r, c.g, c.b, c.a);
        p.circle(proj.sx, proj.sy, size);

        // Bright cores
        if (pt.kind === 1) {
          p.fill(PALETTE.text[0], PALETTE.text[1], PALETTE.text[2], 235);
          p.circle(proj.sx, proj.sy, size * 0.55);
        } else if (proj.depth > 1.2 && pt.brightness > 0.85) {
          p.fill(PALETTE.text[0], PALETTE.text[1], PALETTE.text[2], 200 + flashAmount * 55);
          p.circle(proj.sx, proj.sy, size * 0.5);
        }
      }
    }

    // Snare floor ring
    if (snareRing.active) {
      const ringSamples = 80;
      p.noFill();
      p.stroke(PALETTE.accent[0], PALETTE.accent[1], PALETTE.accent[2], snareRing.life * 200);
      p.strokeWeight(1.4 * snareRing.life);
      let prev: { sx: number; sy: number } | null = null;
      for (let i = 0; i <= ringSamples; i++) {
        const a = (i / ringSamples) * Math.PI * 2;
        const wx = Math.cos(a) * snareRing.radius;
        const wz = Math.sin(a) * snareRing.radius;
        const proj = project(wx, 0, wz, cx, cy, viewportFactor);
        if (proj && prev) p.line(prev.sx, prev.sy, proj.sx, proj.sy);
        prev = proj;
      }
      p.noStroke();
    }
  };
};
