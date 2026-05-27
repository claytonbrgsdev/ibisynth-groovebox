import { getAudioTime, visualEvents } from '../lib/audio';

// OUROBOROS
// Hand-drawn alchemical serpent biting its own tail.
// Audio-reactive: KICK wave, BASS breath, HIHAT scale shimmer,
// DUB aura ring, SNARE snap, CLAP flash + eye flare.

const PALETTE = {
  bg:       [15, 10, 5]     as const,
  text:     [232, 220, 196] as const,
  accent:   [200, 149, 72]  as const,  // burnished gold
  highlight:[230, 190, 120] as const,  // lighter gold for highlights
  shadow:   [61, 46, 30]    as const,  // dark sepia
  red:      [139, 58, 47]   as const,  // oxidized red (eye)
};

const N_RINGS  = 220;   // ring count along the body
const HEAD_GAP_RAD = 0.18;  // gap at the bite point

export const ouroborosSketch = (p: any) => {

  // ── Rotation state (always slow drift + cursor offset) ────────────────
  let ambientRot       = 0;
  let mouseOffsetRot   = 0;
  let mouseOffsetTilt  = 0;

  // ── Audio envelopes ───────────────────────────────────────────────────
  let kickWave    = -1;  // 0..1 = position along body; -1 = inactive
  let bassBreath  = 0;
  let hihatShim   = 0;
  let dubAura     = 0;
  let snareSnap   = 0;
  let flashAmount = 0;
  let eyeFlare    = 0;

  let firstFrame = true;
  let dragging   = false;
  let dragLastX  = 0;

  p.setup = () => {
    const parent = p.canvas?.parentElement;
    const w = parent ? parent.clientWidth : 800;
    const h = parent ? parent.clientHeight : 600;
    p.createCanvas(w, h);
    p.pixelDensity(1);
    p.smooth();
    visualEvents.length = 0;
    firstFrame = true;
  };

  p.windowResized = () => {
    const parent = p.canvas?.parentElement;
    if (parent) { p.resizeCanvas(parent.clientWidth, parent.clientHeight); firstFrame = true; }
  };

  p.mousePressed = () => {
    if (p.mouseX > 0 && p.mouseX < p.width && p.mouseY > 0 && p.mouseY < p.height) {
      dragging = true; dragLastX = p.mouseX;
    }
  };
  p.mouseReleased = () => { dragging = false; };

  // ── Draw ──────────────────────────────────────────────────────────────
  p.draw = () => {
    const cx = p.width / 2;
    const cy = p.height / 2;
    const baseR = Math.min(p.width, p.height) * 0.32;

    // ── Audio events ────────────────────────────────────────────────────
    const now = getAudioTime();
    for (let i = visualEvents.length - 1; i >= 0; i--) {
      const ev = visualEvents[i];
      if (now >= ev.time) {
        switch (ev.type) {
          case 'KICK':  kickWave = 0; break;           // launch wave from head
          case 'BASS':  bassBreath = 1; break;
          case 'HIHAT': hihatShim = 1; break;
          case 'DUB':   dubAura = 1; break;
          case 'SNARE': snareSnap = 1; break;
          case 'CLAP':  flashAmount = 1; eyeFlare = 1; break;
        }
        visualEvents.splice(i, 1);
      }
    }

    // ── Decay envelopes ─────────────────────────────────────────────────
    if (kickWave >= 0) {
      kickWave += 0.025;     // wave travels from head (0) toward tail (1)
      if (kickWave > 1.1) kickWave = -1;
    }
    bassBreath  *= 0.93;
    hihatShim   *= 0.86;
    dubAura     *= 0.95;
    snareSnap   *= 0.86;
    flashAmount *= 0.88;
    eyeFlare    *= 0.92;

    ambientRot += 0.0010;

    // ── Cursor-driven rotation/tilt ─────────────────────────────────────
    const inBounds = p.mouseX >= 0 && p.mouseX <= p.width && p.mouseY >= 0 && p.mouseY <= p.height;
    if (inBounds) {
      const mxNorm = (p.mouseX - p.width / 2) / (p.width / 2);
      const myNorm = (p.mouseY - p.height / 2) / (p.height / 2);
      mouseOffsetRot  = p.lerp(mouseOffsetRot,  mxNorm * 0.5, 0.06);
      mouseOffsetTilt = p.lerp(mouseOffsetTilt, myNorm * 0.12, 0.06);
    } else {
      mouseOffsetRot  = p.lerp(mouseOffsetRot,  0, 0.05);
      mouseOffsetTilt = p.lerp(mouseOffsetTilt, 0, 0.05);
    }

    // Manual drag adds direct rotation
    if (dragging && p.mouseIsPressed) {
      const dx = p.mouseX - dragLastX;
      ambientRot += dx * 0.005;
      dragLastX = p.mouseX;
    } else if (!p.mouseIsPressed) dragging = false;

    const totalRot = ambientRot + mouseOffsetRot;

    // ── BG fade ─────────────────────────────────────────────────────────
    if (firstFrame) {
      p.background(PALETTE.bg[0], PALETTE.bg[1], PALETTE.bg[2]);
      firstFrame = false;
    }
    p.noStroke();
    p.fill(PALETTE.bg[0], PALETTE.bg[1], PALETTE.bg[2], 50);
    p.rect(0, 0, p.width, p.height);

    // Subtle parchment grain (very faint warm tint)
    if (p.frameCount % 3 === 0) {
      for (let g = 0; g < 6; g++) {
        const gx = p.random(p.width);
        const gy = p.random(p.height);
        p.fill(PALETTE.shadow[0], PALETTE.shadow[1], PALETTE.shadow[2], 10);
        p.circle(gx, gy, 1);
      }
    }

    // ── Compute body geometry ───────────────────────────────────────────
    // The body sweeps clockwise from headAngle + gap/2 around to headAngle - gap/2
    // (a full loop minus the gap). Head sits at the gap.
    const breathMod = 1 + bassBreath * 0.04 + Math.sin(p.frameCount * 0.013) * 0.008 - snareSnap * 0.06;
    const effR = baseR * breathMod;

    const baseThickness = baseR * 0.16;
    const headAngle = -Math.PI / 2 + totalRot;
    const startAngle = headAngle + HEAD_GAP_RAD / 2;
    const totalSweep = Math.PI * 2 - HEAD_GAP_RAD;

    p.push();
    p.translate(cx, cy + mouseOffsetTilt * baseR * 0.4);

    // ── DUB aura: expanding ring around the ouroboros ───────────────────
    if (dubAura > 0.05) {
      p.noFill();
      const ringR = effR * (1.15 + (1 - dubAura) * 0.5);
      p.stroke(PALETTE.accent[0], PALETTE.accent[1], PALETTE.accent[2], dubAura * 120);
      p.strokeWeight(1.8 * dubAura);
      p.circle(0, 0, ringR * 2);

      // inner ring too
      const innerRingR = effR * (0.78 - (1 - dubAura) * 0.2);
      p.stroke(PALETTE.accent[0], PALETTE.accent[1], PALETTE.accent[2], dubAura * 70);
      p.strokeWeight(1.0 * dubAura);
      p.circle(0, 0, innerRingR * 2);
    }

    // ── Body shadow layer (dark sepia underbelly) ───────────────────────
    p.noStroke();
    p.fill(PALETTE.shadow[0], PALETTE.shadow[1], PALETTE.shadow[2], 230);
    p.beginShape();
    for (let i = 0; i <= N_RINGS; i++) {
      const t = i / N_RINGS;
      const angle = startAngle + t * totalSweep;
      const tailTaper = Math.min(1, (1 - t) / 0.10);
      const headTaper = Math.min(1, t / 0.06);
      const taper = Math.min(tailTaper, headTaper);

      // Subtle organic noise on outer radius
      const wobble = (p.noise(t * 3 + ambientRot * 2, p.frameCount * 0.004) - 0.5) * 0.015 * baseR;

      const thick = baseThickness * Math.pow(taper, 0.6);
      const outerR = effR + thick * 0.5 + wobble;
      p.vertex(Math.cos(angle) * outerR, Math.sin(angle) * outerR);
    }
    for (let i = N_RINGS; i >= 0; i--) {
      const t = i / N_RINGS;
      const angle = startAngle + t * totalSweep;
      const tailTaper = Math.min(1, (1 - t) / 0.10);
      const headTaper = Math.min(1, t / 0.06);
      const taper = Math.min(tailTaper, headTaper);
      const wobble = (p.noise(t * 3 + ambientRot * 2, p.frameCount * 0.004) - 0.5) * 0.015 * baseR;
      const thick = baseThickness * Math.pow(taper, 0.6);
      const innerR = effR - thick * 0.5 - wobble;
      p.vertex(Math.cos(angle) * innerR, Math.sin(angle) * innerR);
    }
    p.endShape(p.CLOSE);

    // ── Scales (overlapping crescents along the body) ───────────────────
    for (let i = 0; i < N_RINGS; i++) {
      const t = i / N_RINGS;
      const angle = startAngle + t * totalSweep;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      const tailTaper = Math.min(1, (1 - t) / 0.10);
      const headTaper = Math.min(1, t / 0.06);
      const taper = Math.min(tailTaper, headTaper);
      let thick = baseThickness * Math.pow(taper, 0.6);

      // KICK wave: compress thickness as it passes
      if (kickWave >= 0) {
        const distToWave = Math.abs(t - kickWave);
        if (distToWave < 0.07) {
          const k = 1 - distToWave / 0.07;
          thick *= 1 - k * 0.5;
        }
      }

      // Number of scales per ring scales with thickness
      const scalesAcross = 5;
      const rowOffset = (i % 6 < 3) ? 0 : 0.5;  // alternating offset like fish scales

      for (let s = 0; s < scalesAcross; s++) {
        const sNorm = (s + 0.5 + rowOffset * 0.6) / scalesAcross;
        const offset = (sNorm - 0.5) * thick;
        const sr = effR + offset;
        const sx = cosA * sr;
        const sy = sinA * sr;

        // Color: amber, lighter on outer edge, darker on inner (3D shading)
        const edgeFactor = 1 - Math.abs(sNorm - 0.5) * 1.4;
        const lightFactor = sNorm > 0.5 ? edgeFactor : edgeFactor * 0.55;
        const r = PALETTE.shadow[0] + (PALETTE.accent[0] - PALETTE.shadow[0]) * lightFactor;
        const g = PALETTE.shadow[1] + (PALETTE.accent[1] - PALETTE.shadow[1]) * lightFactor;
        const b = PALETTE.shadow[2] + (PALETTE.accent[2] - PALETTE.shadow[2]) * lightFactor;

        // Shimmer on HIHAT — only a fraction flicker
        const shimmerHit = (hihatShim > 0.05 && Math.random() < 0.18) ? hihatShim * 90 : 0;

        // KICK wave hit: brighten scales near the wave
        let waveHit = 0;
        if (kickWave >= 0) {
          const distToWave = Math.abs(t - kickWave);
          if (distToWave < 0.05) waveHit = (1 - distToWave / 0.05) * 120;
        }

        const alpha = 200 + flashAmount * 50 + shimmerHit + waveHit;

        p.fill(r, g, b, alpha);
        const scaleW = 5.2 + Math.random() * 1.8;
        const scaleH = 3.2 + Math.random() * 0.8;
        const jx = (Math.random() - 0.5) * 0.8;
        const jy = (Math.random() - 0.5) * 0.8;

        p.push();
        p.translate(sx + jx, sy + jy);
        p.rotate(angle + Math.PI / 2);
        p.ellipse(0, 0, scaleW, scaleH);
        p.pop();
      }
    }

    // ── Highlights along the outer crest ────────────────────────────────
    p.noStroke();
    for (let i = 0; i < N_RINGS; i += 2) {
      const t = i / N_RINGS;
      const angle = startAngle + t * totalSweep;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const tailTaper = Math.min(1, (1 - t) / 0.10);
      const headTaper = Math.min(1, t / 0.06);
      const taper = Math.min(tailTaper, headTaper);
      const thick = baseThickness * Math.pow(taper, 0.6);

      const outerR = effR + thick * 0.45;
      const sx = cosA * outerR;
      const sy = sinA * outerR;
      p.fill(PALETTE.highlight[0], PALETTE.highlight[1], PALETTE.highlight[2], 70 + flashAmount * 40);
      p.circle(sx + (Math.random() - 0.5) * 0.5, sy + (Math.random() - 0.5) * 0.5, 1.6);
    }

    // ── HEAD ────────────────────────────────────────────────────────────
    // Head sits at startAngle (body emergence point — back of head/neck).
    // Snout points across the gap toward endAngle (tail tip) and bites it.
    {
      const endAngle = startAngle + totalSweep;        // tail tip position
      const headPos = { x: Math.cos(startAngle) * effR, y: Math.sin(startAngle) * effR };
      const tailPos = { x: Math.cos(endAngle) * effR, y: Math.sin(endAngle) * effR };

      // Direction from head base toward tail (the bite direction)
      const biteDx = tailPos.x - headPos.x;
      const biteDy = tailPos.y - headPos.y;
      const biteAngle = Math.atan2(biteDy, biteDx);
      const biteDistance = Math.sqrt(biteDx * biteDx + biteDy * biteDy);

      // Snout length extends slightly past tail tip so head visually bites
      const snoutLen = biteDistance * 1.05;

      p.push();
      p.translate(headPos.x, headPos.y);
      p.rotate(biteAngle);

      // Shadow base of head — X scales with snoutLen, Y stays at base thickness
      p.noStroke();
      p.fill(PALETTE.shadow[0], PALETTE.shadow[1], PALETTE.shadow[2], 240);
      p.beginShape();
      p.vertex(0, -baseThickness * 0.65);
      p.vertex(snoutLen * 0.84, -baseThickness * 0.35);
      p.vertex(snoutLen, 0);                       // snout tip
      p.vertex(snoutLen * 0.84, baseThickness * 0.35);
      p.vertex(0, baseThickness * 0.65);
      p.endShape(p.CLOSE);

      // Top layer of head (lit side)
      p.fill(PALETTE.accent[0], PALETTE.accent[1], PALETTE.accent[2], 235 + flashAmount * 20);
      p.beginShape();
      p.vertex(0, -baseThickness * 0.55);
      p.vertex(snoutLen * 0.76, -baseThickness * 0.30);
      p.vertex(snoutLen * 0.92, -0.08 * baseThickness);
      p.vertex(snoutLen * 0.76, baseThickness * 0.18);
      p.vertex(0, baseThickness * 0.45);
      p.endShape(p.CLOSE);

      // Scale rows on head
      for (let row = 0; row < 4; row++) {
        const rt = row / 4;
        const rx = snoutLen * (0.1 + rt * 0.65);
        const ry = -baseThickness * (0.5 - rt * 0.3);
        p.fill(PALETTE.highlight[0], PALETTE.highlight[1], PALETTE.highlight[2], 100);
        p.ellipse(rx, ry, 4, 2.5);
      }

      // Eye socket shadow — eye sits ~55% along head length
      const eyeX = snoutLen * 0.55;
      const eyeY = -baseThickness * 0.15;
      p.fill(PALETTE.shadow[0], PALETTE.shadow[1], PALETTE.shadow[2], 220);
      p.circle(eyeX, eyeY, baseThickness * 0.42);

      // Eye iris (oxidized red)
      const eyeBrightness = 1 + eyeFlare * 0.6 + flashAmount * 0.3;
      p.fill(
        Math.min(255, PALETTE.red[0] * eyeBrightness),
        Math.min(255, PALETTE.red[1] * eyeBrightness),
        Math.min(255, PALETTE.red[2] * eyeBrightness),
        255,
      );
      p.circle(eyeX, eyeY, baseThickness * 0.30);

      // Eye pupil
      p.fill(8, 5, 3, 255);
      p.circle(eyeX, eyeY, baseThickness * 0.13);

      // Eye glint
      p.fill(PALETTE.text[0], PALETTE.text[1], PALETTE.text[2], 200);
      p.circle(eyeX - baseThickness * 0.03, eyeY - baseThickness * 0.04, baseThickness * 0.05);

      // Eye flare halo on CLAP
      if (eyeFlare > 0.1) {
        p.noFill();
        p.stroke(PALETTE.red[0], PALETTE.red[1], PALETTE.red[2], eyeFlare * 160);
        p.strokeWeight(1.5 * eyeFlare);
        p.circle(eyeX, eyeY, baseThickness * (0.6 + (1 - eyeFlare) * 0.8));
        p.noStroke();
      }

      // Mouth (thin dark line from snout going slightly upward)
      p.stroke(8, 5, 3, 220);
      p.strokeWeight(1.4);
      p.noFill();
      p.line(snoutLen * 0.5, baseThickness * 0.08, snoutLen * 0.9, -0.02 * baseThickness);
      p.noStroke();

      p.pop();
    }

    // ── CLAP flash overlay ──────────────────────────────────────────────
    if (flashAmount > 0.1) {
      p.noStroke();
      p.fill(PALETTE.accent[0], PALETTE.accent[1], PALETTE.accent[2], flashAmount * 25);
      p.rect(-p.width, -p.height, p.width * 2, p.height * 2);
    }

    p.pop();
  };
};
