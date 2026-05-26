import p5 from 'p5';

export const heroSketch = (p: any) => {
  const THEME = {
    bg: '#F2F3F5',
    dark: '#0D0D0E',
    magenta: '#FF0055',
    cyan: '#00E5FF',
    volt: '#CCFF00',
    gray: '#D4D6DC',
    white: '#FFFFFF'
  };

  const accentColors = [THEME.magenta, THEME.cyan, THEME.volt, THEME.dark];

  let panels: Panel[] = [];
  let cables: { startX: number, startY: number, endX: number, endY: number, active: boolean, energy: number, speed: number }[] = [];
  let globalsTime = 0;
  
  class Panel {
    x: number; y: number; w: number; h: number; 
    type: number; color: string;
    elements: any[] = [];
    timeOffset: number;
    depthOffset: number;

    constructor(x: number, y: number, w: number, h: number) {
      this.x = x; this.y = y; this.w = w; this.h = h;
      this.type = p.floor(p.random(5));
      this.color = p.random(accentColors);
      this.timeOffset = p.random(100);
      this.depthOffset = 0;
      this.initElements();
    }

    initElements() {
      let pw = this.w; let ph = this.h;
      if (this.type === 0) {
        // PADS (Grid)
        let cols = p.max(2, p.floor(pw / 45));
        let rows = p.max(2, p.floor(ph / 45));
        let cw = pw / cols; let ch = ph / rows;
        for (let i = 0; i < cols; i++) {
          for (let j = 0; j < rows; j++) {
            this.elements.push({ x: i * cw, y: j * ch, w: cw, h: ch, active: false, activeColor: p.random(accentColors), pressDep: 0 });
          }
        }
      } else if (this.type === 1) {
        // DIALS
        let cols = p.max(1, p.floor(pw / 80));
        let cw = pw / cols;
        for (let i = 0; i < cols; i++) {
          this.elements.push({ x: i * cw + cw/2, y: ph/2, r: p.min(cw - 30, ph - 30), val: p.random(p.TWO_PI), target: 0 });
        }
      } else if (this.type === 2) {
        // SCREEN
        // just visuals
      } else if (this.type === 3) {
        // FADERS
        let cols = p.max(1, p.floor(pw / 50));
        let cw = pw / cols;
        for (let i = 0; i < cols; i++) {
          this.elements.push({ x: i * cw + cw/2, val: p.random(0.2, 0.8), target: p.random(0.2, 0.8) });
        }
      }
    }

    draw() {
      let isHovered = p.mouseX > this.x && p.mouseX < this.x + this.w && p.mouseY > this.y && p.mouseY < this.y + this.h;
      
      this.depthOffset = p.lerp(this.depthOffset, isHovered ? 4 : 8, 0.2);

      p.push();
      p.translate(this.x, this.y);
      p.translate(-this.depthOffset/2, -this.depthOffset/2); // pop up slightly
      
      // Hard Shadow
      p.fill(THEME.dark);
      p.noStroke();
      p.rect(this.depthOffset, this.depthOffset, this.w, this.h, 4);

      // Base
      p.fill(THEME.bg);
      p.stroke(THEME.dark);
      p.strokeWeight(3);
      p.rect(0, 0, this.w, this.h, 4);
      
      // Top lip detail
      p.noStroke();
      p.fill(THEME.white);
      p.rect(3, 3, this.w - 6, 4, 2);

      const ctx = p.drawingContext as CanvasRenderingContext2D;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, this.w, this.h);
      ctx.clip();

      if (this.type === 0) {
        // PADS
        for (let el of this.elements) {
          let globalX = this.x + el.x;
          let globalY = this.y + el.y;
          let d = p.dist(p.mouseX, p.mouseY, globalX + el.w/2, globalY + el.h/2);
          el.active = (d < 40);
          el.pressDep = p.lerp(el.pressDep, el.active ? 4 : 0, 0.3);
          
          p.push();
          p.translate(el.x + 8, el.y + 8);
          
          // Pad Shadow
          p.fill(THEME.dark);
          p.rect(0, 0, el.w - 16, el.h - 16, 4);
          
          p.translate(-el.pressDep, -el.pressDep);
          p.fill(el.active ? el.activeColor : THEME.gray);
          p.stroke(THEME.dark);
          p.strokeWeight(2);
          p.rect(0, 0, el.w - 16, el.h - 16, 4);
          
          if (el.active) {
            p.fill(THEME.white);
            p.noStroke();
            p.circle((el.w-16)/2, (el.h-16)/2, 8);
          }
          p.pop();
        }
      } else if (this.type === 1) {
        // DIALS
        for (let el of this.elements) {
          let globalX = this.x + el.x;
          let globalY = this.y + el.y;
          let d = p.dist(p.mouseX, p.mouseY, globalX, globalY);
          
          if (d < 100) {
            el.target = p.atan2(p.mouseY - globalY, p.mouseX - globalX);
          } else {
            el.target = p.sin(globalsTime * 0.05 + this.timeOffset) * p.PI;
          }
          
          el.val = p.lerp(el.val, el.target, 0.1);

          p.push();
          p.translate(el.x, el.y);
          
          // Dial Base
          p.fill(THEME.dark);
          p.noStroke();
          p.circle(4, 4, el.r); 
          
          p.fill(THEME.gray);
          p.stroke(THEME.dark);
          p.strokeWeight(3);
          p.circle(0, 0, el.r);
          
          p.rotate(el.val);
          p.fill(this.color === THEME.dark ? THEME.magenta : this.color);
          p.circle(el.r/2 - 12, 0, 14);
          p.strokeWeight(4);
          p.line(0, 0, el.r/2 - 12, 0);
          
          p.fill(THEME.dark);
          p.circle(0,0, el.r * 0.3);
          p.pop();
        }
      } else if (this.type === 2) {
        // SCREEN
        p.push();
        p.translate(12, 12);
        let sw = this.w - 24;
        let sh = this.h - 24;
        
        p.fill(THEME.dark);
        p.noStroke();
        p.rect(0, 0, sw, sh, 6);
        
        // Scanlines
        const ctx = p.drawingContext as CanvasRenderingContext2D;
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, sw, sh);
        ctx.clip();
        
        p.stroke(this.color === THEME.dark ? THEME.volt : this.color);
        p.strokeWeight(2);
        p.noFill();
        p.beginShape();
        let amp = isHovered ? sh/3 : sh/8;
        let freq = isHovered ? 0.3 : 0.08;
        for(let i = 0; i < sw; i+=4) {
          let y = sh/2 + p.sin(i * freq + globalsTime * 0.2 + this.timeOffset) * amp;
          y += p.noise(i * 0.1, globalsTime * 0.05) * (isHovered ? 15 : 4) - 7;
          p.vertex(i, y);
        }
        p.endShape();
        
        // grid overlay
        p.stroke(255, 255, 255, 20);
        p.strokeWeight(1);
        for(let i=0; i<sw; i+=10) p.line(i, 0, i, sh);
        for(let j=0; j<sh; j+=10) p.line(0, j, sw, j);
        
        const ctxRestore = p.drawingContext as CanvasRenderingContext2D;
        ctxRestore.restore();
        
        // Screen glare
        p.fill(255, 255, 255, 10);
        p.noStroke();
        p.beginShape();
        p.vertex(0, 0); p.vertex(sw, 0); p.vertex(sw, sh/2); p.vertex(0, sh);
        p.endShape(p.CLOSE);
        p.pop();
        
      } else if (this.type === 3) {
        // FADERS
        for (let el of this.elements) {
          let globalX = this.x + el.x;
          if (isHovered && p.abs(p.mouseX - globalX) < 25) {
            let relativeY = p.constrain(p.mouseY - this.y, 20, this.h - 20);
            el.target = p.map(relativeY, 20, this.h - 20, 1, 0);
          }
          el.val = p.lerp(el.val, el.target, 0.2);

          // Track
          p.stroke(THEME.dark);
          p.strokeWeight(6);
          p.strokeCap(p.ROUND);
          p.line(el.x, 24, el.x, this.h - 24);
          p.stroke(THEME.gray);
          p.strokeWeight(2);
          p.line(el.x, 24, el.x, this.h - 24);
          
          let capY = p.map(el.val, 0, 1, this.h - 24, 24);
          
          // Cap shadow
          p.noStroke();
          p.fill(THEME.dark);
          p.rectMode(p.CENTER);
          p.rect(el.x + 4, capY + 4, 32, 20, 4);
          
          p.stroke(THEME.dark);
          p.strokeWeight(2);
          p.fill(this.color);
          p.rect(el.x, capY, 32, 20, 4);
          p.fill(THEME.white);
          p.noStroke();
          p.rect(el.x, capY, 24, 4);
          p.rectMode(p.CORNER);
        }
      } else if (this.type === 4) {
        // TAPE MECHANISM
        let r = p.min(this.w/4, this.h/2 - 25);
        let cx1 = this.w/3; let cx2 = (this.w/3) * 2;
        let cy = this.h/2;
        
        let speed = isHovered ? 0.3 : 0.05;
        this.timeOffset += speed;
        
        // Window
        p.fill(THEME.dark);
        p.stroke(THEME.white);
        p.strokeWeight(2);
        p.rect(cx1 - r - 10, cy - r - 10, (cx2-cx1) + r*2 + 20, r*2 + 20, 8);

        p.fill(THEME.bg);
        p.circle(cx1, cy, r * 2);
        p.circle(cx2, cy, r * 2);

        p.push();
        p.translate(cx1, cy);
        p.rotate(this.timeOffset);
        p.stroke(THEME.dark);
        p.line(-r, 0, r, 0);
        p.line(0, -r, 0, r);
        p.fill(this.color);
        p.circle(0, 0, 16);
        p.pop();

        p.push();
        p.translate(cx2, cy);
        p.rotate(this.timeOffset);
        p.stroke(THEME.dark);
        p.line(-r, 0, r, 0);
        p.line(0, -r, 0, r);
        p.fill(this.color);
        p.circle(0, 0, 16);
        p.pop();
        
        // Connecting tape
        p.stroke(THEME.gray);
        p.strokeWeight(3);
        p.line(cx1, cy - r, cx2, cy - r);
      }

      const parentCtx = p.drawingContext as CanvasRenderingContext2D;
      parentCtx.restore();
      p.pop();
    }
  }

  function splitRect(x: number, y: number, w: number, h: number, depth: number) {
    let padding = 12;
    if (depth === 0 || (w < 180 && h < 180)) {
      panels.push(new Panel(x + padding, y + padding, w - padding * 2, h - padding * 2));
      return;
    }

    let splitH = p.random() > 0.5;
    if (w / h > 2.0) splitH = false; // force vertical cut
    if (h / w > 2.0) splitH = true;  // force horizontal cut

    if (splitH) {
      let splitAt = p.floor(p.random(0.3, 0.7) * h);
      splitRect(x, y, w, splitAt, depth - 1);
      splitRect(x, y + splitAt, w, h - splitAt, depth - 1);
    } else {
      let splitAt = p.floor(p.random(0.3, 0.7) * w);
      splitRect(x, y, splitAt, h, depth - 1);
      splitRect(x + splitAt, y, w - splitAt, h, depth - 1);
    }
  }

  p.setup = () => {
    p.createCanvas(10, 10);
    if (p.canvas && p.canvas.parentElement) {
      p.resizeCanvas(p.canvas.parentElement.clientWidth, p.canvas.parentElement.clientHeight);
    } else {
      p.resizeCanvas(p.windowWidth, p.windowHeight * 0.8);
    }
    generateLayout();
  };

  const generateLayout = () => {
    panels = [];
    cables = [];
    splitRect(20, 20, p.width - 40, p.height - 40, 4);
    
    // Create some permanent patch cables
    for(let i=0; i<6; i++) {
        let p1 = p.random(panels);
        let p2 = p.random(panels);
        cables.push({
            startX: p1.x + p1.w/2, startY: p1.y + p1.h/2,
            endX: p2.x + p2.w/2, endY: p2.y + p2.h/2,
            active: true, energy: p.random(1),
            speed: p.random(0.005, 0.015)
        });
    }
  }

  p.draw = () => {
    p.clear(0, 0, 0, 0);
    globalsTime++;

    // Draw grid background
    p.stroke(THEME.dark);
    p.strokeWeight(1);
    for(let x=0; x<p.width; x+=40) {
      p.stroke(0, 0, 0, 20);
      p.line(x, 0, x, p.height);
    }
    for(let y=0; y<p.height; y+=40) {
      p.stroke(0, 0, 0, 20);
      p.line(0, y, p.width, y);
    }

    // Draw active cables
    p.noFill();
    for (let c of cables) {
      // Cable shadow
      p.stroke(0, 0, 0, 50);
      p.strokeWeight(8);
      p.bezier(c.startX, c.startY + 10, c.startX, c.startY + 160, c.endX, c.endY + 160, c.endX, c.endY + 10);

      // Cable body
      p.stroke(THEME.dark);
      p.strokeWeight(6);
      p.bezier(c.startX, c.startY, c.startX, c.startY + 150, c.endX, c.endY + 150, c.endX, c.endY);
      
      // Energy flow inside cable
      let midX = p.bezierPoint(c.startX, c.startX, c.endX, c.endX, 0.5);
      let midY = p.bezierPoint(c.startY, c.startY + 150, c.endY + 150, c.endY, 0.5);
      let d = p.dist(p.mouseX, p.mouseY, midX, midY);
      
      // Speed accelerates heavily when mouse is close
      let speedMultiplier = p.map(p.constrain(d, 0, 200), 0, 200, 5, 1);
      
      c.energy -= c.speed * speedMultiplier;
      if (c.energy < 0) c.energy = 1;
      
      let t = 1.0 - c.energy;
      
      // Draw multiple trailing parts for the pulse
      for (let i = 0; i < 5; i++) {
        let trailT = t - (i * 0.04);
        if (trailT >= 0 && trailT <= 1.0) {
          let px = p.bezierPoint(c.startX, c.startX, c.endX, c.endX, trailT);
          let py = p.bezierPoint(c.startY, c.startY + 150, c.endY + 150, c.endY, trailT);
          let alpha = p.map(i, 0, 4, 255, 0);
          let size = p.map(i, 0, 4, 12, 2);
          
          let col = p.color(THEME.magenta);
          col.setAlpha(alpha);
          p.fill(col);
          p.noStroke();
          p.circle(px, py, size);
        }
      }
    }

    for (let panel of panels) {
      panel.draw();
    }
    
    // Dynamic Crosshairs tracking mouse
    p.stroke(THEME.magenta);
    p.strokeWeight(1);
    
    const mainCtx = p.drawingContext as CanvasRenderingContext2D;
    
    // Animate crosshairs dashed lines
    mainCtx.setLineDash([5, 10]);
    mainCtx.lineDashOffset = -globalsTime;
    p.line(p.mouseX, 0, p.mouseX, p.height);
    p.line(0, p.mouseY, p.width, p.mouseY);
    mainCtx.setLineDash([]); // Reset
    
    // Center reticle
    p.noFill();
    p.stroke(THEME.magenta);
    p.strokeWeight(2);
    p.circle(p.mouseX, p.mouseY, 30);
    p.circle(p.mouseX, p.mouseY, 4);
  };

  p.windowResized = () => {
    if (p.canvas && p.canvas.parentElement) {
      p.resizeCanvas(p.canvas.parentElement.clientWidth, p.canvas.parentElement.clientHeight);
    } else {
      p.resizeCanvas(p.windowWidth, p.windowHeight * 0.8);
    }
    generateLayout();
  };

  p.mouseClicked = () => {
    // Re-roll layout on click occasionally to add to the toy-like feel
    if (p.random() > 0.3) {
      generateLayout();
    }
  }
};
