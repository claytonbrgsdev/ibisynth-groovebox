import { getAudioTime, visualEvents } from '../lib/audio';

// RESONANCE FIELD — Spring-physics mesh, audio-reactive
// 20×12 nodes · spring restore · mouse gravity · 5 audio reactions

export const resonanceFieldSketch = (p: any) => {
  const COLS = 20;
  const ROWS = 12;

  const BG    = [12, 11, 9]     as const;
  const ACC   = [196, 162, 100] as const;
  const MUTED = [46, 45, 42]    as const;

  type Node = { x: number; y: number; vx: number; vy: number; ox: number; oy: number };
  let nodes: Node[] = [];

  let clapFlash = 0;
  let firstFrame = true;

  // Pending audio impulses — applied at start of next draw
  let pendingKick  = false;
  let pendingBass  = false;
  let pendingHihat = false;
  let pendingDub   = false;
  let pendingSnare = false;

  // ── Init / reinit mesh ───────────────────────────────────────────────────────
  function initNodes() {
    nodes = [];
    const w = p.width;
    const h = p.height;
    const spacingX = (w - 40) / (COLS - 1);
    const spacingY = (h - 40) / (ROWS - 1);
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const ox = 20 + col * spacingX;
        const oy = 20 + row * spacingY;
        nodes.push({ x: ox, y: oy, vx: 0, vy: 0, ox, oy });
      }
    }
  }

  // ── Setup ────────────────────────────────────────────────────────────────────
  p.setup = () => {
    const parent = p.canvas?.parentElement;
    const w = parent ? parent.clientWidth : 800;
    const h = parent ? parent.clientHeight : 500;
    p.createCanvas(w, h);
    p.pixelDensity(1);
    p.smooth();
    visualEvents.length = 0;
    initNodes();
    firstFrame = true;
  };

  p.windowResized = () => {
    const parent = p.canvas?.parentElement;
    if (parent) {
      p.resizeCanvas(parent.clientWidth, parent.clientHeight);
      initNodes();
      firstFrame = true;
    }
  };

  // ── Draw ─────────────────────────────────────────────────────────────────────
  p.draw = () => {
    // 1. Consume audio events
    const now = getAudioTime();
    for (let i = visualEvents.length - 1; i >= 0; i--) {
      const ev = visualEvents[i];
      if (now >= ev.time) {
        switch (ev.type) {
          case 'KICK':   pendingKick  = true; break;
          case 'BASS':   pendingBass  = true; break;
          case 'HIHAT':  pendingHihat = true; break;
          case 'DUB':    pendingDub   = true; break;
          case 'SNARE':  pendingSnare = true; break;
          case 'CLAP':   clapFlash = 1.0;     break;
        }
        visualEvents.splice(i, 1);
      }
    }

    // 2. Apply pending impulses
    if (pendingKick) {
      applyKick();
      pendingKick = false;
    }
    if (pendingBass) {
      applyBass();
      pendingBass = false;
    }
    if (pendingHihat) {
      applyHihat();
      pendingHihat = false;
    }
    if (pendingDub) {
      applyDub();
      pendingDub = false;
    }
    if (pendingSnare) {
      applySnare();
      pendingSnare = false;
    }

    // 3. Physics update
    const mx = p.mouseX;
    const my = p.mouseY;
    const repel = p.mouseIsPressed;

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];

      // Spring restore
      n.vx = (n.vx + (n.ox - n.x) * 0.08) * 0.88;
      n.vy = (n.vy + (n.oy - n.y) * 0.08) * 0.88;
      n.x += n.vx;
      n.y += n.vy;

      // Clamp displacement
      const dx = n.x - n.ox;
      const dy = n.y - n.oy;
      const d2 = dx * dx + dy * dy;
      if (d2 > 1600) { // 40² = 1600
        const scale = 40 / Math.sqrt(d2);
        n.x = n.ox + dx * scale;
        n.y = n.oy + dy * scale;
        n.vx *= scale;
        n.vy *= scale;
      }

      // Mouse gravity / repel
      const mdx = n.x - mx;
      const mdy = n.y - my;
      const md  = Math.sqrt(mdx * mdx + mdy * mdy);
      if (md < 120 && md > 0.5) {
        const strength = (1 - md / 120) * 0.12;
        const sign = repel ? 1 : -1;
        n.vx += sign * (mdx / md) * strength;
        n.vy += sign * (mdy / md) * strength;
      }
    }

    // 4. Render
    if (firstFrame) {
      p.background(...BG);
      firstFrame = false;
    }

    // Motion blur overlay
    p.noStroke();
    p.fill(BG[0], BG[1], BG[2], 30);
    p.rect(0, 0, p.width, p.height);

    clapFlash *= 0.92;

    // Draw edges
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const idx = row * COLS + col;
        const A = nodes[idx];
        const dA = Math.min(
          Math.sqrt((A.x - A.ox) ** 2 + (A.y - A.oy) ** 2) / 30,
          1
        );

        // Horizontal edge
        if (col < COLS - 1) {
          const B = nodes[idx + 1];
          const dB = Math.min(
            Math.sqrt((B.x - B.ox) ** 2 + (B.y - B.oy) ** 2) / 30,
            1
          );
          const t = (dA + dB) / 2;
          const r = MUTED[0] + (ACC[0] - MUTED[0]) * t;
          const g = MUTED[1] + (ACC[1] - MUTED[1]) * t;
          const b = MUTED[2] + (ACC[2] - MUTED[2]) * t;
          const alpha = 180 + clapFlash * 60;
          p.stroke(r, g, b, alpha);
          p.strokeWeight(1 + t * 1.5);
          p.line(A.x, A.y, B.x, B.y);
        }

        // Vertical edge
        if (row < ROWS - 1) {
          const B = nodes[(row + 1) * COLS + col];
          const dB = Math.min(
            Math.sqrt((B.x - B.ox) ** 2 + (B.y - B.oy) ** 2) / 30,
            1
          );
          const t = (dA + dB) / 2;
          const r = MUTED[0] + (ACC[0] - MUTED[0]) * t;
          const g = MUTED[1] + (ACC[1] - MUTED[1]) * t;
          const b = MUTED[2] + (ACC[2] - MUTED[2]) * t;
          const alpha = 180 + clapFlash * 60;
          p.stroke(r, g, b, alpha);
          p.strokeWeight(1 + t * 1.5);
          p.line(A.x, A.y, B.x, B.y);
        }
      }
    }

    // Draw node dots
    p.noStroke();
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const disp = Math.min(Math.sqrt(n.vx * n.vx + n.vy * n.vy) * 2, 1);
      const r = MUTED[0] + (ACC[0] - MUTED[0]) * disp;
      const g = MUTED[1] + (ACC[1] - MUTED[1]) * disp;
      const b = MUTED[2] + (ACC[2] - MUTED[2]) * disp;
      p.fill(r, g, b, 200);
      p.circle(n.x, n.y, 2 + disp * 3);
    }
  };

  // ── Audio impulse functions ──────────────────────────────────────────────────
  function applyKick() {
    const epicenter = nodes[Math.floor(p.random(nodes.length))];
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const dx = n.x - epicenter.x;
      const dy = n.y - epicenter.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 200) {
        const impulse = 0.3 * (1 - dist / 200);
        n.vx += (dx / (dist + 1)) * impulse * 8;
        n.vy += (dy / (dist + 1)) * impulse * 8;
      }
    }
  }

  function applyBass() {
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      n.vy += Math.sin(n.ox * 0.03 + p.frameCount * 0.1) * 0.8;
    }
  }

  function applyHihat() {
    for (let k = 0; k < 12; k++) {
      const n = nodes[Math.floor(p.random(nodes.length))];
      n.vx += p.random(-1.5, 1.5);
      n.vy += p.random(-1.5, 1.5);
    }
  }

  function applyDub() {
    const src1 = { x: p.width * 0.3, y: p.height * 0.5 };
    const src2 = { x: p.width * 0.7, y: p.height * 0.5 };
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const d1x = n.x - src1.x;
      const d1y = n.y - src1.y;
      const d2x = n.x - src2.x;
      const d2y = n.y - src2.y;
      const d1 = Math.sqrt(d1x * d1x + d1y * d1y);
      const d2 = Math.sqrt(d2x * d2x + d2y * d2y);
      n.vy +=
        Math.sin(d1 * 0.08 - p.frameCount * 0.15) * 0.4 +
        Math.sin(d2 * 0.08 - p.frameCount * 0.15) * 0.4;
    }
  }

  function applySnare() {
    const cx = p.width / 2;
    const cy = p.height / 2;
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const dx = n.x - cx;
      const dy = n.y - cy;
      const d = Math.sqrt(dx * dx + dy * dy) + 1;
      n.vx += (dx / d) * 2.0;
      n.vy += (dy / d) * 2.0;
    }
  }
};
