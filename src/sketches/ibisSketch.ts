import p5 from "p5";
import { getAudioTime, visualEvents } from "../lib/audio";

export const ibisSketch = (p: any) => {
  let kickImpact = 0;
  let hihatImpact = 0;
  let dubImpact = 0;
  let bassImpact = 0;
  let clapImpact = 0;
  let currentBpm = 120;
  let dubDecayCurrent = 0.5; // Represents Dry/Wet
  let currentFilterFreq = 800;

  let tailLagY = 0;
  let prevBodyY = 0;

  let particles: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    type: "sand" | "water" | "rain";
  }[] = [];

  // Clean up events so they don't trigger infinitely when reloading
  visualEvents.length = 0;

  p.setup = () => {
    let parent = p.canvas.parentElement;
    let w = parent ? parent.clientWidth : 600;
    let h = parent ? parent.clientHeight : 300;
    p.createCanvas(w, h);
    p.rectMode(p.CENTER);
  };

  p.windowResized = () => {
    let parent = p.canvas.parentElement;
    if (parent) {
      p.resizeCanvas(parent.clientWidth, parent.clientHeight);
    }
  };

  p.draw = () => {
    let now = getAudioTime();

    // Process visual events
    let vpX = p.width * 0.65;
    let vpY = p.height * 0.45;

    for (let i = visualEvents.length - 1; i >= 0; i--) {
      let ev = visualEvents[i];
      if (now >= ev.time) {
        if (ev.type === "KICK") {
          kickImpact = 1.0;
          for (let j = 0; j < 30; j++) {
            let py = p.random(vpY, p.height);
            let maxX = p.map(py, vpY, p.height, vpX, p.width * 0.35);
            particles.push({
              x: p.random(0, maxX),
              y: py,
              vx: p.random(-2, 2),
              vy: p.random(-6, -2),
              life: 1.0,
              type: "sand",
            });
          }
        }
        if (ev.type === "HIHAT") {
          hihatImpact = 1.0;
        }
        if (ev.type === "PARAM_UPDATE") {
          if (ev.param !== undefined) {
            if (ev.param.delayAmt !== undefined)
              dubDecayCurrent = ev.param.delayAmt;
            if (ev.param.filterFreq !== undefined)
              currentFilterFreq = ev.param.filterFreq;
            if (ev.param.bpm !== undefined)
              currentBpm = ev.param.bpm;
          }
        }
        if (ev.type === "CLAP") {
          clapImpact = 1.0;
        }
        if (ev.type === "DUB") {
          dubImpact = 1.0;
          if (ev.param !== undefined && ev.param.delayAmt !== undefined) {
            dubDecayCurrent = ev.param.delayAmt;
            currentFilterFreq = ev.param.filterFreq;
          }
        }
        if (ev.type === "BASS") {
          bassImpact = 1.0;
          for (let j = 0; j < 40; j++) {
            let py = p.random(vpY, p.height);
            let minX = p.map(py, vpY, p.height, vpX, p.width * 0.35);
            particles.push({
              x: p.random(minX, p.width),
              y: py,
              vx: p.random(-2, 4),
              vy: p.random(-8, -3),
              life: 1.0,
              type: "water",
            });
          }
        }
        visualEvents.splice(i, 1);
      }
    }

    // Decay impacts
    let dubLerpFactor = p.map(dubDecayCurrent, 0.1, 2.0, 0.15, 0.01);
    kickImpact = p.lerp(kickImpact, 0, 0.1);
    hihatImpact = p.lerp(hihatImpact, 0, 0.2);
    dubImpact = p.lerp(dubImpact, 0, dubLerpFactor);
    bassImpact = p.lerp(bassImpact, 0, 0.1);
    clapImpact = p.lerp(clapImpact, 0, 0.15);

    // Weather / Echo (Dry/Wet) State
    let weatherP = p.constrain(dubDecayCurrent / 0.9, 0, 1);

    // 1. SKY & BACKGROUND
    let drySkyColor = p.color(12, 11, 9);
    let wetSkyColor = p.color(26, 24, 16);
    let bassFlashColor = p.color(196, 162, 100, 15);

    let currentSkyColor = p.lerpColor(drySkyColor, wetSkyColor, weatherP);
    let baseBg = p.lerpColor(currentSkyColor, bassFlashColor, bassImpact);
    let clapFlashColor = p.color(196, 162, 100, 20);
    p.background(p.lerpColor(baseBg, clapFlashColor, clapImpact));

    // Wet weather darkens the sky with a subtle overlay.
    p.push();
    p.rectMode(p.CORNER);
    p.noStroke();
    p.fill(8, 7, 6, 60 * weatherP);
    p.rect(0, 0, p.width, p.height);
    p.pop();

    let gTime = p.millis() * 0.001;

    // 2. SUN / MOON AND VANISHING POINT
    p.push();
    p.translate(vpX, vpY - p.height * 0.1);

    let moonColor = p.lerpColor(
      p.color(196, 162, 100, 40),
      p.color(196, 162, 100, 50),
      1 - weatherP,
    );
    p.fill(196, 162, 100, 40 * (1 - weatherP));
    p.noStroke();
    p.circle(0, 0, p.height * 0.35);
    p.fill(moonColor);
    p.noStroke();

    // Moon "cracks open" as weatherP goes to 0
    let moonScale = p.map(weatherP, 0, 1, 1, 0.5);
    p.circle(0, 0, p.height * 0.2 * moonScale);
    p.pop();

    // 3. CLOUDS
    let drawCloud = (cx: number, cy: number, scale: number) => {
      p.ellipse(cx, cy, 60 * scale, 30 * scale);
      p.ellipse(cx - 20 * scale, cy + 5 * scale, 50 * scale, 25 * scale);
      p.ellipse(cx + 20 * scale, cy + 5 * scale, 40 * scale, 20 * scale);
      p.ellipse(cx, cy - 10 * scale, 40 * scale, 25 * scale);
    };

    let dryCloudColor = p.color(30, 28, 24, 220);
    let wetCloudColor = p.color(30, 28, 24, 240);
    let currentCloudColor = p.lerpColor(dryCloudColor, wetCloudColor, weatherP);

    p.fill(
      p.lerpColor(currentCloudColor, p.color(196, 162, 100, 40), bassImpact),
    );

    // Always draw cloud 1
    let cloud1X = ((gTime * 20) % (p.width + 300)) - 150;
    drawCloud(cloud1X, p.height * 0.15, 1.5);

    // Draw more clouds as it gets more "Wet"
    if (weatherP > 0.2) {
      let cloud2X = ((gTime * 12 + p.width * 0.5) % (p.width + 300)) - 150;
      drawCloud(cloud2X, p.height * 0.25, 1.0);
    }
    if (weatherP > 0.5) {
      let cloud3X = ((gTime * 25 + p.width * 0.8) % (p.width + 300)) - 150;
      drawCloud(cloud3X, p.height * 0.1, 0.8);
      let cloud4X = ((gTime * 18 + p.width * 0.2) % (p.width + 300)) - 150;
      drawCloud(cloud4X, p.height * 0.05, 1.2);
    }
    if (weatherP > 0.8) {
      let cloud5X = ((gTime * 30 + p.width * 0.4) % (p.width + 300)) - 150;
      drawCloud(cloud5X, p.height * 0.2, 0.9);
    }

    // Rain particles when Wet
    if (weatherP > 0.4) {
      // Add rain randomly
      if (p.random() < weatherP) {
        for (let r = 0; r < 5; r++) {
          particles.push({
            x: p.random(0, p.width),
            y: p.random(-50, 0),
            vx: p.random(-1, 1),
            vy: p.random(10, 20),
            life: 1.0,
            type: "rain",
          });
        }
      }
    }

    // Adjust water level based on weather
    let waterLevelRise = weatherP * (p.height * 0.2); // Water rises up to 20% of screen height
    let dynamicVpY = vpY - waterLevelRise;

    // 4. SCENERY (Sand & River)
    p.push();
    let sandTx = 0;
    let sandTy = 0;
    if (kickImpact > 0.01) {
      sandTx += p.random(-kickImpact * 3, kickImpact * 3);
      sandTy += p.random(-kickImpact * 3, kickImpact * 3);
    }
    if (weatherP < 0.01 && bassImpact > 0.01) {
      sandTx += p.random(-bassImpact * 5, bassImpact * 5);
      sandTy += p.random(-bassImpact * 5, bassImpact * 5);
    }
    p.translate(sandTx, sandTy);

    // Horizon line / Sand background
    p.rectMode(p.CORNER);
    p.fill(26, 24, 18); // Sand
    p.beginShape();
    p.vertex(0, dynamicVpY);
    let stepsH = 40;
    for (let vx = 0; vx <= p.width; vx += stepsH) {
      let waveOffset =
        hihatImpact > 0.01
          ? p.sin(vx * 0.1 + gTime * 20) * (hihatImpact * 5)
          : 0;
      p.vertex(vx, dynamicVpY + waveOffset);
    }
    p.vertex(p.width, p.height);
    p.vertex(0, p.height);
    p.endShape(p.CLOSE);
    p.pop();

    let leftEdgeXAtBottom = p.width * 0.35 + waterLevelRise; // adjust left edge based on rise

    // Water
    if (weatherP >= 0.01) {
      p.push();
      if (bassImpact > 0.01) {
        p.translate(
          p.random(-bassImpact * 5, bassImpact * 5),
          p.random(-bassImpact * 5, bassImpact * 5),
        );
      }

      let waterColor = p.color(14, 13, 10, 220);
      let waterFlashColor = p.color(196, 162, 100, 26);
      p.fill(p.lerpColor(waterColor, waterFlashColor, bassImpact));
      p.beginShape();

      // Left edge (water/sand separation) wobbles with hihat
      for (let y = dynamicVpY; y <= p.height; y += stepsH) {
        let leftX = p.map(y, dynamicVpY, p.height, vpX, leftEdgeXAtBottom);
        let waveOffset =
          hihatImpact > 0.01
            ? p.sin(y * 0.1 + gTime * 20) * (hihatImpact * 8)
            : 0;
        p.vertex(leftX + waveOffset, y);
      }
      p.vertex(p.width, p.height);
      p.vertex(p.width, dynamicVpY);
      p.endShape(p.CLOSE);

      // Water flow lines - wobbly with BASS
      p.strokeWeight(1.5);
      for (let i = 0; i < 8; i++) {
        let flowP = (gTime * 0.15 + i / 8.0) % 1.0;
        let y = p.lerp(dynamicVpY, p.height, flowP * flowP);
        let leftEdge = p.map(y, dynamicVpY, p.height, vpX, leftEdgeXAtBottom);
        let opacity = p.map(flowP, 0, 1, 0, 150);
        p.stroke(196, 162, 100, opacity * 0.17);
        p.noFill();
        p.beginShape();
        let steps = 20;
        for (let vx = leftEdge; vx <= p.width; vx += steps) {
          let waveOffset =
            bassImpact > 0.01
              ? p.sin(vx * 0.05 + gTime * 20) * (bassImpact * 20 * flowP)
              : 0;
          p.vertex(vx, y + waveOffset);
        }
        p.vertex(p.width, y);
        p.endShape();
      }
      p.pop();
    }

    // Particles Render
    for (let i = particles.length - 1; i >= 0; i--) {
      let pt = particles[i];
      pt.x += pt.vx;
      pt.y += pt.vy;

      if (pt.type === "rain") {
        // Rain doesn't fade with time just drops fast
        p.stroke(196, 162, 100, 40);
        p.strokeWeight(1.5);
        p.line(pt.x, pt.y, pt.x - pt.vx * 2, pt.y - pt.vy * 2);
        if (
          pt.y > p.height ||
          (pt.y > dynamicVpY &&
            pt.x > p.map(pt.y, dynamicVpY, p.height, vpX, leftEdgeXAtBottom))
        ) {
          particles.splice(i, 1);
        }
      } else {
        pt.vy += 0.4; // gravity
        pt.life -= 0.02;

        if (pt.life <= 0 || pt.y > p.height) {
          particles.splice(i, 1);
        } else {
          p.noStroke();
          if (pt.type === "sand") {
            p.fill(196, 162, 100, 160 * pt.life);
            p.circle(pt.x, pt.y, 4);
          } else {
            p.fill(196, 162, 100, 130 * pt.life);
            p.circle(pt.x, pt.y, p.random(3, 6)); // sparkling water
          }
        }
      }
    }

    // 5. WATER RIPPLE UNDER BIRD FEET
    let birdCenterX = p.width * 0.45; // Move left to stand cleanly on water edge
    let birdCenterY = p.height * 0.55;

    p.push();
    p.translate(birdCenterX, birdCenterY + 100); // Bird feet approximate location
    p.noFill();
    p.stroke(196, 162, 100, 80);
    p.strokeWeight(1 + kickImpact * 3);
    p.ellipse(-5, 0, 40 + kickImpact * 30, 10 + kickImpact * 5);
    p.pop();

    // 6. DRAW IBIS
    p.translate(birdCenterX, birdCenterY);

    // Bouncing from KICK
    let yOffset = -kickImpact * 30; // Jump up
    p.translate(0, yOffset);

    let birdColor = p.color(230, 224, 212);

    // Physics for tail lag
    let audioTimeThisFrame = getAudioTime();
    let beatPhaseThisFrame = audioTimeThisFrame * (currentBpm / 60.0) * p.TWO_PI;
    let breathScaleThisFrame = p.sin(beatPhaseThisFrame);
    let bodyYOffsetThisFrame = breathScaleThisFrame * 2.5;

    let currentBodyY = yOffset + bodyYOffsetThisFrame;
    let bodyYVelocity = currentBodyY - prevBodyY;
    prevBodyY = currentBodyY;

    let targetTailLag = -bodyYVelocity * 2.5;
    tailLagY = p.lerp(tailLagY, targetTailLag, 0.4);
    tailLagY = p.lerp(tailLagY, 0, 0.1);

    // Ghost aura from DUB
    if (dubImpact > 0.01) {
      p.push();
      // Increase aura size significantly for "ghost" vibe, mapped to delay
      let auraSize = 1.0 + dubImpact * dubDecayCurrent * 0.8;
      p.scale(auraSize);
      let col = p.color(230, 224, 212, 20); // Ghost aura
      p.noFill();
      p.stroke(col);
      // Create a blurred glow effect
      p.strokeWeight(12);
      drawIbis(p, dubImpact, true, col);
      p.strokeWeight(4);
      p.stroke(230, 224, 212, 20);
      drawIbis(p, dubImpact, true, p.color(230, 224, 212, 20));
      p.pop();
    }

    // Main Ibis
    p.fill(birdColor);
    p.noStroke();
    drawIbis(p, dubImpact, false, birdColor);

    p.pop(); // End global camera push
  };

  function drawIbis(p: p5, wobble: number, isGhost: boolean, color: p5.Color) {
    let time = p.millis() * 0.005;
    let bodyColor = p.color(230, 224, 212);
    let mutedColor = p.color(46, 45, 42);
    let accentColor = p.color(196, 162, 100);
    let darkColor = p.color(12, 11, 9);

    const wX = (i: number) =>
      wobble > 0 ? p.sin(time + i * 0.5) * wobble * 15 : 0;
    const wY = (i: number) =>
      wobble > 0 ? p.cos(time + i * 0.5) * wobble * 15 : 0;

    // Breath calculation based on BPM
    let audioTime = getAudioTime();
    let beatPhase = audioTime * (currentBpm / 60.0) * p.TWO_PI;
    let breathScale = p.sin(beatPhase);
    let bodyYOffset = breathScale * 2.5; // Breathing bob

    p.push();
    if (isGhost) {
      p.stroke(color);
      p.strokeWeight(4);
      p.noFill();
    } else {
      p.fill(bodyColor);
      p.noStroke();
    }

    // Legs
    p.push();
    if (isGhost) {
      p.stroke(color);
      p.strokeWeight(4);
    } else {
      p.stroke(mutedColor);
      p.strokeWeight(3);
    }

    // Leg 1
    let root1 = { x: 0, y: 40 + bodyYOffset };
    let knee1 = { x: -15, y: 80 + bodyYOffset / 2 };
    let foot1 = { x: 0, y: 130 };
    p.line(
      root1.x + wX(15),
      root1.y + wY(15),
      knee1.x + wX(16),
      knee1.y + wY(16),
    );
    p.line(
      knee1.x + wX(16),
      knee1.y + wY(16),
      foot1.x + wX(16),
      foot1.y + wY(16),
    );
    p.line(
      foot1.x + wX(16),
      foot1.y + wY(16),
      foot1.x + 15 + wX(16),
      foot1.y + wY(16),
    );

    // Leg 2
    let root2 = { x: 20, y: 35 + bodyYOffset };
    let knee2 = { x: 5, y: 75 + bodyYOffset / 2 };
    let foot2 = { x: 25, y: 125 };
    p.line(
      root2.x + wX(14),
      root2.y + wY(14),
      knee2.x + wX(17),
      knee2.y + wY(17),
    );
    p.line(
      knee2.x + wX(17),
      knee2.y + wY(17),
      foot2.x + wX(17),
      foot2.y + wY(17),
    );
    p.line(
      foot2.x + wX(17),
      foot2.y + wY(17),
      foot2.x + 15 + wX(17),
      foot2.y + wY(17),
    );
    p.pop();

    p.push();
    p.translate(0, bodyYOffset);

    // Body
    p.beginShape();
    let bodyPts = [
      { x: -65, y: -5 + tailLagY }, // 0: Tail tip (with spring physics lag)
      { x: -35, y: -25 }, // 1: Back
      { x: -5, y: -35 }, // 2: Upper Back
      { x: 25, y: -30 }, // Neck base top
      { x: 35, y: 5 }, // Chest
      { x: 30, y: 35 }, // Belly
      { x: -5, y: 45 }, // Underbelly
      { x: -35, y: 25 }, // Lower Tail
    ];

    for (let i = 0; i < bodyPts.length; i++) {
      p.vertex(bodyPts[i].x + wX(i), bodyPts[i].y + wY(i));
    }
    p.endShape(p.CLOSE);

    if (!isGhost) {
      // Darker tail block to separate the back plumage.
      p.push();
      p.fill(mutedColor);
      p.noStroke();
      p.beginShape();
      p.vertex(bodyPts[0].x + wX(0), bodyPts[0].y + wY(0));
      p.vertex(bodyPts[1].x + wX(1), bodyPts[1].y + wY(1));
      p.vertex(bodyPts[7].x + wX(7), bodyPts[7].y + wY(7));
      p.endShape(p.CLOSE);
      p.pop();
    }

    // Neck and Head
    p.push();
    p.translate(22, -22); // Pivot point at neck base
    let neckRotation = p.lerp(-0.1, p.PI * 0.55, 0);
    // slightly bob the neck via time
    neckRotation += p.sin(time) * 0.05;
    p.rotate(neckRotation);

    p.beginShape();
    let headPts = [
      { x: -5, y: -5 }, // Neck base back
      { x: -10, y: -30 }, // Mid back neck
      { x: -10, y: -55 }, // Upper back neck
      { x: -5, y: -75 }, // Back of head
      { x: 5, y: -85 }, // Crown (top)
      { x: 18, y: -80 }, // Upper beak base
      { x: 45, y: -65 }, // Upper beak mid 1
      { x: 80, y: -30 }, // Upper beak mid 2
      { x: 120, y: 35 }, // Beak tip (long, downward curve)
      { x: 110, y: 38 }, // Lower beak tip
      { x: 74, y: -15 }, // Lower beak curve
      { x: 40, y: -50 }, // Lower beak mid
      { x: 15, y: -60 }, // Lower beak base / gape
      { x: 5, y: -55 }, // Chin
      { x: 2, y: -30 }, // Front neck
      { x: 10, y: -5 }, // Neck base front
    ];
    for (let i = 0; i < headPts.length; i++) {
      p.vertex(headPts[i].x + wX(i + 10), headPts[i].y + wY(i + 10));
    }
    p.endShape(p.CLOSE);

    if (!isGhost) {
      // Beak overlay in amber.
      p.push();
      p.fill(accentColor);
      p.noStroke();
      p.beginShape();
      for (let i = 5; i <= 12; i++) {
        p.vertex(headPts[i].x + wX(i + 10), headPts[i].y + wY(i + 10));
      }
      p.endShape(p.CLOSE);
      p.pop();

      // Skin patch on back of the neck/head
      p.push();
      p.fill(46, 45, 42);
      p.noStroke();
      p.ellipse(-6 + wX(12), -65 + wY(12), 8, 12);
      p.ellipse(-2 + wX(13), -75 + wY(13), 7, 7);
      p.fill(196, 162, 100);
      p.ellipse(3 + wX(14), -80 + wY(14), 5, 5);
      p.pop();

      // Shaggy white neck feathers at the base
      p.push();
      p.stroke(230, 224, 212, 100);
      p.strokeWeight(1.5);
      for (let f = 0; f < 8; f++) {
        let fx = p.random(-8, 12);
        let fy = p.random(-15, 0);
        let tipX = p.random(-15, 5);
        let tipY = p.random(0, 10);
        p.line(fx + wX(10), fy + wY(10), tipX + wX(10), fy + tipY + wY(10));
      }
      p.pop();
    }

    // Beak Tip Glow
    p.push();
    if (!isGhost) {
      let filterPct = p.map(currentFilterFreq, 200, 4000, 0, 1, true);
      let glowAmt = dubImpact * filterPct;
      if (glowAmt > 0) {
        let tipIdx = 8;
        let tipX = headPts[tipIdx].x + wX(tipIdx + 10);
        let tipY = headPts[tipIdx].y + wY(tipIdx + 10);
        let tipColor = p.color(196, 162, 100);

        p.noFill();
        p.strokeWeight(3 + glowAmt * 4);
        p.stroke(tipColor);
        p.point(tipX, tipY);

        p.strokeWeight(6 + glowAmt * 15);
        p.stroke(
          p.color(
            p.red(tipColor),
            p.green(tipColor),
            p.blue(tipColor),
            180 * glowAmt,
          ),
        );
        p.point(tipX, tipY);
      }
    }
    p.pop();

    // Beak Specular Highlight
    if (!isGhost) {
      p.push();
      let hlTime = (p.millis() * 0.0008) % 2.0; // cycle
      if (hlTime <= 1.0) {
        let t = hlTime;
        let bx1 = 18 + wX(15),
          by1 = -80 + wY(15);
        let bx2 = 45 + wX(16),
          by2 = -65 + wY(16);
        let bx3 = 80 + wX(17),
          by3 = -30 + wY(17);
        let bx4 = 120 + wX(18),
          by4 = 35 + wY(18);

        let hlx = p.bezierPoint(bx1, bx2, bx3, bx4, t);
        let hly = p.bezierPoint(by1, by2, by3, by4, t);
        let tx1 = p.bezierTangent(bx1, bx2, bx3, bx4, t);
        let ty1 = p.bezierTangent(by1, by2, by3, by4, t);
        let a = p.atan2(ty1, tx1);

        p.translate(hlx, hly);
        p.rotate(a);
        p.noFill();
        p.stroke(230, 224, 212, 40 * p.sin(t * p.PI));
        p.strokeWeight(1.5);
        p.arc(0, -2, 12, 4, p.PI, p.TWO_PI);
      }
      p.pop();
    }

    // Eye
    p.push();
    if (!isGhost) {
      p.fill(darkColor);
      p.noStroke();
    }
    let eyex = 5 + wX(15);
    let eyey = -82 + wY(15);
    let baseSize = 6;
    
    // Blink animation
    let isBlinking = p.noise(p.frameCount * 0.1) > 0.8;
    let currentEyeHeight = isBlinking ? baseSize * 0.1 : baseSize;
    
    // Gaze tracking
    let globalEyeX = (p.width / 2 - 30) + 22 + eyex; 
    let globalEyeY = (p.height / 2) + bodyYOffset - 22 + eyey;
    let angleToMouse = p.atan2(p.mouseY - globalEyeY, p.mouseX - globalEyeX);
    
    p.translate(eyex, eyey);
    p.ellipse(0, 0, baseSize, currentEyeHeight); // White portion
    
    if (!isGhost && !isBlinking) {
      // Iris tracking
      p.fill(accentColor);
      let pupilOffset = 1.0;
      let px = p.cos(angleToMouse) * pupilOffset;
      let py = p.sin(angleToMouse) * pupilOffset;
      p.ellipse(px, py, baseSize * 0.45, baseSize * 0.45);
    }
    p.pop();

    p.pop(); // End Neck and Head

    // Wing
    p.push();
    p.translate(10, -15); // Pivot at shoulder
    
    // Flap wing based on kickImpact with smooth sine easing
    let wingRotation = -p.sin(kickImpact * p.PI) * 0.6;
    let wingJitter = clapImpact > 0 ? p.random(-0.1, 0.1) * clapImpact : 0;
    p.rotate(wingRotation + wingJitter);

    if (!isGhost) {
      p.fill(mutedColor);
      p.stroke(clapImpact > 0.01 ? bodyColor : mutedColor);
      p.strokeWeight(2);
    }
    p.beginShape();
    let wingPts = [
      { x: 0, y: -5 },
      { x: -35, y: -15 },
      { x: -75, y: -5 },
      { x: -115, y: 35 }, // Wing tail extension
      { x: -75, y: 65 },
      { x: -35, y: 75 },
      { x: 15, y: 40 },
      { x: 20, y: 10 },
    ];
    for (let i = 0; i < wingPts.length; i++) {
      let pt = wingPts[i];
      p.vertex(pt.x + wX(i + 20), pt.y + wY(i + 20));
    }
    p.endShape(p.CLOSE);

    if (!isGhost) {
      p.noFill();
      p.stroke(230, 224, 212, 40);
      p.strokeWeight(2);
      p.beginShape();
      for (let i = 0; i < wingPts.length; i++) {
        let pt = wingPts[i];
        p.vertex(pt.x * 0.82 + wX(i + 20), pt.y * 0.82 + wY(i + 20));
      }
      p.endShape(p.CLOSE);
    }

    if (!isGhost) {
      p.stroke(230, 224, 212, 100); // feather detail
      p.strokeWeight(1.5);

      let windDisplacement = (offset: number) =>
        p.sin(p.frameCount * 0.05 + offset) * 5;

      let mouseDistX = p.mouseX - (p.width * 0.45);
      
      // Non-linear easing (cubic ease-out) for fluid, grounded feather movement
      let maxDist = p.width / 2;
      let normDist = p.constrain(mouseDistX / (maxDist || 1), -1, 1);
      let easedNorm = normDist < 0 
        ? -1 + p.pow(normDist + 1, 3)
        : 1 - p.pow(1 - normDist, 3);
        
      let parallaxBase = easedNorm * 15;
      let parallaxTip = easedNorm * 30;

      let clapJitter = (offset: number) => 
        clapImpact > 0 ? p.random(-clapImpact * 20, clapImpact * 20) : 0;

      // Feather details based on the new, much larger wing shape
      let fx1 = -20 + parallaxBase,
        fy1 = 0;
      let fx2 = -55 + windDisplacement(0) + parallaxTip + clapJitter(0),
        fy2 = 45;
      p.line(fx1 + wX(21), fy1 + wY(21), fx2 + wX(21), fy2 + wY(21));

      let fx3 = -5 + parallaxBase,
        fy3 = 5;
      let fx4 = -40 + windDisplacement(1) + parallaxTip + clapJitter(1),
        fy4 = 60;
      p.line(fx3 + wX(22), fy3 + wY(22), fx4 + wX(22), fy4 + wY(22));

      let fx5 = 10 + parallaxBase,
        fy5 = 15;
      let fx6 = -20 + windDisplacement(2) + parallaxTip + clapJitter(2),
        fy6 = 65;
      p.line(fx5 + wX(23), fy5 + wY(23), fx6 + wX(23), fy6 + wY(23));
    }

    p.pop(); // End Wing

    p.pop(); // End structural shift (bodyYOffset)
    p.pop(); // End Ghost stroke layer logic
  }
};
