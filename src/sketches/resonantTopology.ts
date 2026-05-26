import { getAudioTime, visualEvents } from '../lib/audio';

// RESONANT TOPOLOGY
// Three-layer audio-reactive composition for the hero:
//   1. Drifting particle flow field (always alive, noise-based)
//   2. Central polygonal lattice (always rotating, breathing)
//   3. Audio shockwaves & flash overlays (event-driven)

const PALETTE = {
  bg:     [12, 11, 9]     as const,
  text:   [230, 224, 212] as const,
  accent: [196, 162, 100] as const,
  muted:  [46, 45, 42]    as const,
};

const PARTICLE_COUNT = 700;
const RING_VERTICES  = 24;
const INNER_VERTICES = 8;

export const resonantTopologySketch = (p: any) => {

  type Particle  = { x: number; y: number; vx: number; vy: number; px: number; py: number };
  type Vertex    = { angle: number; baseRadius: number; phase: number };
  type Shockwave = { x: number; y: number; r: number; life: number; speed: number };

  let particles:    Particle[]  = [];
  let outerRing:    Vertex[]    = [];
  let innerRing:    Vertex[]    = [];
  let shockwaves:   Shockwave[] = [];

  // State envelopes — decay each frame
  let rotation     = 0;
  let rotationVel  = 0.0008;
  let scalePulse   = 1;
  let glowAmount   = 0;
  let flashAmount  = 0;
  let bassMod      = 0;
  let hihatJitter  = 0;

  let firstFrame = true;

  // ── Init ──────────────────────────────────────────────────────────────────
  function initParticles(w: number, h: number) {
    particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const x = p.random(w);
      const y = p.random(h);
      particles.push({ x, y, vx: 0, vy: 0, px: x, py: y });
    }
  }

  function initVertices() {
    outerRing = [];
    for (let i = 0; i < RING_VERTICES; i++) {
      outerRing.push({
        angle: (i / RING_VERTICES) * p.TWO_PI,
        baseRadius: 1,
        phase: i * 0.31,
      });
    }
    innerRing = [];
    for (let i = 0; i < INNER_VERTICES; i++) {
      innerRing.push({
        angle: (i / INNER_VERTICES) * p.TWO_PI + 0.1,
        baseRadius: 0.42,
        phase: i * 0.71,
      });
    }
  }

  // ── Setup ─────────────────────────────────────────────────────────────────
  p.setup = () => {
    const parent = p.canvas?.parentElement;
    const w = parent ? parent.clientWidth : 800;
    const h = parent ? parent.clientHeight : 600;
    p.createCanvas(w, h);
    p.pixelDensity(1);
    p.smooth();
    visualEvents.length = 0;
    initParticles(w, h);
    initVertices();
    firstFrame = true;
  };

  p.windowResized = () => {
    const parent = p.canvas?.parentElement;
    if (parent) {
      p.resizeCanvas(parent.clientWidth, parent.clientHeight);
      initParticles(p.width, p.height);
      firstFrame = true;
    }
  };

  // ── Draw ──────────────────────────────────────────────────────────────────
  p.draw = () => {
    const t  = p.millis() * 0.001;
    const cx = p.width / 2;
    const cy = p.height / 2;

    // ── Consume audio events ───────────────────────────────────────────────
    const now = getAudioTime();
    for (let i = visualEvents.length - 1; i >= 0; i--) {
      const ev = visualEvents[i];
      if (now >= ev.time) {
        switch (ev.type) {
          case 'KICK': {
            const ex = cx + p.random(-p.width * 0.2, p.width * 0.2);
            const ey = cy + p.random(-p.height * 0.2, p.height * 0.2);
            shockwaves.push({ x: ex, y: ey, r: 0, life: 1, speed: 9 });
            scalePulse = 1.35;
            // Push particles outward from epicenter
            for (let k = 0; k < particles.length; k++) {
              const pa = particles[k];
              const dx = pa.x - ex;
              const dy = pa.y - ey;
              const d  = Math.sqrt(dx * dx + dy * dy) + 1;
              if (d < 300) {
                const push = (1 - d / 300) * 4;
                pa.vx += (dx / d) * push;
                pa.vy += (dy / d) * push;
              }
            }
            break;
          }
          case 'BASS':
            bassMod = 1;
            break;
          case 'HIHAT':
            hihatJitter = 1;
            break;
          case 'DUB':
            glowAmount = 1;
            rotationVel = 0.006; // burst of spin
            break;
          case 'SNARE': {
            // Inward-then-outward particle explosion from center
            for (let k = 0; k < particles.length; k++) {
              const pa = particles[k];
              const dx = pa.x - cx;
              const dy = pa.y - cy;
              const d  = Math.sqrt(dx * dx + dy * dy) + 1;
              pa.vx += (dx / d) * 6;
              pa.vy += (dy / d) * 6;
            }
            shockwaves.push({ x: cx, y: cy, r: 0, life: 0.7, speed: 14 });
            break;
          }
          case 'CLAP':
            flashAmount = 1;
            break;
        }
        visualEvents.splice(i, 1);
      }
    }

    // ── Decay envelopes ────────────────────────────────────────────────────
    scalePulse  = p.lerp(scalePulse, 1, 0.06);
    glowAmount *= 0.93;
    flashAmount *= 0.86;
    bassMod    *= 0.92;
    hihatJitter *= 0.84;
    rotationVel = p.lerp(rotationVel, 0.0008, 0.04);
    rotation   += rotationVel;

    // ── Background fade (motion blur) ──────────────────────────────────────
    if (firstFrame) {
      p.background(PALETTE.bg[0], PALETTE.bg[1], PALETTE.bg[2]);
      firstFrame = false;
    }
    p.noStroke();
    p.fill(PALETTE.bg[0], PALETTE.bg[1], PALETTE.bg[2], 28);
    p.rect(0, 0, p.width, p.height);

    // ── LAYER 1: Particle flow field ──────────────────────────────────────
    const noiseScale = 0.0028;
    const noiseTime  = p.frameCount * 0.0007;

    for (let i = 0; i < particles.length; i++) {
      const pa = particles[i];
      pa.px = pa.x;
      pa.py = pa.y;

      // Noise-driven flow
      const n = p.noise(pa.x * noiseScale, pa.y * noiseScale, noiseTime);
      const angle = n * p.TWO_PI * 3;
      pa.vx = pa.vx * 0.91 + Math.cos(angle) * 0.35;
      pa.vy = pa.vy * 0.91 + Math.sin(angle) * 0.35;

      // Mouse gravity well
      const mdx = pa.x - p.mouseX;
      const mdy = pa.y - p.mouseY;
      const md  = Math.sqrt(mdx * mdx + mdy * mdy);
      if (md < 160 && md > 1) {
        const sign  = p.mouseIsPressed ? 1 : -1;
        const force = (1 - md / 160) * 0.6;
        pa.vx += sign * (mdx / md) * force;
        pa.vy += sign * (mdy / md) * force;
      }

      pa.x += pa.vx;
      pa.y += pa.vy;

      // Wrap edges
      if (pa.x < 0)        { pa.x = p.width;  pa.px = pa.x; }
      if (pa.x > p.width)  { pa.x = 0;        pa.px = pa.x; }
      if (pa.y < 0)        { pa.y = p.height; pa.py = pa.y; }
      if (pa.y > p.height) { pa.y = 0;        pa.py = pa.y; }

      // Draw particle trail
      const speed = Math.sqrt(pa.vx * pa.vx + pa.vy * pa.vy);
      const tint  = Math.min(speed * 0.3 + flashAmount * 0.6, 1);
      const r = PALETTE.muted[0] + (PALETTE.accent[0] - PALETTE.muted[0]) * tint;
      const g = PALETTE.muted[1] + (PALETTE.accent[1] - PALETTE.muted[1]) * tint;
      const b = PALETTE.muted[2] + (PALETTE.accent[2] - PALETTE.muted[2]) * tint;
      const alpha = 50 + speed * 28 + flashAmount * 90;
      p.stroke(r, g, b, alpha);
      p.strokeWeight(0.55);
      p.line(pa.px, pa.py, pa.x, pa.y);
    }

    // ── LAYER 2: Central polygonal lattice ────────────────────────────────
    const baseRadius = Math.min(p.width, p.height) * 0.22 * scalePulse;

    p.push();
    p.translate(cx, cy);
    p.rotate(rotation);

    // Compute outer vertex positions
    const outerPts = outerRing.map((v) => {
      const breathe = Math.sin(t * 0.85 + v.phase) * 0.12 + 1;
      const jitter  = hihatJitter * p.random(-12, 12);
      const bassOsc = bassMod * 28 * Math.sin(t * 5 + v.phase * 2);
      const r = baseRadius * v.baseRadius * breathe + jitter + bassOsc;
      return { x: Math.cos(v.angle) * r, y: Math.sin(v.angle) * r };
    });

    // Compute inner vertex positions (counter-rotates slightly)
    const innerPts = innerRing.map((v) => {
      const breathe = Math.sin(t * 1.2 + v.phase) * 0.18 + 1;
      const bassOsc = bassMod * 18 * Math.cos(t * 3 + v.phase * 2);
      const r = baseRadius * v.baseRadius * breathe + bassOsc;
      const a = v.angle - rotation * 1.5; // counter-rotate
      return { x: Math.cos(a) * r, y: Math.sin(a) * r };
    });

    // Outer ring — connect each vertex to its 3 nearest neighbors (chord net)
    p.strokeWeight(0.7);
    for (let i = 0; i < outerPts.length; i++) {
      for (let step = 1; step <= 3; step++) {
        const j = (i + step) % outerPts.length;
        const a = outerPts[i];
        const b = outerPts[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = baseRadius * 1.5;
        const t01 = 1 - Math.min(dist / maxDist, 1);
        const tint = Math.min(0.4 + t01 * 0.6 + flashAmount * 0.4, 1);
        const r = PALETTE.muted[0] + (PALETTE.accent[0] - PALETTE.muted[0]) * tint;
        const g = PALETTE.muted[1] + (PALETTE.accent[1] - PALETTE.muted[1]) * tint;
        const bl = PALETTE.muted[2] + (PALETTE.accent[2] - PALETTE.muted[2]) * tint;
        const alpha = 90 + t01 * 100 + flashAmount * 120 + glowAmount * 60;
        p.stroke(r, g, bl, alpha);
        p.strokeWeight(0.5 + t01 * 0.9 + glowAmount * 0.5);
        p.line(a.x, a.y, b.x, b.y);
      }
    }

    // Inner ring — fully connected (small clique)
    for (let i = 0; i < innerPts.length; i++) {
      for (let j = i + 1; j < innerPts.length; j++) {
        const a = innerPts[i];
        const b = innerPts[j];
        const alpha = 70 + flashAmount * 120 + glowAmount * 60;
        p.stroke(PALETTE.accent[0], PALETTE.accent[1], PALETTE.accent[2], alpha);
        p.strokeWeight(0.45 + glowAmount * 0.5);
        p.line(a.x, a.y, b.x, b.y);
      }
    }

    // Bridges — each outer connected to its nearest inner
    for (let i = 0; i < outerPts.length; i++) {
      const o = outerPts[i];
      let bestJ = 0, bestD = Infinity;
      for (let j = 0; j < innerPts.length; j++) {
        const d = (o.x - innerPts[j].x) ** 2 + (o.y - innerPts[j].y) ** 2;
        if (d < bestD) { bestD = d; bestJ = j; }
      }
      const inn = innerPts[bestJ];
      const alpha = 40 + flashAmount * 100 + glowAmount * 50;
      const tint = 0.5 + glowAmount * 0.5;
      const r = PALETTE.muted[0] + (PALETTE.accent[0] - PALETTE.muted[0]) * tint;
      const g = PALETTE.muted[1] + (PALETTE.accent[1] - PALETTE.muted[1]) * tint;
      const bl = PALETTE.muted[2] + (PALETTE.accent[2] - PALETTE.muted[2]) * tint;
      p.stroke(r, g, bl, alpha);
      p.strokeWeight(0.4);
      p.line(o.x, o.y, inn.x, inn.y);
    }

    // Vertices — glow + core
    p.noStroke();

    for (let i = 0; i < outerPts.length; i++) {
      const o = outerPts[i];
      const baseSize = 3 + bassMod * 5 + flashAmount * 6 + glowAmount * 3;
      // Outer glow
      p.fill(PALETTE.accent[0], PALETTE.accent[1], PALETTE.accent[2], 28 + flashAmount * 80 + glowAmount * 40);
      p.circle(o.x, o.y, baseSize * 2.8);
      // Core
      p.fill(PALETTE.text[0], PALETTE.text[1], PALETTE.text[2], 200 + flashAmount * 55);
      p.circle(o.x, o.y, baseSize);
    }

    for (let i = 0; i < innerPts.length; i++) {
      const inn = innerPts[i];
      const baseSize = 2.5 + bassMod * 4 + flashAmount * 5;
      p.fill(PALETTE.accent[0], PALETTE.accent[1], PALETTE.accent[2], 40 + flashAmount * 90 + glowAmount * 50);
      p.circle(inn.x, inn.y, baseSize * 2.2);
      p.fill(PALETTE.accent[0], PALETTE.accent[1], PALETTE.accent[2], 220);
      p.circle(inn.x, inn.y, baseSize);
    }

    p.pop();

    // ── LAYER 3: Audio shockwaves ─────────────────────────────────────────
    for (let i = shockwaves.length - 1; i >= 0; i--) {
      const sw = shockwaves[i];
      sw.r += sw.speed;
      sw.life *= 0.955;

      if (sw.life < 0.02) {
        shockwaves.splice(i, 1);
        continue;
      }

      p.noFill();
      p.stroke(PALETTE.accent[0], PALETTE.accent[1], PALETTE.accent[2], sw.life * 220);
      p.strokeWeight(1.6 * sw.life);
      p.circle(sw.x, sw.y, sw.r * 2);
    }
  };
};
