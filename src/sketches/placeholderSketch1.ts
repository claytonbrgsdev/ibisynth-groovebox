import { getAudioTime, visualEvents } from '../lib/audio';

// SCN_02 — Lissajous Grid, audio-reactive
// 10 reactions: KICK / SNARE / HIHAT / CLAP / BASS / DUB / SMP_00-03

export const placeholderSketch1 = (p: any) => {
  const COLS = 5;
  const ROWS = 4;
  const BG    = [12, 11, 9] as const;
  const MUTED = [46, 45, 42] as const;
  const ACC   = [196, 162, 100] as const;
  const TEXT  = [230, 224, 212] as const;

  // Audio impact values (0→1, decayed each frame)
  let kickImpact  = 0;
  let snareImpact = 0;
  let hihatImpact = 0;
  let clapImpact  = 0;
  let bassImpact  = 0;
  let dubImpact   = 0;
  const smpImpact = [0, 0, 0, 0];

  visualEvents.length = 0;

  p.setup = () => {
    const parent = p.canvas?.parentElement;
    const w = parent ? parent.clientWidth : 600;
    const h = parent ? parent.clientHeight : 400;
    p.createCanvas(w, h);
    p.smooth();
  };

  p.windowResized = () => {
    const parent = p.canvas?.parentElement;
    if (parent) p.resizeCanvas(parent.clientWidth, parent.clientHeight);
  };

  p.draw = () => {
    const t   = p.millis() * 0.001;
    const now = getAudioTime();

    // Consume visual events
    for (let i = visualEvents.length - 1; i >= 0; i--) {
      const ev = visualEvents[i];
      if (now >= ev.time) {
        switch (ev.type) {
          case 'KICK':   kickImpact  = 1.0; break;
          case 'SNARE':  snareImpact = 1.0; break;
          case 'HIHAT':  hihatImpact = 1.0; break;
          case 'CLAP':   clapImpact  = 1.0; break;
          case 'BASS':   bassImpact  = 1.0; break;
          case 'DUB':    dubImpact   = 1.0; break;
          case 'SAMPLE':
            if (ev.param >= 0 && ev.param < 4) smpImpact[ev.param] = 1.0;
            break;
        }
        visualEvents.splice(i, 1);
      }
    }

    // Decay
    kickImpact  = p.lerp(kickImpact,  0, 0.12);
    snareImpact = p.lerp(snareImpact, 0, 0.07);
    hihatImpact = p.lerp(hihatImpact, 0, 0.22);
    clapImpact  = p.lerp(clapImpact,  0, 0.09);
    bassImpact  = p.lerp(bassImpact,  0, 0.07);
    dubImpact   = p.lerp(dubImpact,   0, 0.05);
    for (let s = 0; s < 4; s++) smpImpact[s] = p.lerp(smpImpact[s], 0, 0.10);

    // SNARE impact is preserved; palette endpoints are now both IBISYNTH background.
    const bgR = p.lerp(BG[0], BG[0], snareImpact);
    const bgG = p.lerp(BG[1], BG[1], snareImpact);
    const bgB = p.lerp(BG[2], BG[2], snareImpact);
    p.background(bgR, bgG, bgB);

    const cellW  = p.width  / COLS;
    const cellH  = p.height / ROWS;
    const pad    = Math.min(cellW, cellH) * 0.18;
    const baseR  = Math.min(cellW, cellH) * 0.5 - pad;

    // Global modifiers
    const kickRBoost        = kickImpact  * baseR * 0.35;   // KICK  → expand all radii
    const bassABoost        = bassImpact  * 1.8;             // BASS  → distort 'a' frequencies
    const dubBBoost         = dubImpact   * 1.8;             // DUB   → distort 'b' frequencies
    const hihatPhaseOffset  = hihatImpact * p.TWO_PI * 0.5; // HIHAT → phase burst
    const clapWeightMult    = 1 + clapImpact * 4.5;         // CLAP  → strokeWeight explosion

    p.noFill();

    for (let col = 0; col < COLS; col++) {
      for (let row = 0; row < ROWS; row++) {
        const cx = cellW * col + cellW * 0.5;
        const cy = cellH * row + cellH * 0.5;

        // SMP per-column highlight (SMP_00-03 → columns 0-3)
        const colSmp = col < 4 ? smpImpact[col] : 0;

        const a     = 1 + col + bassABoost;
        const b     = 1 + row + dubBBoost;
        const phase = t * 0.4 + (col * 0.7 + row * 1.1) * 0.5 + hihatPhaseOffset;
        const r     = baseR + kickRBoost + colSmp * baseR * 0.28;

        const noise = p.noise(col * 0.4, row * 0.4, t * 0.1);
        const baseWeight = p.map(noise, 0, 1, 0.5, 1.5);
        const curveWeight = baseWeight * clapWeightMult * (1 + colSmp * 1.5);
        const steps = 120;

        // Glow/trail pass.
        p.stroke(ACC[0], ACC[1], ACC[2], 38);
        p.strokeWeight(curveWeight * 2.2);
        p.beginShape();
        for (let i = 0; i <= steps; i++) {
          const theta = (i / steps) * p.TWO_PI;
          const x = cx + r * p.sin(a * theta + phase);
          const y = cy + r * p.sin(b * theta);
          p.vertex(x, y);
        }
        p.endShape(p.CLOSE);

        // Main curve pass.
        p.stroke(ACC[0], ACC[1], ACC[2], 217);
        p.strokeWeight(curveWeight);
        p.beginShape();
        for (let i = 0; i <= steps; i++) {
          const theta = (i / steps) * p.TWO_PI;
          const x = cx + r * p.sin(a * theta + phase);
          const y = cy + r * p.sin(b * theta);
          p.vertex(x, y);
        }
        p.endShape(p.CLOSE);

        // Moving dot — HIHAT accelerates speed; KICK & SMP enlarge it
        const dotSpeed = 0.6 + hihatImpact * 3.0;
        const dotTheta = (t * dotSpeed + (col + row * COLS) * 0.3) % p.TWO_PI;
        const dotX = cx + r * p.sin(a * dotTheta + phase);
        const dotY = cy + r * p.sin(b * dotTheta);
        const dotSize = 3.5 + kickImpact * 4 + colSmp * 5;

        p.noStroke();
        if (snareImpact > 0.01 || colSmp > 0.01) {
          p.fill(TEXT[0], TEXT[1], TEXT[2], p.lerp(200, 255, p.max(snareImpact, colSmp)));
        } else {
          p.fill(TEXT[0], TEXT[1], TEXT[2], 200);
        }
        p.circle(dotX, dotY, dotSize);
        p.noFill();
      }
    }

    // Grid overlay / panel framing
    const gridWeight = p.lerp(0.5, 2.5, bassImpact);
    p.stroke(MUTED[0], MUTED[1], MUTED[2], 153);
    p.strokeWeight(gridWeight);
    for (let col = 1; col < COLS; col++) {
      p.line(col * cellW, 0, col * cellW, p.height);
    }
    for (let row = 1; row < ROWS; row++) {
      p.line(0, row * cellH, p.width, row * cellH);
    }

    p.stroke(MUTED[0], MUTED[1], MUTED[2], 204);
    p.strokeWeight(1.2);
    p.noFill();
    p.rect(0, 0, p.width, p.height);
  };
};
