import { getAudioTime, visualEvents } from '../lib/audio';

// OUROBOROS · CVM PATIENTIA
// Inspired by the alchemical engraving: thin serpent forming the
// outer ring, double-circle border, curved Latin inscription,
// handshake emerging from clouds with flames above, in the centre.

const PALETTE = {
  bg:        [15, 10, 5]     as const,
  text:      [232, 220, 196] as const,
  accent:    [200, 149, 72]  as const,
  highlight: [230, 190, 120] as const,
  shadow:    [61, 46, 30]    as const,
  flame:     [220, 130, 60]  as const,  // warm orange-amber for fire
};

const SERPENT_RINGS = 280;
const HEAD_GAP_RAD  = 0.13;

export const ouroborosPatientiaSketch = (p: any) => {

  // ── Camera state ──────────────────────────────────────────────────────
  let ambientRot       = 0;
  let mouseOffsetRot   = 0;
  let mouseOffsetTilt  = 0;

  // ── Audio envelopes ───────────────────────────────────────────────────
  let kickFlicker = 0;   // flames spike
  let bassBreath  = 0;
  let hihatShim   = 0;
  let dubGlow     = 0;
  let snareGrip   = 0;   // hands pull closer
  let flashAmount = 0;
  let flamePhase  = 0;

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
    p.textFont('Inter');
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

  // ── Helpers ───────────────────────────────────────────────────────────
  function drawCurvedText(text: string, radius: number, centerAngle: number, spread: number) {
    // centerAngle is in radians (canvas coords). spread is total arc spread for text.
    const n = text.length;
    if (n === 0) return;
    const step = spread / Math.max(1, n - 1);
    const startA = centerAngle - spread / 2;
    p.fill(PALETTE.accent[0], PALETTE.accent[1], PALETTE.accent[2], 220 + hihatShim * 35);
    p.noStroke();
    p.textAlign(p.CENTER, p.CENTER);
    p.textSize(Math.min(14, radius * 0.06));
    for (let i = 0; i < n; i++) {
      const a = startA + i * step;
      const x = Math.cos(a) * radius;
      const y = Math.sin(a) * radius;
      p.push();
      p.translate(x, y);
      // Rotate so each character sits tangent to circle, "above" the line
      p.rotate(a + Math.PI / 2);
      p.text(text[i], 0, 0);
      p.pop();
    }
  }

  function drawCloud(x: number, y: number, scale: number, alpha: number) {
    // A puff cloud made of overlapping translucent circles
    p.noStroke();
    p.fill(PALETTE.shadow[0], PALETTE.shadow[1], PALETTE.shadow[2], alpha);
    const lobes = [
      { ox: 0,        oy: 0,         r: 1.0 },
      { ox: -scale*0.45, oy: -scale*0.18, r: 0.7 },
      { ox: scale*0.45,  oy: -scale*0.18, r: 0.7 },
      { ox: -scale*0.7,  oy: scale*0.12,  r: 0.55 },
      { ox: scale*0.7,   oy: scale*0.12,  r: 0.55 },
      { ox: 0,           oy: scale*0.35,  r: 0.9 },
    ];
    for (const lobe of lobes) {
      p.circle(x + lobe.ox, y + lobe.oy, scale * lobe.r);
    }
    // Highlight (lighter top)
    p.fill(PALETTE.shadow[0] + 30, PALETTE.shadow[1] + 25, PALETTE.shadow[2] + 18, alpha * 0.7);
    p.circle(x - scale * 0.18, y - scale * 0.20, scale * 0.5);
    p.circle(x + scale * 0.18, y - scale * 0.10, scale * 0.4);
  }

  function drawForearm(side: -1 | 1, baseR: number, grip: number) {
    // Forearm runs from cloud (at edge) horizontally toward center
    // side: -1 = left arm, +1 = right arm
    const cloudX = side * baseR * 0.78;
    const cloudY = 0;
    const handX  = side * baseR * (0.13 - grip * 0.05);  // grip pulls hands closer
    const handY  = 0;

    // Draw forearm sleeve as a tapered shape
    p.noFill();
    p.stroke(PALETTE.shadow[0], PALETTE.shadow[1], PALETTE.shadow[2], 240);
    p.strokeWeight(1.4);

    const sleeveH = baseR * 0.22;
    // Top and bottom edges of the sleeve (tapered toward hand)
    const cuffH = baseR * 0.06;
    p.beginShape();
    p.vertex(cloudX, cloudY - sleeveH * 0.5);
    p.vertex(handX + side * cuffH * 0.6, handY - cuffH * 0.55);
    p.vertex(handX,                       handY - cuffH * 0.5);
    p.vertex(handX,                       handY + cuffH * 0.5);
    p.vertex(handX + side * cuffH * 0.6, handY + cuffH * 0.55);
    p.vertex(cloudX, cloudY + sleeveH * 0.5);
    p.endShape();

    // Fill sleeve
    p.noStroke();
    p.fill(PALETTE.shadow[0] + 20, PALETTE.shadow[1] + 15, PALETTE.shadow[2] + 10, 200);
    p.beginShape();
    p.vertex(cloudX, cloudY - sleeveH * 0.5);
    p.vertex(handX + side * cuffH * 0.6, handY - cuffH * 0.55);
    p.vertex(handX,                       handY - cuffH * 0.5);
    p.vertex(handX,                       handY + cuffH * 0.5);
    p.vertex(handX + side * cuffH * 0.6, handY + cuffH * 0.55);
    p.vertex(cloudX, cloudY + sleeveH * 0.5);
    p.endShape(p.CLOSE);

    // Sleeve folds (hatch lines)
    p.stroke(PALETTE.shadow[0], PALETTE.shadow[1], PALETTE.shadow[2], 180);
    p.strokeWeight(0.7);
    for (let i = 1; i < 4; i++) {
      const t = i / 4;
      const tx = cloudX + (handX - cloudX) * t;
      const th = sleeveH * 0.5 * (1 - t * 0.5);
      p.line(tx, -th * 0.9, tx, th * 0.9);
    }

    // Hand: small palm shape with fingers
    p.noStroke();
    p.fill(PALETTE.shadow[0] + 30, PALETTE.shadow[1] + 22, PALETTE.shadow[2] + 14, 230);
    const palmSize = baseR * 0.08;
    p.ellipse(handX, handY, palmSize * 1.2, palmSize);
  }

  function drawHandshake(baseR: number, grip: number) {
    // Two clasped hands at center — overlap palm shapes + finger lines
    const overlap = baseR * (0.04 + grip * 0.02);
    p.noStroke();
    p.fill(PALETTE.shadow[0] + 40, PALETTE.shadow[1] + 28, PALETTE.shadow[2] + 16, 240);

    // Knot/clasp at center (overlapping ellipses)
    p.ellipse(-overlap * 0.4, 0, baseR * 0.12, baseR * 0.10);
    p.ellipse( overlap * 0.4, 0, baseR * 0.12, baseR * 0.10);
    p.ellipse(0, 0, baseR * 0.16, baseR * 0.09);

    // Finger separations (thin dark lines)
    p.stroke(PALETTE.bg[0], PALETTE.bg[1], PALETTE.bg[2], 240);
    p.strokeWeight(0.8);
    for (let i = 0; i < 3; i++) {
      const y = (i - 1) * baseR * 0.020;
      p.line(-baseR * 0.07, y, baseR * 0.07, y);
    }

    // Thumb of left + right (small curves)
    p.noStroke();
    p.fill(PALETTE.shadow[0] + 45, PALETTE.shadow[1] + 30, PALETTE.shadow[2] + 18, 230);
    p.ellipse(-baseR * 0.04, -baseR * 0.04, baseR * 0.045, baseR * 0.03);
    p.ellipse( baseR * 0.04, -baseR * 0.04, baseR * 0.045, baseR * 0.03);
  }

  function drawFlames(baseR: number, intensity: number) {
    // Flame shapes above the handshake
    const flameBaseY = -baseR * 0.10;
    const flameTopY  = -baseR * (0.42 + intensity * 0.18 + kickFlicker * 0.12);
    const flameWidth = baseR * (0.30 + intensity * 0.10);

    // 5 flame tongues with wavy edges
    const tongues = 5;
    for (let i = 0; i < tongues; i++) {
      const t = (i + 0.5) / tongues;
      const cx = (t - 0.5) * flameWidth;
      const heightVar = 0.8 + Math.sin(flamePhase * 2 + i * 1.3) * 0.15
                            + (Math.random() - 0.5) * 0.08 * intensity;
      const top = flameTopY * heightVar;
      const w = baseR * 0.08;

      // Outer flame (orange-amber)
      p.noStroke();
      p.fill(PALETTE.flame[0], PALETTE.flame[1], PALETTE.flame[2], 180 + kickFlicker * 60);
      p.beginShape();
      p.vertex(cx, top);
      p.bezierVertex(
        cx + w * 0.7, flameBaseY + (top - flameBaseY) * 0.35,
        cx + w * 0.5, flameBaseY,
        cx,           flameBaseY + w * 0.1,
      );
      p.bezierVertex(
        cx - w * 0.5, flameBaseY,
        cx - w * 0.7, flameBaseY + (top - flameBaseY) * 0.35,
        cx,           top,
      );
      p.endShape(p.CLOSE);

      // Inner flame (lighter highlight)
      p.fill(PALETTE.highlight[0], PALETTE.highlight[1], PALETTE.highlight[2], 130 + flashAmount * 60);
      const innerW = w * 0.5;
      const innerTop = flameBaseY + (top - flameBaseY) * 0.75;
      p.beginShape();
      p.vertex(cx, innerTop);
      p.bezierVertex(
        cx + innerW * 0.6, flameBaseY + (innerTop - flameBaseY) * 0.4,
        cx + innerW * 0.4, flameBaseY,
        cx,                flameBaseY + innerW * 0.1,
      );
      p.bezierVertex(
        cx - innerW * 0.4, flameBaseY,
        cx - innerW * 0.6, flameBaseY + (innerTop - flameBaseY) * 0.4,
        cx,                innerTop,
      );
      p.endShape(p.CLOSE);
    }

    // Sparks above flames on KICK
    if (kickFlicker > 0.1) {
      p.noStroke();
      p.fill(PALETTE.flame[0], PALETTE.flame[1], PALETTE.flame[2], kickFlicker * 200);
      for (let s = 0; s < 5; s++) {
        const sx = (Math.random() - 0.5) * flameWidth * 0.8;
        const sy = flameTopY - Math.random() * baseR * 0.15;
        p.circle(sx, sy, 1.5 + Math.random() * 1.5);
      }
    }
  }

  function drawSerpentRing(radius: number, breath: number, kickWaveT: number) {
    // Thin serpent body forming the ring
    const totalSweep = Math.PI * 2 - HEAD_GAP_RAD;
    const startAngle = -Math.PI / 2 + HEAD_GAP_RAD / 2 + ambientRot + mouseOffsetRot;

    // Body fill — thin band
    p.noStroke();
    p.fill(PALETTE.shadow[0], PALETTE.shadow[1], PALETTE.shadow[2], 235);
    const baseThickness = radius * 0.045;

    p.beginShape();
    for (let i = 0; i <= SERPENT_RINGS; i++) {
      const t = i / SERPENT_RINGS;
      const angle = startAngle + t * totalSweep;
      const headTaper = Math.min(1, t / 0.04);
      const tailTaper = Math.min(1, (1 - t) / 0.08);
      const taper = Math.min(headTaper, tailTaper);
      const thick = baseThickness * Math.pow(taper, 0.5);
      const r = radius + thick * 0.5;
      p.vertex(Math.cos(angle) * r, Math.sin(angle) * r);
    }
    for (let i = SERPENT_RINGS; i >= 0; i--) {
      const t = i / SERPENT_RINGS;
      const angle = startAngle + t * totalSweep;
      const headTaper = Math.min(1, t / 0.04);
      const tailTaper = Math.min(1, (1 - t) / 0.08);
      const taper = Math.min(headTaper, tailTaper);
      const thick = baseThickness * Math.pow(taper, 0.5);
      const r = radius - thick * 0.5;
      p.vertex(Math.cos(angle) * r, Math.sin(angle) * r);
    }
    p.endShape(p.CLOSE);

    // Diamond/X crosshatch scale pattern along the body (every Nth ring)
    for (let i = 0; i < SERPENT_RINGS; i += 4) {
      const t = i / SERPENT_RINGS;
      const angle = startAngle + t * totalSweep;
      const headTaper = Math.min(1, t / 0.04);
      const tailTaper = Math.min(1, (1 - t) / 0.08);
      const taper = Math.min(headTaper, tailTaper);
      const thick = baseThickness * Math.pow(taper, 0.5);

      // Kick wave brightens passing area
      let waveHit = 0;
      if (kickWaveT >= 0) {
        const dist = Math.abs(t - kickWaveT);
        if (dist < 0.05) waveHit = (1 - dist / 0.05);
      }

      const r = radius;
      const cx2 = Math.cos(angle) * r;
      const cy2 = Math.sin(angle) * r;

      // Small "x" mark (two crossing lines)
      const xs = thick * 0.6;
      p.stroke(PALETTE.accent[0], PALETTE.accent[1], PALETTE.accent[2], 180 + waveHit * 75 + hihatShim * 40 * (Math.random() < 0.3 ? 1 : 0));
      p.strokeWeight(0.6);
      p.push();
      p.translate(cx2, cy2);
      p.rotate(angle + Math.PI / 2);
      p.line(-xs, -xs * 0.5, xs, xs * 0.5);
      p.line(-xs, xs * 0.5, xs, -xs * 0.5);
      p.pop();
    }
    p.noStroke();

    // Head — small triangular shape biting the tail
    {
      const tailAngle = startAngle + totalSweep;
      const headAngle = startAngle;
      const headPos = { x: Math.cos(headAngle) * radius, y: Math.sin(headAngle) * radius };
      const tailPos = { x: Math.cos(tailAngle) * radius, y: Math.sin(tailAngle) * radius };
      const biteAngle = Math.atan2(tailPos.y - headPos.y, tailPos.x - headPos.x);
      const biteDist  = Math.sqrt((tailPos.x - headPos.x) ** 2 + (tailPos.y - headPos.y) ** 2);
      const snoutLen  = biteDist * 1.05;

      p.push();
      p.translate(headPos.x, headPos.y);
      p.rotate(biteAngle);

      // Tiny head shape
      p.fill(PALETTE.shadow[0], PALETTE.shadow[1], PALETTE.shadow[2], 250);
      p.beginShape();
      p.vertex(0, -baseThickness * 1.2);
      p.vertex(snoutLen * 0.85, -baseThickness * 0.7);
      p.vertex(snoutLen, 0);
      p.vertex(snoutLen * 0.85, baseThickness * 0.7);
      p.vertex(0, baseThickness * 1.2);
      p.endShape(p.CLOSE);

      // Eye (tiny dark dot with red glint)
      p.fill(PALETTE.bg[0], PALETTE.bg[1], PALETTE.bg[2], 255);
      p.circle(snoutLen * 0.45, -baseThickness * 0.4, baseThickness * 0.55);
      p.fill(PALETTE.flame[0], PALETTE.flame[1], PALETTE.flame[2], 240);
      p.circle(snoutLen * 0.45, -baseThickness * 0.4, baseThickness * 0.25);

      p.pop();
    }
  }

  // ── Draw ──────────────────────────────────────────────────────────────
  p.draw = () => {
    const cx = p.width / 2;
    const cy = p.height / 2;
    const baseR = Math.min(p.width, p.height) * 0.38;

    // ── Audio events ────────────────────────────────────────────────────
    const now = getAudioTime();
    for (let i = visualEvents.length - 1; i >= 0; i--) {
      const ev = visualEvents[i];
      if (now >= ev.time) {
        switch (ev.type) {
          case 'KICK':  kickFlicker = 1; break;
          case 'BASS':  bassBreath = 1; break;
          case 'HIHAT': hihatShim = 1; break;
          case 'DUB':   dubGlow = 1; break;
          case 'SNARE': snareGrip = 1; break;
          case 'CLAP':  flashAmount = 1; kickFlicker = 1; break;
        }
        visualEvents.splice(i, 1);
      }
    }

    // ── Decay envelopes ─────────────────────────────────────────────────
    kickFlicker *= 0.85;
    bassBreath  *= 0.93;
    hihatShim   *= 0.86;
    dubGlow     *= 0.94;
    snareGrip   *= 0.88;
    flashAmount *= 0.88;
    flamePhase  += 0.06;
    ambientRot  += 0.0008;

    // KICK wave for serpent
    // (track its own 0..1 progression independent of the kick brightness flicker)

    // ── Cursor-driven rotation/tilt ─────────────────────────────────────
    const inBounds = p.mouseX >= 0 && p.mouseX <= p.width && p.mouseY >= 0 && p.mouseY <= p.height;
    if (inBounds) {
      const mxNorm = (p.mouseX - p.width / 2) / (p.width / 2);
      const myNorm = (p.mouseY - p.height / 2) / (p.height / 2);
      mouseOffsetRot  = p.lerp(mouseOffsetRot,  mxNorm * 0.35, 0.05);
      mouseOffsetTilt = p.lerp(mouseOffsetTilt, myNorm * 0.10, 0.05);
    } else {
      mouseOffsetRot  = p.lerp(mouseOffsetRot,  0, 0.05);
      mouseOffsetTilt = p.lerp(mouseOffsetTilt, 0, 0.05);
    }

    if (dragging && p.mouseIsPressed) {
      const dx = p.mouseX - dragLastX;
      ambientRot += dx * 0.005;
      dragLastX = p.mouseX;
    } else if (!p.mouseIsPressed) dragging = false;

    // ── BG ──────────────────────────────────────────────────────────────
    if (firstFrame) {
      p.background(PALETTE.bg[0], PALETTE.bg[1], PALETTE.bg[2]);
      firstFrame = false;
    }
    p.noStroke();
    p.fill(PALETTE.bg[0], PALETTE.bg[1], PALETTE.bg[2], 60);
    p.rect(0, 0, p.width, p.height);

    // Parchment grain
    if (p.frameCount % 3 === 0) {
      for (let g = 0; g < 5; g++) {
        p.fill(PALETTE.shadow[0], PALETTE.shadow[1], PALETTE.shadow[2], 12);
        p.circle(p.random(p.width), p.random(p.height), 1);
      }
    }

    p.push();
    p.translate(cx, cy + mouseOffsetTilt * baseR * 0.3);

    // ── DUB glow halo around the seal ───────────────────────────────────
    if (dubGlow > 0.05) {
      p.noFill();
      p.stroke(PALETTE.accent[0], PALETTE.accent[1], PALETTE.accent[2], dubGlow * 100);
      p.strokeWeight(2 * dubGlow);
      p.circle(0, 0, baseR * 2.2);
    }

    // ── Outer thin border ring ──────────────────────────────────────────
    const breathR = baseR * (1 + bassBreath * 0.018);
    p.noFill();
    p.stroke(PALETTE.accent[0], PALETTE.accent[1], PALETTE.accent[2], 220);
    p.strokeWeight(1.2);
    p.circle(0, 0, breathR * 2);

    // ── Curved CVM·PATIENTIA inscription along upper inner edge ─────────
    {
      p.push();
      const r = breathR * 0.91;
      drawCurvedText('CVM·PATIENTIA', r, -Math.PI / 2, 1.0);
      p.pop();
    }

    // ── Serpent ring ────────────────────────────────────────────────────
    const serpentR = breathR * 0.82;
    drawSerpentRing(serpentR, bassBreath, -1);

    // ── Inner thin border ring ──────────────────────────────────────────
    p.noFill();
    p.stroke(PALETTE.accent[0], PALETTE.accent[1], PALETTE.accent[2], 180);
    p.strokeWeight(1.0);
    p.circle(0, 0, serpentR * 1.55);

    // ── Center scene: clouds + arms + handshake + flames ────────────────
    p.push();
    // Center scene stays upright (no rotation)
    p.rotate(-(ambientRot + mouseOffsetRot));
    const innerR = serpentR * 0.78;

    // Clouds on each side (where arms emerge)
    drawCloud(-innerR * 0.78, 0,  innerR * 0.55, 230);
    drawCloud( innerR * 0.78, 0,  innerR * 0.55, 230);

    // Forearms
    drawForearm(-1, innerR, snareGrip);
    drawForearm( 1, innerR, snareGrip);

    // Handshake at center
    drawHandshake(innerR, snareGrip);

    // Flames rising above
    drawFlames(innerR, bassBreath);

    p.pop();

    p.pop();

    // ── Flash overlay ───────────────────────────────────────────────────
    if (flashAmount > 0.1) {
      p.noStroke();
      p.fill(PALETTE.flame[0], PALETTE.flame[1], PALETTE.flame[2], flashAmount * 28);
      p.rect(0, 0, p.width, p.height);
    }
  };
};
