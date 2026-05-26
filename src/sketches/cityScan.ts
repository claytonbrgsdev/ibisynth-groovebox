import { getAudioTime, visualEvents } from '../lib/audio';

// CITY SCAN
// LiDAR-aesthetic point cloud of architectural blocks on a grid floor.
//   - Ground: 14×14 dot grid floor
//   - 16-20 rectangular building volumes of varying heights
//   - Each building rendered as points at corners + along edges + sparse face coverage
//   - Camera: oblique perspective, slow ambient rotation around Y axis
//   - Depth fog (near = bright cyan, far = deep indigo)
//   - Audio events: light up buildings, scan planes, shockwaves, height pulses

const PALETTE = {
  bg:     [6, 10, 20]      as const,
  text:   [220, 239, 250]  as const,
  accent: [0, 217, 255]    as const,
  far:    [40, 60, 130]    as const,
  muted:  [27, 38, 56]     as const,
};

const FLOOR_GRID    = 14;     // floor grid cells per axis
const FLOOR_SIZE    = 7;      // world units per side
const BUILDING_COUNT = 20;    // total building blocks
const CAM_Z         = 8;
const FOV           = 460;
const CAM_TILT      = 0.42;   // radians, downward look

export const cityScanSketch = (p: any) => {

  type Pt = { x: number; y: number; z: number; brightness: number };

  type Building = {
    cx: number;    // center x
    cz: number;    // center z (depth)
    w:  number;    // width
    d:  number;    // depth
    h:  number;    // height (Y axis, up is -y in our convention)
    points: Pt[];
    // Audio modulation
    flash: number;     // 0–1, decays
    heightScale: number;
  };

  let buildings: Building[]  = [];
  let floorPoints: Pt[]      = [];

  // Camera/rotation
  let rotY = 0.4;
  let rotYVel = 0.0028;
  let dragging = false;
  let dragLastX = 0;

  // Audio envelopes
  let bassPulse    = 0;
  let hihatScatter = 0;
  let dubGlow      = 0;
  let flashAmount  = 0;

  // Scan plane state — vertical Y position in world space (sweeps top→bottom)
  let scanPlaneY = 99;  // 99 = inactive (off-screen)
  const SCAN_SPEED = 0.05;

  // Shockwave ring on the floor (from SNARE)
  let snareRing = { active: false, radius: 0, life: 0 };

  let firstFrame = true;

  // ── Building geometry helpers ─────────────────────────────────────────
  function buildBuildingPoints(b: Building) {
    const pts: Pt[] = [];
    const hw = b.w / 2;
    const hd = b.d / 2;
    const top = -b.h;     // negative Y = up
    const bot = 0;

    // 4 vertical edges (densely sampled for definition)
    const edgePoints = Math.max(5, Math.floor(b.h * 12));
    const corners = [
      { x: b.cx - hw, z: b.cz - hd },
      { x: b.cx + hw, z: b.cz - hd },
      { x: b.cx + hw, z: b.cz + hd },
      { x: b.cx - hw, z: b.cz + hd },
    ];
    for (const c of corners) {
      for (let i = 0; i <= edgePoints; i++) {
        const t = i / edgePoints;
        pts.push({ x: c.x, y: top + (bot - top) * t, z: c.z, brightness: 0.95 });
      }
    }

    // Top rectangle edges (4 edges, sampled)
    const topEdgeSamples = 10;
    for (let i = 0; i < 4; i++) {
      const a = corners[i];
      const b2 = corners[(i + 1) % 4];
      for (let s = 1; s < topEdgeSamples; s++) {
        const t = s / topEdgeSamples;
        pts.push({
          x: a.x + (b2.x - a.x) * t,
          y: top,
          z: a.z + (b2.z - a.z) * t,
          brightness: 0.95,
        });
      }
    }

    // Bottom rectangle edges (lighter)
    for (let i = 0; i < 4; i++) {
      const a = corners[i];
      const b2 = corners[(i + 1) % 4];
      for (let s = 1; s < topEdgeSamples; s++) {
        const t = s / topEdgeSamples;
        pts.push({
          x: a.x + (b2.x - a.x) * t,
          y: bot,
          z: a.z + (b2.z - a.z) * t,
          brightness: 0.6,
        });
      }
    }

    // Sparse face coverage on 4 vertical faces (random dots)
    const faceDots = Math.floor(b.w * b.h * 18);
    for (let i = 0; i < faceDots; i++) {
      const face = Math.floor(Math.random() * 4);
      const u = Math.random();
      const v = Math.random();
      let x = 0, z = 0;
      if (face === 0)      { x = b.cx - hw + u * b.w; z = b.cz - hd; }
      else if (face === 1) { x = b.cx + hw;            z = b.cz - hd + u * b.d; }
      else if (face === 2) { x = b.cx - hw + u * b.w; z = b.cz + hd; }
      else                 { x = b.cx - hw;            z = b.cz - hd + u * b.d; }
      pts.push({ x, y: top + v * b.h, z, brightness: 0.35 + Math.random() * 0.2 });
    }

    // Top face sparse coverage
    const topDots = Math.floor(b.w * b.d * 14);
    for (let i = 0; i < topDots; i++) {
      pts.push({
        x: b.cx - hw + Math.random() * b.w,
        y: top,
        z: b.cz - hd + Math.random() * b.d,
        brightness: 0.5 + Math.random() * 0.3,
      });
    }

    b.points = pts;
  }

  function initBuildings() {
    buildings = [];
    // Place buildings in a loose grid pattern with gaps
    const placed: { cx: number; cz: number; w: number; d: number }[] = [];
    let attempts = 0;
    while (buildings.length < BUILDING_COUNT && attempts < 400) {
      attempts++;
      const w = 0.4 + Math.random() * 0.7;
      const d = 0.4 + Math.random() * 0.7;
      const cx = -FLOOR_SIZE / 2 + Math.random() * FLOOR_SIZE;
      const cz = -FLOOR_SIZE / 2 + Math.random() * FLOOR_SIZE;

      // Avoid overlap with existing
      let overlap = false;
      for (const pl of placed) {
        const minDx = (w + pl.w) / 2 + 0.15;
        const minDz = (d + pl.d) / 2 + 0.15;
        if (Math.abs(cx - pl.cx) < minDx && Math.abs(cz - pl.cz) < minDz) {
          overlap = true;
          break;
        }
      }
      if (overlap) continue;

      // Varied heights — most are medium, a few tall
      const h = 0.5 + Math.random() ** 1.5 * 2.2;

      const b: Building = {
        cx, cz, w, d, h,
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
      dragging = true;
      dragLastX = p.mouseX;
    }
  };
  p.mouseReleased = () => { dragging = false; };

  // ── 3D projection ─────────────────────────────────────────────────────
  function project(wx: number, wy: number, wz: number, cx: number, cy: number, viewportFactor: number) {
    // Rotate around Y
    const cosY = Math.cos(rotY);
    const sinY = Math.sin(rotY);
    const x1 = wx * cosY - wz * sinY;
    const z1 = wx * sinY + wz * cosY;

    // Tilt camera (rotate around X axis by CAM_TILT)
    const cosT = Math.cos(CAM_TILT);
    const sinT = Math.sin(CAM_TILT);
    const y1 = wy * cosT - z1 * sinT;
    const z2 = wy * sinT + z1 * cosT;

    // Lift to center city vertically in viewport
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

  function colorForDepth(depth: number, brightness: number, hit: number) {
    // Normalize depth: typical range -3.5 → +3.5
    const t = Math.max(0, Math.min(1, (depth + 3.5) / 7));
    const r = PALETTE.far[0] + (PALETTE.accent[0] - PALETTE.far[0]) * t;
    const g = PALETTE.far[1] + (PALETTE.accent[1] - PALETTE.far[1]) * t;
    const b = PALETTE.far[2] + (PALETTE.accent[2] - PALETTE.far[2]) * t;
    const baseAlpha = 220;
    const alpha = baseAlpha * brightness * (0.55 + t * 0.45)
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

    // ── Consume audio events ────────────────────────────────────────────
    const now = getAudioTime();
    for (let i = visualEvents.length - 1; i >= 0; i--) {
      const ev = visualEvents[i];
      if (now >= ev.time) {
        switch (ev.type) {
          case 'KICK': {
            // Light up 2 random buildings
            for (let k = 0; k < 2; k++) {
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
            scanPlaneY = -3.5;       // launch downward sweep from top
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

    // ── Decay envelopes ─────────────────────────────────────────────────
    bassPulse   *= 0.92;
    hihatScatter *= 0.85;
    dubGlow     *= 0.94;
    flashAmount *= 0.88;
    rotYVel      = p.lerp(rotYVel, 0.0028, 0.05);
    rotY        += rotYVel;

    for (const b of buildings) {
      b.flash *= 0.91;
      b.heightScale = p.lerp(b.heightScale, 1 + bassPulse * 0.18, 0.18);
    }

    // Update scan plane
    if (scanPlaneY < 1) scanPlaneY += SCAN_SPEED;

    // Update snare ring
    if (snareRing.active) {
      snareRing.radius += 0.12;
      snareRing.life *= 0.94;
      if (snareRing.life < 0.05) snareRing.active = false;
    }

    // Mouse drag
    if (dragging && p.mouseIsPressed) {
      const dx = p.mouseX - dragLastX;
      rotY += dx * 0.008;
      dragLastX = p.mouseX;
    } else if (!p.mouseIsPressed) {
      dragging = false;
    }

    // ── Background fade ─────────────────────────────────────────────────
    if (firstFrame) {
      p.background(PALETTE.bg[0], PALETTE.bg[1], PALETTE.bg[2]);
      firstFrame = false;
    }
    p.noStroke();
    p.fill(PALETTE.bg[0], PALETTE.bg[1], PALETTE.bg[2], 38);
    p.rect(0, 0, p.width, p.height);

    // ── Draw floor grid points ──────────────────────────────────────────
    p.noStroke();
    for (let i = 0; i < floorPoints.length; i++) {
      const fp = floorPoints[i];
      const proj = project(fp.x, fp.y, fp.z, cx, cy, viewportFactor);
      if (!proj) continue;

      // Snare ring hit detection (in world XZ plane)
      let ringBoost = 0;
      if (snareRing.active) {
        const distToRing = Math.abs(Math.sqrt(fp.x * fp.x + fp.z * fp.z) - snareRing.radius);
        if (distToRing < 0.3) {
          ringBoost = (1 - distToRing / 0.3) * snareRing.life;
        }
      }

      const c = colorForDepth(proj.depth, fp.brightness, ringBoost);
      const size = Math.max(1.1, proj.f * 0.008 + ringBoost * 2.5);
      p.fill(c.r, c.g, c.b, c.a * 0.8);
      p.circle(proj.sx, proj.sy, size);
    }

    // ── Draw buildings ──────────────────────────────────────────────────
    for (let bi = 0; bi < buildings.length; bi++) {
      const b = buildings[bi];

      for (let pi = 0; pi < b.points.length; pi++) {
        const pt = b.points[pi];

        // Apply per-building height scale (stretch Y for bass pulse)
        const py = pt.y * b.heightScale;
        const px = pt.x + (hihatScatter > 0.05 ? (Math.random() - 0.5) * hihatScatter * 0.08 : 0);
        const pz = pt.z + (hihatScatter > 0.05 ? (Math.random() - 0.5) * hihatScatter * 0.08 : 0);

        const proj = project(px, py, pz, cx, cy, viewportFactor);
        if (!proj) continue;

        // Scan plane hit
        let scanHit = 0;
        if (scanPlaneY < 1 && scanPlaneY > -3.5) {
          const dy = Math.abs(py - scanPlaneY);
          if (dy < 0.15) scanHit = (1 - dy / 0.15);
        }

        const totalHit = b.flash + scanHit * 0.8;
        const c = colorForDepth(proj.depth, pt.brightness, totalHit);
        const size = Math.max(1, proj.f * 0.013 + b.flash * 2.5 + scanHit * 2);

        // Glow halo for flashing or scan-hit points
        if (totalHit > 0.1 || flashAmount > 0.1) {
          const haloA = (totalHit * 120 + flashAmount * 60);
          p.fill(PALETTE.accent[0], PALETTE.accent[1], PALETTE.accent[2], haloA);
          p.circle(proj.sx, proj.sy, size * 3);
        }

        p.fill(c.r, c.g, c.b, c.a);
        p.circle(proj.sx, proj.sy, size);

        // Bright core on near + bright points
        if (proj.depth > 1 && pt.brightness > 0.8) {
          p.fill(PALETTE.text[0], PALETTE.text[1], PALETTE.text[2], 200 + flashAmount * 55);
          p.circle(proj.sx, proj.sy, size * 0.5);
        }
      }
    }

    // ── Snare shockwave ring overlay (on floor plane) ───────────────────
    if (snareRing.active) {
      // Sample N points around the ring in world space, project & draw
      const ringSamples = 80;
      p.noFill();
      p.stroke(PALETTE.accent[0], PALETTE.accent[1], PALETTE.accent[2], snareRing.life * 200);
      p.strokeWeight(1.2 * snareRing.life);
      let prevProj: { sx: number; sy: number } | null = null;
      for (let i = 0; i <= ringSamples; i++) {
        const a = (i / ringSamples) * Math.PI * 2;
        const wx = Math.cos(a) * snareRing.radius;
        const wz = Math.sin(a) * snareRing.radius;
        const proj = project(wx, 0, wz, cx, cy, viewportFactor);
        if (proj && prevProj) {
          p.line(prevProj.sx, prevProj.sy, proj.sx, proj.sy);
        }
        prevProj = proj;
      }
      p.noStroke();
    }
  };
};
