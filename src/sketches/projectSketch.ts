import p5 from 'p5';

export const createProjectSketch = (colorHex: string, seed: number) => {
  return (p: any) => {
    let t = 0;
    
    p.setup = () => {
      // Small canvas that sizes to its responsive container later via CSS/Resize
      p.createCanvas(10, 10);
      if (p.canvas && p.canvas.parentElement) {
        p.resizeCanvas(p.canvas.parentElement.clientWidth, p.canvas.parentElement.clientHeight);
      }
      p.randomSeed(seed);
    };

    p.draw = () => {
      p.clear(0, 0, 0, 0);
      
      let w = p.width;
      let h = p.height;
      let minDim = p.min(w, h);
      
      // Check if mouse is hovering over this specific canvas bounds
      let isHovered = (p.mouseX >= 0 && p.mouseX <= w && p.mouseY >= 0 && p.mouseY <= h);
      
      p.translate(w/2, h/2);
      p.stroke(colorHex);
      p.strokeWeight(2);
      p.noFill();

      // Faster spinning if hovered
      t += isHovered ? 0.1 : 0.01;

      // Draw a rotating 3D-ish tech structure
      p.rotate(t * 0.1);
      
      let rings = 4;
      for (let i = 1; i <= rings; i++) {
        p.push();
        let r = (minDim * 0.4) * (i / rings);
        
        // Scale fluctuation on hover
        if (isHovered) {
          r += p.sin(t + i) * 20;
        }

        p.rotate(t * (i%2===0 ? 1 : -1) * 0.5);
        if (seed % 2 === 0) {
          p.rectMode(p.CENTER);
          p.rect(0, 0, r*1.5, r*1.5, 8);
        } else {
          p.circle(0, 0, r*2);
          p.line(-r, 0, r, 0);
        }
        
        // Data nodes
        p.fill('#1A1A1A');
        p.circle(r, 0, 8);
        p.pop();
      }
    };

    p.windowResized = () => {
      if (p.canvas && p.canvas.parentElement) {
        let pw = p.canvas.parentElement.clientWidth;
        let ph = p.canvas.parentElement.clientHeight;
        if (pw > 0 && ph > 0) {
          p.resizeCanvas(pw, ph);
        }
      }
    };
  };
};
