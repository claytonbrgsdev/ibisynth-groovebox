// Placeholder Scene 2: Perlin Flow Field
// Particles follow a Perlin noise vector field, leaving fading trails.
// Palette: bg #F2F2F0, dark #111111, gray #7A7A7A, accent #E0DED8

import { getAudioTime, visualEvents } from '../lib/audio';

export const placeholderSketch2 = (p: any) => {
  const PALETTE = {
    bg: [242, 242, 240],
    dark: [17, 17, 17],
    gray: [122, 122, 122],
    accent: [224, 222, 216],
  };

  const NUM_PARTICLES = 160;
  let FIELD_SCALE = 0.003;
  let SPEED = 2.2;

  // --- Audio impact variables ---
  let kickImpact  = 0;
  let snareImpact = 0;
  let hihatImpact = 0;
  let clapImpact  = 0;
  let bassImpact  = 0;
  let dubImpact   = 0;
  const smpImpact = [0, 0, 0, 0];
  let kickBurstAngle = 0; // direction of kick force burst

  // Clear any stale events from a previous scene
  visualEvents.length = 0;

  interface Particle {
    x: number;
    y: number;
    px: number; // previous x
    py: number; // previous y
    age: number;
    maxAge: number;
    colorIdx: number;
  }

  let particles: Particle[] = [];
  let frameBuffer: any = null; // off-screen graphics for fading trails

  const spawnParticle = (): Particle => ({
    x: p.random(p.width),
    y: p.random(p.height),
    px: 0,
    py: 0,
    age: 0,
    maxAge: p.random(80, 200),
    colorIdx: Math.floor(p.random(3)),
  });

  p.setup = () => {
    const parent = p.canvas?.parentElement;
    const w = parent ? parent.clientWidth : 600;
    const h = parent ? parent.clientHeight : 300;
    p.createCanvas(w, h);
    frameBuffer = p.createGraphics(w, h);
    frameBuffer.background(PALETTE.bg[0], PALETTE.bg[1], PALETTE.bg[2]);
    p.smooth();

    for (let i = 0; i < NUM_PARTICLES; i++) {
      const pt = spawnParticle();
      pt.px = pt.x;
      pt.py = pt.y;
      particles.push(pt);
    }
  };

  p.windowResized = () => {
    const parent = p.canvas?.parentElement;
    if (parent) {
      p.resizeCanvas(parent.clientWidth, parent.clientHeight);
      // Recreate buffer at new size
      frameBuffer = p.createGraphics(parent.clientWidth, parent.clientHeight);
      frameBuffer.background(PALETTE.bg[0], PALETTE.bg[1], PALETTE.bg[2]);
      // Respawn particles within new bounds
      particles = [];
      for (let i = 0; i < NUM_PARTICLES; i++) {
        const pt = spawnParticle();
        pt.px = pt.x;
        pt.py = pt.y;
        particles.push(pt);
      }
    }
  };

  p.draw = () => {
    const t = p.millis() * 0.0003;
    const now = getAudioTime();

    // --- Consume visual events (iterate backwards so splice is safe) ---
    for (let i = visualEvents.length - 1; i >= 0; i--) {
      const ev = visualEvents[i];
      if (now >= ev.time) {
        if (ev.type === 'KICK') {
          kickImpact = 1.0;
          kickBurstAngle = Math.random() * Math.PI * 2;
        } else if (ev.type === 'SNARE') {
          snareImpact = 1.0;
        } else if (ev.type === 'HIHAT') {
          hihatImpact = 1.0;
        } else if (ev.type === 'CLAP') {
          clapImpact = 1.0;
          for (const pt of particles) { pt.age = pt.maxAge; }
        } else if (ev.type === 'BASS') {
          bassImpact = 1.0;
        } else if (ev.type === 'DUB') {
          dubImpact = 1.0;
        } else if (ev.type === 'SAMPLE') {
          const idx = ev.param as number;
          if (idx >= 0 && idx <= 3) {
            smpImpact[idx] = 1.0;
          }
        }
        visualEvents.splice(i, 1);
      }
    }

    // --- Decay impact values each frame ---
    kickImpact  = p.lerp(kickImpact,  0, 0.10);
    snareImpact = p.lerp(snareImpact, 0, 0.08);
    hihatImpact = p.lerp(hihatImpact, 0, 0.20);
    clapImpact  = p.lerp(clapImpact,  0, 0.12);
    bassImpact  = p.lerp(bassImpact,  0, 0.07);
    dubImpact   = p.lerp(dubImpact,   0, 0.04);
    for (let i = 0; i < 4; i++) {
      smpImpact[i] = p.lerp(smpImpact[i], 0, 0.10);
    }

    // --- Compute per-frame derived speed & field scale ---
    const currentSpeed      = SPEED * (1 + hihatImpact * 2.5 + bassImpact * 1.8);
    const currentFieldScale = FIELD_SCALE * (1 + hihatImpact * 4.0);

    // --- Slowly fade the off-screen buffer toward bg ---
    // DUB reduces fade alpha (trails linger); SNARE increases it (faster clearing).
    const fadeAlpha = Math.max(2, 18 + snareImpact * 40 - dubImpact * 14);
    frameBuffer.noStroke();
    frameBuffer.fill(PALETTE.bg[0], PALETTE.bg[1], PALETTE.bg[2], fadeAlpha);
    frameBuffer.rect(0, 0, frameBuffer.width, frameBuffer.height);

    // --- Update and draw each particle onto the buffer ---
    for (let i = 0; i < particles.length; i++) {
      const pt = particles[i];

      // Sample Perlin noise for flow angle
      const angle = p.noise(pt.x * currentFieldScale, pt.y * currentFieldScale, t) * p.TWO_PI * 2.4;

      pt.px = pt.x;
      pt.py = pt.y;
      pt.x += Math.cos(angle) * currentSpeed;
      pt.y += Math.sin(angle) * currentSpeed;

      // KICK — burst all particles in the random direction
      if (kickImpact > 0.005) {
        pt.x += Math.cos(kickBurstAngle) * kickImpact * 18;
        pt.y += Math.sin(kickBurstAngle) * kickImpact * 18;
      }

      // SMP_00 — explosive radial burst from top-left corner
      if (smpImpact[0] > 0.005 && pt.x < p.width / 2 && pt.y < p.height / 2) {
        const dx = pt.x, dy = pt.y;
        const dist = Math.sqrt(dx * dx + dy * dy) + 1;
        pt.x += (dx / dist) * smpImpact[0] * 25;
        pt.y += (dy / dist) * smpImpact[0] * 25;
      }

      // SMP_01 — clockwise tangential spin in top-right quadrant
      if (smpImpact[1] > 0.005 && pt.x > p.width / 2 && pt.y < p.height / 2) {
        const dx = pt.x - p.width, dy = pt.y;
        const dist = Math.sqrt(dx * dx + dy * dy) + 1;
        pt.x += (-dy / dist) * smpImpact[1] * 20;
        pt.y += (dx / dist) * smpImpact[1] * 20;
      }

      // SMP_02 — attraction toward canvas center for bottom-left quadrant
      if (smpImpact[2] > 0.005 && pt.x < p.width / 2 && pt.y > p.height / 2) {
        const dx = p.width / 2 - pt.x, dy = p.height / 2 - pt.y;
        const dist = Math.sqrt(dx * dx + dy * dy) + 1;
        pt.x += (dx / dist) * smpImpact[2] * 22;
        pt.y += (dy / dist) * smpImpact[2] * 22;
      }

      // SMP_03 — color randomization + shortened lifespan for bottom-right quadrant
      if (smpImpact[3] > 0.005 && pt.x > p.width / 2 && pt.y > p.height / 2) {
        if (Math.random() < smpImpact[3] * 0.15) {
          pt.colorIdx = Math.floor(Math.random() * 3);
          pt.maxAge = Math.min(pt.maxAge, pt.age + 30);
        }
      }

      pt.age++;

      // Life alpha: fade in and out
      const lifeRatio = pt.age / pt.maxAge;
      const alpha = lifeRatio < 0.1
        ? p.map(lifeRatio, 0, 0.1, 0, 180)
        : lifeRatio > 0.85
          ? p.map(lifeRatio, 0.85, 1, 180, 0)
          : 180;

      // Pick stroke color per particle — base from colorIdx, then audio overrides
      let [r, g, b] = pt.colorIdx === 0
        ? PALETTE.dark
        : pt.colorIdx === 1
          ? PALETTE.gray
          : PALETTE.accent;

      // BASS pushes color toward accent
      if (bassImpact > 0.5) [r, g, b] = PALETTE.accent;
      // SNARE overrides to dark (higher priority)
      if (snareImpact > 0.3) [r, g, b] = PALETTE.dark;

      frameBuffer.stroke(r, g, b, alpha);
      frameBuffer.strokeWeight(pt.colorIdx === 0 ? 1.2 : 0.8);
      frameBuffer.line(pt.px, pt.py, pt.x, pt.y);

      // Respawn if out of bounds or too old
      if (
        pt.age >= pt.maxAge ||
        pt.x < -2 || pt.x > p.width + 2 ||
        pt.y < -2 || pt.y > p.height + 2
      ) {
        const next = spawnParticle();
        next.px = next.x;
        next.py = next.y;
        particles[i] = next;
      }
    }

    // Blit buffer to canvas
    p.image(frameBuffer, 0, 0);

    // Subtle corner labels / decoration — tiny crosshair marks at key points
    p.noFill();
    p.stroke(PALETTE.dark[0], PALETTE.dark[1], PALETTE.dark[2], 40);
    p.strokeWeight(0.8);
    [[10, 10], [p.width - 10, 10], [10, p.height - 10], [p.width - 10, p.height - 10]].forEach(([cx, cy]) => {
      p.line(cx - 5, cy, cx + 5, cy);
      p.line(cx, cy - 5, cx, cy + 5);
    });
  };
};
