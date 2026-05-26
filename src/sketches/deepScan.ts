import { getAudioTime, visualEvents } from '../lib/audio';

// DEEP SCAN
// LiDAR-aesthetic rotating 3D point cloud.
//   - Noisy sphere of ~2500 points (the scanned object)
//   - 800 ambient scatter points drifting around it (sensor noise)
//   - Always rotating on Y axis
//   - Depth-based color: near = electric cyan/white, far = deep indigo
//   - Horizontal scan line sweeps top→bottom on DUB events
//   - Audio events scatter / compress / explode the cloud

const PALETTE = {
  bg:     [6, 10, 20]      as const,
  text:   [220, 239, 250]  as const,
  accent: [0, 217, 255]    as const, // electric cyan
  far:    [40, 60, 130]    as const, // deep indigo (depth fog)
  muted:  [27, 38, 56]     as const,
};

const SPHERE_POINTS  = 2400;
const SCATTER_POINTS = 700;

const CAM_Z   = 7;           // camera distance for perspective
const FOV     = 380;         // perspective focal length (tuned for screen scale)

export const deepScanSketch = (p: any) => {

  type Pt = {
    // Rest position (3D)
    rx: number; ry: number; rz: number;
    // Current position (3D)
    x:  number; y:  number; z:  number;
    // Velocity (3D)
    vx: number; vy: number; vz: number;
    // Visual modulation (random brightness offset)
    brightness: number;
  };

  let cloud:   Pt[] = [];
  let scatter: Pt[] = [];

  // Rotation state (always rotating on Y; user can drag to add X rotation)
  let rotY = 0;
  let rotX = 0.25;
  let rotYVel = 0.0035;        // base ambient spin
  let dragging = false;
  let dragLastX = 0;
  let dragLastY = 0;

  // Audio envelopes (all 0–1, decay each frame)
  let kickPulse    = 0;
  let bassCompress = 0;
  let hihatScatter = 0;
  let dubGlow      = 0;
  let flashAmount  = 0;

  // Scan line state
  let scanLine    = -1;   // y in screen space, -1 = inactive
  let scanLineDir = 1;
  const SCAN_SPEED = 14;

  let firstFrame = true;

  // ── Init ──────────────────────────────────────────────────────────────
  function initCloud() {
    cloud = [];
    // Fibonacci spiral sphere distribution + noise displacement on radius
    const golden = Math.PI * (1 + Math.sqrt(5));
    for (let i = 0; i < SPHERE_POINTS; i++) {
      const phi    = Math.acos(1 - 2 * (i + 0.5) / SPHERE_POINTS);
      const theta  = golden * i;
      // Noise-displaced radius for organic feel
      const nx = Math.sin(phi) * Math.cos(theta);
      const ny = Math.sin(phi) * Math.sin(theta);
      const nz = Math.cos(phi);
      const noiseR = p.noise(nx * 1.5, ny * 1.5, nz * 1.5);
      const r = 2.0 + noiseR * 0.5;
      const x = r * nx;
      const y = r * ny;
      const z = r * nz;
      cloud.push({
        rx: x, ry: y, rz: z,
        x, y, z,
        vx: 0, vy: 0, vz: 0,
        brightness: 0.6 + Math.random() * 0.4,
      });
    }
  }

  function initScatter() {
    scatter = [];
    for (let i = 0; i < SCATTER_POINTS; i++) {
      // Random points in shell from r=2.8 to r=5
      const r = 2.8 + Math.random() * 2.2;
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(Math.random() * 2 - 1);
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);
      scatter.push({
        rx: x, ry: y, rz: z,
        x, y, z,
        vx: 0, vy: 0, vz: 0,
        brightness: 0.2 + Math.random() * 0.4,
      });
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
    initCloud();
    initScatter();
    firstFrame = true;
  };

  p.windowResized = () => {
    const parent = p.canvas?.parentElement;
    if (parent) {
      p.resizeCanvas(parent.clientWidth, parent.clientHeight);
      firstFrame = true;
    }
  };

  // ── Interaction (mouse drag rotates) ──────────────────────────────────
  p.mousePressed = () => {
    if (p.mouseX > 0 && p.mouseX < p.width && p.mouseY > 0 && p.mouseY < p.height) {
      dragging = true;
      dragLastX = p.mouseX;
      dragLastY = p.mouseY;
    }
  };
  p.mouseReleased = () => { dragging = false; };

  // ── 3D rotate + project to 2D screen ──────────────────────────────────
  function project(pt: Pt, cx: number, cy: number, scale: number) {
    let x = pt.x;
    let y = pt.y;
    let z = pt.z;

    // Bass compression (squash Z toward 0)
    z *= (1 - bassCompress * 0.45);

    // Y rotation (always spinning)
    const cosY = Math.cos(rotY);
    const sinY = Math.sin(rotY);
    const x1 = x * cosY - z * sinY;
    const z1 = x * sinY + z * cosY;

    // X rotation (drag-controlled)
    const cosX = Math.cos(rotX);
    const sinX = Math.sin(rotX);
    const y1 = y * cosX - z1 * sinX;
    const z2 = y * sinX + z1 * cosX;

    // Perspective — fit cloud to ~40% of canvas (use scale to track viewport)
    const dist = CAM_Z - z2;
    if (dist <= 0.1) return null;
    const viewportFactor = scale / 700; // 1.0 at 700px canvas, scales gracefully
    const f = (FOV * viewportFactor) / dist;
    return {
      sx: cx + x1 * f,
      sy: cy + y1 * f,
      depth: z2, // higher = closer to camera
      f: f,
    };
  }

  // ── Color a point based on depth ──────────────────────────────────────
  function colorForDepth(depth: number, brightness: number, isScatter: boolean) {
    // depth ranges roughly -3.5 → +3.5 in our cloud space
    // Normalize to 0..1 where 1 = nearest
    const t = Math.max(0, Math.min(1, (depth + 3) / 6));
    // Lerp far indigo → near cyan
    const r = PALETTE.far[0] + (PALETTE.accent[0] - PALETTE.far[0]) * t;
    const g = PALETTE.far[1] + (PALETTE.accent[1] - PALETTE.far[1]) * t;
    const b = PALETTE.far[2] + (PALETTE.accent[2] - PALETTE.far[2]) * t;
    const baseAlpha = isScatter ? 140 : 230;
    const alpha = baseAlpha * brightness * (0.55 + t * 0.45) + flashAmount * 80 + dubGlow * 40;
    return { r, g, b, a: alpha };
  }

  // ── Draw ──────────────────────────────────────────────────────────────
  p.draw = () => {
    const cx = p.width / 2;
    const cy = p.height / 2;
    const scale = Math.min(p.width, p.height);

    // ── Consume audio events ────────────────────────────────────────────
    const now = getAudioTime();
    for (let i = visualEvents.length - 1; i >= 0; i--) {
      const ev = visualEvents[i];
      if (now >= ev.time) {
        switch (ev.type) {
          case 'KICK':
            kickPulse = 1;
            // Outward velocity impulse on a random subset
            for (let k = 0; k < cloud.length; k += 1) {
              if (Math.random() < 0.5) {
                const d = Math.sqrt(cloud[k].x ** 2 + cloud[k].y ** 2 + cloud[k].z ** 2) + 0.01;
                const push = 0.06;
                cloud[k].vx += (cloud[k].x / d) * push;
                cloud[k].vy += (cloud[k].y / d) * push;
                cloud[k].vz += (cloud[k].z / d) * push;
              }
            }
            break;
          case 'BASS':
            bassCompress = 1;
            break;
          case 'HIHAT':
            hihatScatter = 1;
            break;
          case 'DUB':
            dubGlow = 1;
            scanLine = -10; // launch a downward sweep
            scanLineDir = 1;
            rotYVel = 0.012;
            break;
          case 'SNARE': {
            // Full radial explosion
            for (let k = 0; k < cloud.length; k++) {
              const d = Math.sqrt(cloud[k].x ** 2 + cloud[k].y ** 2 + cloud[k].z ** 2) + 0.01;
              cloud[k].vx += (cloud[k].x / d) * 0.12;
              cloud[k].vy += (cloud[k].y / d) * 0.12;
              cloud[k].vz += (cloud[k].z / d) * 0.12;
            }
            break;
          }
          case 'CLAP':
            flashAmount = 1;
            break;
        }
        visualEvents.splice(i, 1);
      }
    }

    // ── Decay envelopes ─────────────────────────────────────────────────
    kickPulse    *= 0.90;
    bassCompress *= 0.92;
    hihatScatter *= 0.85;
    dubGlow      *= 0.94;
    flashAmount  *= 0.88;
    rotYVel       = p.lerp(rotYVel, 0.0035, 0.04);
    rotY         += rotYVel;

    // Update scan line (top → bottom sweep when active)
    if (scanLine >= -1 && scanLine < p.height + 10) {
      scanLine += SCAN_SPEED * scanLineDir;
    }

    // ── Physics: strong spring back to rest + tight clamps ──────────────
    const allPoints = [cloud, scatter];
    for (const arr of allPoints) {
      for (let i = 0; i < arr.length; i++) {
        const pt = arr[i];
        // Spring force
        pt.vx = (pt.vx + (pt.rx - pt.x) * 0.18) * 0.78;
        pt.vy = (pt.vy + (pt.ry - pt.y) * 0.18) * 0.78;
        pt.vz = (pt.vz + (pt.rz - pt.z) * 0.18) * 0.78;
        // Hihat jitter
        if (hihatScatter > 0.05) {
          pt.vx += (Math.random() - 0.5) * hihatScatter * 0.04;
          pt.vy += (Math.random() - 0.5) * hihatScatter * 0.04;
          pt.vz += (Math.random() - 0.5) * hihatScatter * 0.04;
        }
        // Velocity clamp
        const speed = Math.sqrt(pt.vx ** 2 + pt.vy ** 2 + pt.vz ** 2);
        if (speed > 0.22) {
          const s = 0.22 / speed;
          pt.vx *= s; pt.vy *= s; pt.vz *= s;
        }
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.z += pt.vz;
        // Hard position clamp — never let a point drift further than 1.5x rest distance
        const dx = pt.x - pt.rx, dy = pt.y - pt.ry, dz = pt.z - pt.rz;
        const dDist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dDist > 1.5) {
          const s = 1.5 / dDist;
          pt.x = pt.rx + dx * s;
          pt.y = pt.ry + dy * s;
          pt.z = pt.rz + dz * s;
        }
      }
    }

    // ── Mouse drag → add X rotation ─────────────────────────────────────
    if (dragging && p.mouseIsPressed) {
      const dx = p.mouseX - dragLastX;
      const dy = p.mouseY - dragLastY;
      rotY += dx * 0.008;
      rotX += dy * 0.008;
      dragLastX = p.mouseX;
      dragLastY = p.mouseY;
    } else if (!p.mouseIsPressed) {
      dragging = false;
    }

    // ── Background fade (motion blur trails) ────────────────────────────
    if (firstFrame) {
      p.background(PALETTE.bg[0], PALETTE.bg[1], PALETTE.bg[2]);
      firstFrame = false;
    }
    p.noStroke();
    p.fill(PALETTE.bg[0], PALETTE.bg[1], PALETTE.bg[2], 22);
    p.rect(0, 0, p.width, p.height);

    // ── Draw scatter points first (back of scene) ───────────────────────
    p.noStroke();
    for (let i = 0; i < scatter.length; i++) {
      const proj = project(scatter[i], cx, cy, scale);
      if (!proj) continue;
      const c = colorForDepth(proj.depth, scatter[i].brightness, true);
      const size = Math.max(1.2, proj.f * 0.04);
      p.fill(c.r, c.g, c.b, c.a);
      p.circle(proj.sx, proj.sy, size);
    }

    // ── Draw main cloud ─────────────────────────────────────────────────
    for (let i = 0; i < cloud.length; i++) {
      const proj = project(cloud[i], cx, cy, scale);
      if (!proj) continue;
      const c = colorForDepth(proj.depth, cloud[i].brightness, false);

      // Scan line hit: brief brightness boost for points within ±20px of scanLine
      let scanBoost = 0;
      if (scanLine > 0 && scanLine < p.height + 10) {
        const dy = Math.abs(proj.sy - scanLine);
        if (dy < 20) {
          scanBoost = (1 - dy / 20) * 220;
        }
      }

      const size = Math.max(2, proj.f * 0.075 + kickPulse * 1.6);
      const alpha = Math.min(255, c.a + scanBoost + kickPulse * 80);

      // Glow halo for near points or scan-line-hit points
      if (proj.depth > 0.5 || scanBoost > 0) {
        const haloA = (scanBoost * 0.5 + flashAmount * 80) * 0.5 + (proj.depth + 3) * 8;
        p.fill(PALETTE.accent[0], PALETTE.accent[1], PALETTE.accent[2], haloA);
        p.circle(proj.sx, proj.sy, size * 2.4);
      }

      p.fill(c.r, c.g, c.b, alpha);
      p.circle(proj.sx, proj.sy, size);

      // Bright core on nearest points
      if (proj.depth > 1.8) {
        p.fill(PALETTE.text[0], PALETTE.text[1], PALETTE.text[2], 200 + flashAmount * 55);
        p.circle(proj.sx, proj.sy, size * 0.45);
      }
    }

    // ── Scan line overlay ───────────────────────────────────────────────
    if (scanLine > 0 && scanLine < p.height + 10) {
      // Thin bright cyan horizontal beam
      p.noStroke();
      p.fill(PALETTE.accent[0], PALETTE.accent[1], PALETTE.accent[2], 28);
      p.rect(0, scanLine - 2, p.width, 4);
      // Hot core
      p.fill(PALETTE.text[0], PALETTE.text[1], PALETTE.text[2], 90);
      p.rect(0, scanLine - 0.5, p.width, 1);
    }

    // ── CLAP flash: brief connecting lines between near neighbors ───────
    if (flashAmount > 0.3) {
      p.stroke(PALETTE.accent[0], PALETTE.accent[1], PALETTE.accent[2], flashAmount * 80);
      p.strokeWeight(0.4);
      // Sample 80 random pairs from the cloud
      for (let k = 0; k < 80; k++) {
        const a = cloud[Math.floor(Math.random() * cloud.length)];
        const b = cloud[Math.floor(Math.random() * cloud.length)];
        const pa = project(a, cx, cy, scale);
        const pb = project(b, cx, cy, scale);
        if (pa && pb) {
          const d = Math.sqrt((pa.sx - pb.sx) ** 2 + (pa.sy - pb.sy) ** 2);
          if (d < 90) p.line(pa.sx, pa.sy, pb.sx, pb.sy);
        }
      }
      p.noStroke();
    }
  };
};
